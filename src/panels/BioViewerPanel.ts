import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class BioViewerPanel {
  public static currentPanel: BioViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private static _outputChannel: vscode.OutputChannel;
  private _readyPromise: Promise<void>;
  private _resolveReady: (() => void) | undefined;
  private _isReady: boolean = false;
  private _isLoading: boolean = false;

  // Static log method for testing
  public static log(message: string) {
    if (BioViewerPanel._outputChannel) {
      BioViewerPanel._outputChannel.appendLine(message);
    }
  }

  // Getter for testing
  public get isReady(): boolean {
    return this._isReady;
  }

  // Getter for testing
  public get isLoading(): boolean {
    return this._isLoading;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(`[Constructor] Initializing BioViewerPanel with panel ID: ${panel.title}`);
    
    this._panel = panel;
    
    this._panel.onDidDispose(() => {
      BioViewerPanel._outputChannel.appendLine(`[Dispose] Panel ${panel.title} is being disposed`);
      this.dispose();
    }, null, this._disposables);
    
    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
      BioViewerPanel._outputChannel.appendLine(`[Constructor] Ready promise initialized`);
    });

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        BioViewerPanel._outputChannel.appendLine(`[Message] Received message from webview: ${JSON.stringify(message)}`);
        switch (message.command) {
          case 'ready':
            BioViewerPanel._outputChannel.appendLine(`[Message] Processing 'ready' command`);
            this.handleReady();
            BioViewerPanel.currentPanel = this;
            break;
          default:
            BioViewerPanel._outputChannel.appendLine(`[Message] Unknown command received: ${message.command}`);
        }
      },
      null,
      this._disposables
    );

    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
    BioViewerPanel._outputChannel.appendLine(`[Constructor] Panel initialization completed in ${Date.now() - startTime}ms`);
  }

  private handleReady() {
    BioViewerPanel._outputChannel.appendLine('Webview is ready');
    if (this._resolveReady) {
      this._resolveReady();
      this._resolveReady = undefined;
    }
  }

  public async waitForReady(): Promise<void> {
    return this._readyPromise;
  }

  public static create(extensionUri: vscode.Uri, title: string = "BioViewer", outputChannel: vscode.OutputChannel): BioViewerPanel {
    const startTime = Date.now();
    BioViewerPanel._outputChannel = outputChannel;
    BioViewerPanel._outputChannel.appendLine(`[Create] Creating new BioViewerPanel instance`);
    BioViewerPanel._outputChannel.appendLine(`[Create] Title: ${title}, Extension URI: ${extensionUri.toString()}`);
    
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    BioViewerPanel._outputChannel.appendLine(`[Create] Using view column: ${column || 'One (default)'}`);

    const panel = vscode.window.createWebviewPanel(
      "BioViewer",
      title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    const instance = new BioViewerPanel(panel, extensionUri);
    BioViewerPanel._outputChannel.appendLine(`[Create] BioViewerPanel created successfully in ${Date.now() - startTime}ms`);
    return instance;
  }

  public static getCurrentPanel(): BioViewerPanel | undefined {
    return BioViewerPanel.currentPanel;
  }

  public loadContent(command: string, params: any) {
    BioViewerPanel._outputChannel.appendLine(`[LoadContent] Loading content with command: ${command}`);
    BioViewerPanel._outputChannel.appendLine(`[LoadContent] Parameters: ${JSON.stringify(params, null, 2)}`);
    
    try {
      this._panel.webview.postMessage({ command, ...params });
      BioViewerPanel._outputChannel.appendLine(`[LoadContent] Message posted successfully`);
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(`[LoadContent] Error posting message: ${error}`);
      throw error;
    }
  }

  public dispose() {
    BioViewerPanel._outputChannel.appendLine(`Disposing BioViewerPanel: ${this._panel.title}`);
    BioViewerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const startTime = Date.now();
    BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Generating webview content`);
    
    try {
      const htmlPath = path.join(extensionUri.fsPath, 'dist', 'webview', 'bioviewer.html');
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Reading HTML from: ${htmlPath}`);
      
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] HTML file read successfully`);

      const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.css'));
      const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.js'));
      const nonce = this.getNonce();

      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Resources prepared:`);
      BioViewerPanel._outputChannel.appendLine(`  CSS URI: ${cssUri}`);
      BioViewerPanel._outputChannel.appendLine(`  JS URI: ${jsUri}`);

      htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
      htmlContent = htmlContent.replace('${jsUri}', jsUri.toString());
      htmlContent = htmlContent.replace('${nonce}', nonce.toString());

      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Content generated successfully in ${Date.now() - startTime}ms`);
      return htmlContent;
    } catch (error) {
      BioViewerPanel._outputChannel.appendLine(`[GetWebviewContent] Error generating content: ${error}`);
      throw error;
    }
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
}