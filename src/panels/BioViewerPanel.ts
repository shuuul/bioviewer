import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class BioViewerPanel {
  public static currentPanel: BioViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  protected static _outputChannel: vscode.OutputChannel;
  private _readyPromise: Promise<void>;
  private _resolveReady: (() => void) | undefined;
  private _rejectReady: ((reason: any) => void) | undefined;
  private _isReady: boolean = false;
  private _isLoading: boolean = false;
  private _isInitialized: boolean = false;

  public get panel(): vscode.WebviewPanel {
    return this._panel;
  }

  public get isLoading(): boolean {
    return this._isLoading;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    BioViewerPanel.currentPanel = this;

    // Initialize ready promise
    this._readyPromise = new Promise<void>((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady = reject;
    });

    BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Constructor called with title: ${panel.title}`);
    
    // Set up message handling first
    this._panel.webview.onDidReceiveMessage(
      message => {
        BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Received message: ${JSON.stringify(message)}`);
        switch (message.command) {
          case 'ready':
            BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Received ready signal');
            if (!this._isReady) {  // Only set ready once
              this._isReady = true;
              if (this._resolveReady) {
                this._resolveReady();
              }
            }
            break;
          case 'error':
            BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Received error: ${message.error}`);
            break;
          case 'loaded':
            BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Content loaded successfully');
            this._isLoading = false;
            break;
          case 'loading':
            BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Content loading started');
            this._isLoading = true;
            break;
        }
      },
      undefined,
      this._disposables
    );

    // Track panel disposal
    this._panel.onDidDispose(() => {
      BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Panel disposed');
      // Only clear currentPanel if it's this instance
      if (BioViewerPanel.currentPanel === this) {
        BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Clearing current panel reference');
        BioViewerPanel.currentPanel = undefined;
      }
      this.dispose();
    }, null, this._disposables);

    // Set up webview content
    try {
      this._panel.webview.html = this._getWebviewContent(extensionUri);
      BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Webview HTML content set');
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Error setting webview content: ${error}`);
      throw error;
    }

    // Track panel visibility
    this._panel.onDidChangeViewState(e => {
      BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Panel visibility changed: ${e.webviewPanel.visible}`);
      if (e.webviewPanel.visible && !this._isInitialized) {
        this._isInitialized = true;
        BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Panel became visible for the first time');
      }
    });

    // Add error handler for webview
    this._panel.webview.onDidReceiveMessage(message => {
      if (message.command === 'error') {
        BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Webview error: ${message.error}`);
      }
    });
  }

  public dispose() {
    BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Disposing panel');
    // Only clear currentPanel if it's this instance
    if (BioViewerPanel.currentPanel === this) {
      BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Clearing current panel reference');
      BioViewerPanel.currentPanel = undefined;
    }

    // Dispose of disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    // Dispose of panel last
    this._panel.dispose();
  }

  public async waitForReady(): Promise<void> {
    BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Waiting for ready state');
    try {
      await this._readyPromise;
      BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Ready state achieved');
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(`[BioViewerPanel] Failed to reach ready state: ${error}`);
      throw error;
    }
  }

  public static create(extensionUri: vscode.Uri, title: string = "BioViewer", outputChannel: vscode.OutputChannel): BioViewerPanel {
    BioViewerPanel._outputChannel = outputChannel;
    outputChannel.show(true);

    // If we already have a panel, dispose it properly
    if (BioViewerPanel.currentPanel) {
      BioViewerPanel._outputChannel.appendLine('[BioViewerPanel] Disposing existing panel');
      BioViewerPanel.currentPanel.dispose();
      BioViewerPanel.currentPanel = undefined;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'bioviewer',
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    outputChannel.appendLine(`[BioViewerPanel] Creating new panel with title: ${title}`);
    const newPanel = new BioViewerPanel(panel, extensionUri);
    BioViewerPanel.currentPanel = newPanel;
    return newPanel;
  }

  public static async createAndWait(extensionUri: vscode.Uri, title: string = "BioViewer", outputChannel: vscode.OutputChannel): Promise<BioViewerPanel> {
    const panel = BioViewerPanel.create(extensionUri, title, outputChannel);
    await panel.waitForReady();
    return panel;
  }

  public static getCurrentPanel(): BioViewerPanel | undefined {
    return BioViewerPanel.currentPanel;
  }

  public loadContent(command: string, params: any) {
    BioViewerPanel._outputChannel.appendLine(`Sending message to webview: ${JSON.stringify({ command, ...params })}`);
    this._panel.webview.postMessage({ command, ...params });
  }

  private _getWebviewContent(extensionUri: vscode.Uri) {
    const htmlPath = path.join(extensionUri.fsPath, 'dist', 'webview', 'bioviewer.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.css'));
    const jsUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.js'));
    const nonce = this.getNonce();

    htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
    htmlContent = htmlContent.replace('${jsUri}', jsUri.toString());
    htmlContent = htmlContent.replace('${nonce}', nonce.toString());

    return htmlContent;
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public getWebviewUri(uri: vscode.Uri): vscode.Uri {
    return this._panel.webview.asWebviewUri(uri);
  }

  // Get the webview panel
  public getWebviewPanel(): vscode.WebviewPanel {
    return this._panel;
  }

  public static log(message: string): void {
    if (this._outputChannel) {
      this._outputChannel.appendLine(message);
    }
  }
}
