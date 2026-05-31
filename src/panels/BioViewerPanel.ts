import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  isWebviewToExtensionMessage,
  type ExtensionCommand,
} from "../shared/webviewProtocol";

/**
 * BioViewerPanel manages the webview panel for displaying biological structures
 * using the Mol* viewer. It handles panel creation, content loading, and
 * communication between the extension and the webview.
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

  /** Flag indicating if the webview is ready */
  private _isReady: boolean = false;

  /** Flag indicating if content is currently loading */
  private _isLoading: boolean = false;

  /** Flag indicating if the panel has been disposed */
  private _isDisposed: boolean = false;

  /** Cached HTML template content (read once at module load) */
  private static _cachedHtmlContent: string | null = null;

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
    return this._isLoading;
  }

  /**
   * Private constructor - use static create() method instead
   * @param panel - The VS Code webview panel
   * @param extensionUri - The extension's URI for resource loading
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(
      `initializing panel: ${panel.title}`,
    );

    this._panel = panel;

    // Set up panel disposal handling
    this._panel.onDidDispose(
      () => {
        BioViewerPanel._outputChannel.appendLine(`disposing panel`);
        this._isDisposed = true;
        this.dispose();
      },
      null,
      this._disposables,
    );

    // Initialize ready promise for synchronizing webview readiness
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
    });

    // Set up message handling from webview
    this._setupMessageHandling();

    // Generate and set the webview HTML content
    try {
      if (!this._isDisposed) {
        this._panel.webview.html = this._getWebviewContent(
          this._panel.webview,
          extensionUri,
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
        BioViewerPanel._outputChannel.appendLine(
          `received message from webview: ${JSON.stringify(rawMessage)}`,
        );

        if (!isWebviewToExtensionMessage(rawMessage)) {
          BioViewerPanel._outputChannel.appendLine(
            `Warning: received unexpected webview payload: ${JSON.stringify(rawMessage)}`,
          );
          return;
        }

        switch (rawMessage.command) {
          case "ready":
            BioViewerPanel._outputChannel.appendLine(`webview is ready`);
            this._handleReady();
            BioViewerPanel.currentPanel = this;
            break;

          case "error":
            this._isLoading = false;
            BioViewerPanel._outputChannel.appendLine(
              `Error from webview: ${rawMessage.error}`,
            );
            vscode.window.showErrorMessage(`BioViewer: ${rawMessage.error}`);
            break;

          case "info":
            this._isLoading = false;
            BioViewerPanel._outputChannel.appendLine(
              `info from webview: ${rawMessage.info}`,
            );
            break;

          case "debug":
            BioViewerPanel._outputChannel.appendLine(
              `debug: ${rawMessage.message}`,
            );
            break;
        }
      },
      null,
      this._disposables,
    );
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
   * Waits for the webview to be ready before proceeding
   * @returns Promise that resolves when webview is ready
   */
  public async waitForReady(): Promise<void> {
    if (this._isReady) {
      return Promise.resolve();
    }
    return this._readyPromise;
  }

  /**
   * Creates a new BioViewer panel instance
   * @param extensionUri - The extension's URI for resource loading
   * @param title - The title for the panel (default: "BioViewer")
   * @param outputChannel - The output channel for logging
   * @returns New BioViewerPanel instance
   */
  public static create(
    extensionUri: vscode.Uri,
    title: string = "BioViewer",
    outputChannel: vscode.OutputChannel,
  ): BioViewerPanel {
    const startTime = Date.now();
    BioViewerPanel._outputChannel = outputChannel;

    // Determine the column to place the panel
    const column =
      vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    // Create the webview panel with appropriate options
    const panel = vscode.window.createWebviewPanel("BioViewer", title, column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "dist"),
        vscode.Uri.joinPath(extensionUri, "resources"),
      ],
    });

    const instance = new BioViewerPanel(panel, extensionUri);
    BioViewerPanel._outputChannel.appendLine(
      `panel created in ${Date.now() - startTime}ms`,
    );
    return instance;
  }

  /**
   * Gets the currently active BioViewer panel
   * @returns The current panel instance or undefined if none exists
   */
  public static getCurrentPanel(): BioViewerPanel | undefined {
    return BioViewerPanel.currentPanel;
  }

  /**
   * Loads content into the BioViewer by sending a command to the webview
   * @param command - The command to execute in the webview
   * @param params - Parameters for the command
   */
  public loadContent(
    command: ExtensionCommand,
    params: Record<string, unknown>,
  ): void {
    BioViewerPanel._outputChannel.appendLine(`command: ${command}`);
    // Log parameters without the data content to avoid spam
    const logParams: Record<string, unknown> = { ...params };
    if (typeof logParams.data === "string") {
      const contentType = logParams.isBinary === true ? "binary" : "text";
      logParams.data = `[${contentType} content: ${logParams.data.length} chars]`;
    }
    BioViewerPanel._outputChannel.appendLine(
      `params: ${JSON.stringify(logParams)}`,
    );

    if (!this._isReady) {
      BioViewerPanel._outputChannel.appendLine(
        `Warning: webview may not be ready yet`,
      );
    }

    try {
      this._isLoading = true;
      this._panel.webview.postMessage({ command, ...params });
    } catch (error) {
      this._isLoading = false;
      const errorMsg = `Failed to send message to webview: ${error}`;
      BioViewerPanel._outputChannel.appendLine(`Error: ${errorMsg}`);
      vscode.window.showErrorMessage(`BioViewer: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Disposes of the panel and cleans up resources
   */
  public dispose(): void {
    if (this._isDisposed) {
      return; // Already disposed, avoid double disposal
    }

    this._isDisposed = true;

    // Clear the current panel reference if this is the current panel
    if (BioViewerPanel.currentPanel === this) {
      BioViewerPanel.currentPanel = undefined;
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
   * @returns The complete HTML content for the webview
   */
  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ): string {
    const startTime = Date.now();

    try {
      // Read and cache HTML template on first use
      if (BioViewerPanel._cachedHtmlContent === null) {
        const htmlPath = path.join(
          extensionUri.fsPath,
          "dist",
          "webview",
          "bioviewer.html",
        );
        BioViewerPanel._cachedHtmlContent = fs.readFileSync(htmlPath, "utf8");
        BioViewerPanel._outputChannel.appendLine(
          `cached HTML template from: ${htmlPath}`,
        );
      }

      // Generate URIs for resources
      const molstarCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "molstar", "molstar.css"),
      );
      const molstarJsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "molstar", "molstar.js"),
      );
      const appCssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "webview", "app.css"),
      );
      const appJsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "dist", "webview", "app.js"),
      );
      const cspSource = webview.cspSource;
      const nonce = this._generateNonce();

      // Replace placeholders with actual URIs and security nonce
      const htmlContent = BioViewerPanel._cachedHtmlContent
        .replace(/\$\{molstarCssUri\}/g, molstarCssUri.toString())
        .replace(/\$\{molstarJsUri\}/g, molstarJsUri.toString())
        .replace(/\$\{appCssUri\}/g, appCssUri.toString())
        .replace(/\$\{appJsUri\}/g, appJsUri.toString())
        .replace(/\$\{cspSource\}/g, cspSource)
        .replace(/\$\{nonce\}/g, nonce);

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

  /**
   * Generates a cryptographically secure nonce for Content Security Policy
   * @returns A random 32-character string
   */
  private _generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}
