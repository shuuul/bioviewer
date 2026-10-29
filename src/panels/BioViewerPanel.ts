import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getErrorMessage } from "../shared/errors";
import {
  isViewerSettings,
  isWebviewToExtensionMessage,
  type ExtensionToWebviewMessage,
  type LoadPayload,
  type ViewerSettings,
  type WebviewConfig,
} from "../shared/webviewProtocol";

/** What a panel needs from the extension context: its files and the persisted viewer settings. */
export type PanelContext = Pick<vscode.ExtensionContext, "extensionUri" | "globalState">;

const SETTINGS_KEY = "bioviewer.viewerSettings";
const DEFAULT_SETTINGS: ViewerSettings = { customColors: [], locale: null };
const STUDIO_INTRO_KEY = "bioviewer.studioIntroShown";

/** `studio` is the MolStudio interface; `classic` is Mol*'s own viewer app. */
export type ViewerKind = "studio" | "classic";

/** Reads the `bioviewer.viewer` setting, which applies to panels opened after it changes. */
export function configuredViewer(): ViewerKind {
  const value = vscode.workspace.getConfiguration("bioviewer").get<string>("viewer", "studio");
  if (value !== "studio" && value !== "classic") {
    throw new Error(`Unknown bioviewer.viewer setting "${value}"; use "studio" or "classic".`);
  }
  return value;
}

/**
 * One BioViewer webview tab: creates the panel, waits for its viewer to start, and sends it
 * load requests whose completion the viewer reports back. `currentPanel` tracks the most
 * recently active tab for the "add to current tab" commands.
 */
export class BioViewerPanel {
  /** The currently active BioViewer panel */
  public static currentPanel: BioViewerPanel | undefined;

  /** The underlying VS Code webview panel */
  private readonly _panel: vscode.WebviewPanel;

  /** Array of disposables to clean up when panel is disposed */
  private _disposables: vscode.Disposable[] = [];

  /** Output channel for logging (shared across all instances) */
  private static _outputChannel: vscode.OutputChannel;

  /** Promise that resolves when the webview is ready to receive messages */
  private _readyPromise: Promise<void>;

  /** Resolver function for the ready promise */
  private _resolveReady: (() => void) | undefined;
  private _rejectReady: ((error: Error) => void) | undefined;
  private static readonly _panels = new Set<BioViewerPanel>();
  private _nextRequestId = 0;
  private readonly _pendingLoads = new Map<string, {
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private static readonly LOAD_TIMEOUT_MS = 300000;

  /** Flag indicating if the webview is ready */
  private _isReady: boolean = false;

  /** Flag indicating if the panel has been disposed */
  private _isDisposed: boolean = false;

  /** HTML templates by viewer, read on first use */
  private static readonly _templates = new Map<ViewerKind, string>();

  private readonly _globalState: vscode.Memento;

  /** Maximum time to wait for the webview to report ready */
  private static readonly READY_TIMEOUT_MS = 30000;

  /**
   * Gets the ready state of the panel (for testing)
   * @returns True if the webview is ready to receive messages
   */
  public get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Gets the loading state of the panel (for testing)
   * @returns True if content is currently being loaded
   */
  public get isLoading(): boolean {
    return this._pendingLoads.size > 0;
  }

  /**
   * Private constructor - use static create() method instead
   * @param panel - The VS Code webview panel
   * @param context - Extension files and persisted settings
   */
  private constructor(panel: vscode.WebviewPanel, context: PanelContext, viewer: ViewerKind) {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(
      `initializing panel: ${panel.title}`,
    );

    this._panel = panel;
    this._globalState = context.globalState;

    // Set up panel disposal handling
    this._panel.onDidDispose(
      () => {
        BioViewerPanel._outputChannel.appendLine(`disposing panel`);
        this.dispose();
      },
      null,
      this._disposables,
    );

    // Initialize ready promise for synchronizing webview readiness
    this._readyPromise = new Promise((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });
    // Disposal can precede the first readiness waiter.
    void this._readyPromise.catch(() => {});
    this._panel.onDidChangeViewState(({ webviewPanel }) => {
      if (webviewPanel.active && !this._isDisposed) {
        BioViewerPanel._panels.delete(this);
        BioViewerPanel._panels.add(this);
        BioViewerPanel.currentPanel = this;
      }
    }, null, this._disposables);

    // Set up message handling from webview
    this._setupMessageHandling();

    // Generate and set the webview HTML content
    try {
      if (!this._isDisposed) {
        this._panel.webview.html = this._getWebviewContent(
          this._panel.webview,
          context.extensionUri,
          viewer,
        );
        BioViewerPanel._outputChannel.appendLine(
          `panel initialized in ${Date.now() - startTime}ms`,
        );
      } else {
        BioViewerPanel._outputChannel.appendLine(
          `Warning: panel was disposed during initialization`,
        );
      }
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(
        `Error: failed to set webview content - ${error}`,
      );
      throw error;
    }
  }

  /**
   * Sets up message handling between the extension and webview
   */
  private _setupMessageHandling(): void {
    this._panel.webview.onDidReceiveMessage(
      (rawMessage: unknown) => {
        if (!isWebviewToExtensionMessage(rawMessage)) {
          BioViewerPanel._outputChannel.appendLine(
            `Warning: ignored an unexpected webview message`,
          );
          return;
        }

        switch (rawMessage.command) {
          case "loadResult": {
            const pending = this._pendingLoads.get(rawMessage.requestId);
            if (!pending) {
              break;
            }
            clearTimeout(pending.timeout);
            this._pendingLoads.delete(rawMessage.requestId);
            if (rawMessage.success) {
              pending.resolve();
            } else {
              pending.reject(new Error(rawMessage.error));
            }
            break;
          }
          case "ready":
            BioViewerPanel._outputChannel.appendLine(`webview is ready`);
            this._handleReady();
            break;

          case "startupFailed":
            BioViewerPanel._outputChannel.appendLine(`Error: viewer failed to start - ${rawMessage.error}`);
            this._rejectReady?.(new Error(`The viewer failed to start: ${rawMessage.error}`));
            this._rejectReady = undefined;
            this._resolveReady = undefined;
            break;

          case "error":
            BioViewerPanel._outputChannel.appendLine(
              `Error from webview: ${rawMessage.error}`,
            );
            vscode.window.showErrorMessage(`BioViewer: ${rawMessage.error}`);
            break;

          case "info":
            BioViewerPanel._outputChannel.appendLine(
              `info from webview: ${rawMessage.info}`,
            );
            break;

          case "debug":
            BioViewerPanel._outputChannel.appendLine(
              `debug: ${rawMessage.message}`,
            );
            break;

          case "saveFile":
            void this._saveFile(rawMessage.requestId, rawMessage.filename, rawMessage.data);
            break;

          case "updateSettings":
            void this._globalState.update(SETTINGS_KEY, rawMessage.settings);
            break;

          case "openFiles":
            void vscode.commands.executeCommand("bioviewer.addFiles");
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  /** Asks where to save a file exported by the viewer, writes it, and reports the outcome back. */
  private async _saveFile(requestId: string, filename: string, data: Uint8Array): Promise<void> {
    const reply = (message: ExtensionToWebviewMessage): void => {
      void this._panel.webview.postMessage(message);
    };
    try {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const target = await vscode.window.showSaveDialog({
        defaultUri: folder ? vscode.Uri.joinPath(folder, filename) : vscode.Uri.file(filename),
        saveLabel: "Save Image",
      });
      if (!target) {
        BioViewerPanel._outputChannel.appendLine(`image save cancelled`);
        reply({ command: "saveResult", requestId, success: true });
        return;
      }
      await vscode.workspace.fs.writeFile(target, data);
      BioViewerPanel._outputChannel.appendLine(`image saved: ${target.fsPath}`);
      reply({ command: "saveResult", requestId, success: true });
    } catch (error) {
      const message = getErrorMessage(error);
      BioViewerPanel._outputChannel.appendLine(`Error: failed to save image - ${message}`);
      reply({ command: "saveResult", requestId, success: false, error: message });
    }
  }

  private _readSettings(): ViewerSettings {
    const stored = this._globalState.get<unknown>(SETTINGS_KEY);
    if (stored === undefined) {
      return DEFAULT_SETTINGS;
    }
    if (!isViewerSettings(stored)) {
      BioViewerPanel._outputChannel.appendLine(`Warning: ignoring invalid stored viewer settings: ${JSON.stringify(stored)}`);
      return DEFAULT_SETTINGS;
    }
    return stored;
  }

  /**
   * Handles the 'ready' message from the webview
   * Resolves the ready promise to allow content loading
   */
  private _handleReady(): void {
    this._isReady = true;

    if (this._resolveReady) {
      this._resolveReady();
      this._resolveReady = undefined;
    }
  }

  /**
   * Waits for the webview to be ready before proceeding.
   * Fails loudly instead of hanging forever when the webview never boots.
   */
  public async waitForReady(): Promise<void> {
    if (this._isDisposed) {
      throw new Error("Viewer panel was closed.");
    }
    if (this._isReady) {
      return;
    }

    let timeoutHandle: NodeJS.Timeout | undefined;
    const readyTimeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `webview did not report ready within ${BioViewerPanel.READY_TIMEOUT_MS / 1000}s`,
          ),
        );
      }, BioViewerPanel.READY_TIMEOUT_MS);
    });

    try {
      await Promise.race([this._readyPromise, readyTimeout]);
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(`Error: ${error}`);
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Creates a new BioViewer panel instance
   * @param context - Extension files and persisted settings
   * @param title - The title for the panel (default: "BioViewer")
   * @param outputChannel - The output channel for logging
   * @returns New BioViewerPanel instance
   */
  public static create(
    context: PanelContext,
    title: string = "BioViewer",
    outputChannel: vscode.OutputChannel,
  ): BioViewerPanel {
    const startTime = Date.now();
    BioViewerPanel._outputChannel = outputChannel;

    // Determine the column to place the panel
    const column =
      vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    const viewer = configuredViewer();

    // Create the webview panel with appropriate options
    const panel = vscode.window.createWebviewPanel("BioViewer", title, column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
      ],
    });

    let instance: BioViewerPanel;
    try {
      instance = new BioViewerPanel(panel, context, viewer);
    } catch (error) {
      panel.dispose();
      throw error;
    }
    BioViewerPanel._panels.add(instance);
    BioViewerPanel.currentPanel = instance;
    BioViewerPanel._outputChannel.appendLine(
      `${viewer} panel created in ${Date.now() - startTime}ms`,
    );
    if (viewer === "studio" && !context.globalState.get<boolean>(STUDIO_INTRO_KEY)) {
      void BioViewerPanel._introduceStudio(context.globalState);
    }
    return instance;
  }

  /** Tells first-time users about the new viewer and how to return to the classic Mol* one. */
  private static async _introduceStudio(globalState: vscode.Memento): Promise<void> {
    await globalState.update(STUDIO_INTRO_KEY, true);
    const useClassic = "Use Classic Viewer";
    const openSettings = "Settings";
    const choice = await vscode.window.showInformationMessage(
      "BioViewer has a new viewer interface. You can switch back to the classic Mol* viewer at any time with the BioViewer: Viewer setting.",
      useClassic,
      openSettings,
    );
    if (choice === useClassic) {
      await vscode.workspace.getConfiguration("bioviewer").update("viewer", "classic", vscode.ConfigurationTarget.Global);
      BioViewerPanel._outputChannel.appendLine(`viewer switched to classic`);
      void vscode.window.showInformationMessage("New BioViewer tabs will open in the classic Mol* viewer.");
    } else if (choice === openSettings) {
      await vscode.commands.executeCommand("workbench.action.openSettings", "bioviewer.viewer");
    }
  }

  /** Sends one load request to the viewer and settles when the viewer reports its outcome. */
  public async loadContent(payload: LoadPayload): Promise<void> {
    await this.waitForReady();
    if (this._isDisposed) {
      throw new Error("Viewer panel was closed.");
    }
    const requestId = String(++this._nextRequestId);
    BioViewerPanel._outputChannel.appendLine(`loading request ${requestId}: ${payload.command}`);
    return new Promise<void>((resolve, reject) => {
      const fail = (error: Error): void => {
        const pending = this._pendingLoads.get(requestId);
        if (!pending) {
          return;
        }
        clearTimeout(pending.timeout);
        this._pendingLoads.delete(requestId);
        reject(error);
      };
      const timeout = setTimeout(() => {
        fail(new Error(`Loading did not complete within ${BioViewerPanel.LOAD_TIMEOUT_MS / 1000}s.`));
      }, BioViewerPanel.LOAD_TIMEOUT_MS);
      this._pendingLoads.set(requestId, { resolve, reject, timeout });
      const message: ExtensionToWebviewMessage = { ...payload, requestId };
      this._panel.webview.postMessage(message).then(
        (delivered) => {
          if (!delivered) {
            fail(new Error("Failed to deliver loading request to the viewer."));
          }
        },
        (error: unknown) => fail(new Error(getErrorMessage(error))),
      );
    });
  }

  /**
   * Disposes of the panel and cleans up resources
   */
  public dispose(): void {
    if (this._isDisposed) {
      return; // Already disposed, avoid double disposal
    }

    this._isDisposed = true;
    this._isReady = false;
    const error = new Error("Viewer panel was closed.");
    this._rejectReady?.(error);
    this._rejectReady = undefined;
    this._resolveReady = undefined;
    for (const pending of this._pendingLoads.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this._pendingLoads.clear();
    BioViewerPanel._panels.delete(this);

    // Clear the current panel reference if this is the current panel
    if (BioViewerPanel.currentPanel === this) {
      BioViewerPanel.currentPanel = [...BioViewerPanel._panels].pop();
    }

    // Clean up all disposables first (to avoid circular disposal)
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          BioViewerPanel._outputChannel.appendLine(
            `Error: failed to dispose resource - ${error}`,
          );
        }
      }
    }

    // Dispose of the panel only if we haven't already tried
    try {
      if (this._panel) {
        this._panel.dispose();
      }
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(
        `Error: failed to dispose panel - ${error}`,
      );
    }
  }

  /**
   * Generates the HTML content for the webview
   * @param webview - The webview instance
   * @param extensionUri - The extension's URI for resource loading
   * @param viewer - Which viewer interface the panel shows
   * @returns The complete HTML content for the webview
   */
  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    viewer: ViewerKind,
  ): string {
    const startTime = Date.now();
    const asset = (...segments: string[]): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", ...segments)).toString();

    try {
      let template = BioViewerPanel._templates.get(viewer);
      if (template === undefined) {
        const htmlPath = path.join(
          extensionUri.fsPath,
          "dist",
          "webview",
          viewer === "studio" ? "bioviewer.html" : "classic.html",
        );
        template = fs.readFileSync(htmlPath, "utf8");
        BioViewerPanel._templates.set(viewer, template);
        BioViewerPanel._outputChannel.appendLine(
          `cached HTML template from: ${htmlPath}`,
        );
      }

      const values: Record<string, string> = {
        cspSource: webview.cspSource,
        nonce: crypto.randomBytes(16).toString("hex"),
      };
      if (viewer === "studio") {
        const config: WebviewConfig = {
          settings: this._readSettings(),
          displayLanguage: vscode.env.language,
        };
        values.appCssUri = asset("webview", "app.css");
        values.appJsUri = asset("webview", "app.js");
        values.config = escapeAttribute(JSON.stringify(config));
      } else {
        values.molstarCssUri = asset("molstar", "molstar.css");
        values.molstarJsUri = asset("molstar", "molstar.js");
        values.classicCssUri = asset("webview", "classic.css");
        values.classicJsUri = asset("webview", "classic.js");
      }

      const htmlContent = template.replace(/\$\{(\w+)\}/g, (_, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`template placeholder \${${key}} has no value`);
        }
        return value;
      });

      BioViewerPanel._outputChannel.appendLine(
        `webview content generated in ${Date.now() - startTime}ms`,
      );
      return htmlContent;
    } catch (error) {
      const errorMsg = `Failed to generate webview content: ${error}`;
      BioViewerPanel._outputChannel.appendLine(`Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
