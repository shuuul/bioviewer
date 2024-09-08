import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class BioViewerPanel {
  public static currentPanel: BioViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private static _outputChannel: vscode.OutputChannel;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    BioViewerPanel._outputChannel.appendLine(`BioViewerPanel constructed with title: ${panel.title}`);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Update the current panel when this panel becomes active
    this._panel.onDidChangeViewState(
      e => {
        if (this._panel.active) {
          BioViewerPanel.currentPanel = this;
        }
      },
      null,
      this._disposables
    );

    // Set this as the current panel immediately upon creation
    BioViewerPanel.currentPanel = this;
  }

  public static create(extensionUri: vscode.Uri, title: string = "BioViewer", outputChannel: vscode.OutputChannel): BioViewerPanel {
    BioViewerPanel._outputChannel = outputChannel;
    BioViewerPanel._outputChannel.appendLine(`Creating new BioViewerPanel with title: ${title}`);
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    const panel = vscode.window.createWebviewPanel(
      "BioViewer",
      title,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    return new BioViewerPanel(panel, extensionUri);
  }

  public static getCurrentPanel(): BioViewerPanel | undefined {
    return BioViewerPanel.currentPanel;
  }

  public loadContent(command: string, params: any) {
    BioViewerPanel._outputChannel.appendLine(`Sending message to webview: ${JSON.stringify({ command, ...params })}`);
    this._panel.webview.postMessage({ command, ...params });
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
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'webview', 'bioviewer.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'molstar', 'molstar.js'));
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
}
