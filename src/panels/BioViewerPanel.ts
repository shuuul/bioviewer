import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class BioViewerPanel {
  public static currentPanel: BioViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
  }

  public static createOrShow(extensionUri: vscode.Uri, title: string = "BioViewer"): BioViewerPanel {
    if (BioViewerPanel.currentPanel) {
      BioViewerPanel.currentPanel._panel.reveal();
      return BioViewerPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "BioViewer",
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    BioViewerPanel.currentPanel = new BioViewerPanel(panel, extensionUri);
    return BioViewerPanel.currentPanel;
  }

  public loadContent(command: string, params: any) {
    this._panel.webview.postMessage({ command, ...params });
  }

  public dispose() {
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

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.js'));
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
