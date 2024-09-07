import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class BioViewerPanel {
  public static currentPanel: BioViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, accession: string | undefined, clickedFiles: vscode.Uri[] | undefined) {
    this._panel = panel;
    if (this._panel) {
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      if (accession !== undefined) {
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, accession);
      }
      if (clickedFiles !== undefined) {
        this._panel.webview.html = this._getWebviewContentForFiles(this._panel.webview, extensionUri, clickedFiles);
      }
    }
  }

  public static renderStructure(extensionUri: vscode.Uri, accession: string | undefined) {
    const windowName = "Protein Viewer - " + accession;
    const panel = vscode.window.createWebviewPanel("BioViewer", windowName, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    if (accession?.length === 4) {
      var loadCommand = `viewer.loadPdb('${accession}');`;
    } else {
      var loadCommand = `viewer.loadAlphaFoldDb('${accession}');`;
    }
    BioViewerPanel.currentPanel = new BioViewerPanel(panel, extensionUri, loadCommand, undefined);
  }

  public static renderEMDB(extensionUri: vscode.Uri, accession: string | undefined) {
    const windowName = "EMDB Viewer - " + accession;
    const panel = vscode.window.createWebviewPanel("BioViewer", windowName, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    var loadCommand = `viewer.loadEmdb('emd-${accession}');`;
    BioViewerPanel.currentPanel = new BioViewerPanel(panel, extensionUri, loadCommand, undefined);
  }

  public static renderFromFiles(extensionUri: vscode.Uri, clickedFiles: vscode.Uri[]) {
    if (!clickedFiles || clickedFiles.length === 0) {
        vscode.window.showErrorMessage('No files provided to BioViewer');
        return;
    }

    const fnames = clickedFiles.map((clickedFile) => clickedFile.path.split('/').pop());
    const windowName = "Protein Viewer - " + fnames.join(" - ");
    const panel = vscode.window.createWebviewPanel("BioViewer", windowName, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    BioViewerPanel.currentPanel = new BioViewerPanel(panel, extensionUri, undefined, clickedFiles);
  }

  public dispose() {
    BioViewerPanel.currentPanel = undefined;

    if (this._panel) {
      this._panel.dispose();
    }

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, accession: string | undefined) {
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'webview', 'bioviewer-single.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.js'));
    const nonce = this.getNonce();

    htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
    htmlContent = htmlContent.replace('${jsUri}', jsUri.toString());
    htmlContent = htmlContent.replace('${nonce}', nonce.toString());
    htmlContent = htmlContent.replace('${accession}', accession || '');

    return htmlContent;
  }

  private _getWebviewContentForFiles(webview: vscode.Webview, extensionUri: vscode.Uri, clickedFiles: vscode.Uri[]) {
    const htmlPath = path.join(extensionUri.fsPath, 'src', 'webview', 'bioviewer-multiple.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.js'));
    const nonce = this.getNonce();

    const bioContents = clickedFiles.map((clickedFile) => 
        webview.asWebviewUri(vscode.Uri.file(clickedFile.fsPath)).toString()
      );
    const extensions = clickedFiles.map((clickedFile) => clickedFile.path.split('.').pop()?.toLocaleLowerCase());
    let loadCommands: String[] = [];
    for (let i = 0; i < bioContents.length; i++) {
      const bioContent = bioContents[i];
      var extension = extensions[i] ?? 'mmcif';
      console.info('extension: ', extension);

      if (['cif', 'mmcif', 'mcif'].includes(extension.toLowerCase())) {
        extension = 'mmcif';
        console.info('bioContent: ', bioContent);
        console.info('extension: ', extension);
        const label = path.basename(bioContent, path.extname(bioContent));
        console.info('label: ', label);
        loadCommands.push(
          `viewer.loadStructureFromUrl('${bioContent}', format='${extension}', label='${label}');`
        );
      } else if (['mrc', 'map', 'ccp4'].includes(extension.toLowerCase())) {
        extension = 'ccp4';
        console.info('bioContent: ', bioContent);
        console.info('extension: ', extension);

        // get file name from bioContent as entryId
        const entryId = path.basename(bioContent, path.extname(bioContent));
        console.info('entryId: ', entryId);

        loadCommands.push(`
            viewer.loadVolumeFromUrl(
              { url: '${bioContent}', format: '${extension}', isBinary: true },
              [{ type: 'absolute', value: 0.1, alpha: 0.34, entryId: '${entryId}'}]
            ).catch(error => console.error('Error loading volume:', error));
          `);
      }
    }

    console.info('loadCommands: ', loadCommands);

    htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
    htmlContent = htmlContent.replace('${jsUri}', jsUri.toString());
    htmlContent = htmlContent.replace('${nonce}', nonce.toString());
    htmlContent = htmlContent.replace('${loadCommands}', loadCommands.join('\n'));

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
}
