import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';
import * as path from 'path';

let outputChannel = vscode.window.createOutputChannel("BioViewer");

export function activate(context: vscode.ExtensionContext) {
  outputChannel.appendLine('BioViewer extension is now active');

  const commands = [
    vscode.commands.registerCommand("bioviewer.startBioViewer", () => startBioViewer(context)),
    vscode.commands.registerCommand("bioviewer.activateFromFiles", (fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) => activateFromFiles(context, fileUri, selectedFiles)),
    vscode.commands.registerCommand("bioviewer.activateFromFolder", (folderUri: vscode.Uri) => activateFromFolder(context, folderUri)),
    vscode.commands.registerCommand("bioviewer.appendFile", (fileUri?: vscode.Uri) => appendFile(context, fileUri))
  ];

  context.subscriptions.push(...commands);
}

async function startBioViewer(context: vscode.ExtensionContext) {
  outputChannel.appendLine('Starting BioViewer');
  const options = ['PDB', 'AlphaFoldDB (UniProt)', 'EMDB'];
  const selection = await vscode.window.showQuickPick(options, { placeHolder: 'Select file type' });
  
  if (selection) {
    outputChannel.appendLine(`User selected: ${selection}`);
    let placeholder = '';
    switch (selection) {
      case 'PDB':
        placeholder = 'Enter PDB ID (e.g. 6giq)';
        break;
      case 'AlphaFoldDB (UniProt)':
        placeholder = 'Enter UniProt ID (e.g. P68871)';
        break;
      case 'EMDB':
        placeholder = 'Enter EMDB ID (e.g. 1234)';
        break;
    }

    const accession = await vscode.window.showInputBox({
      placeHolder: placeholder,
    });

    if (accession) {
      outputChannel.appendLine(`User entered accession: ${accession}`);
      let command = '';
      switch (selection) {
        case 'PDB':
          command = 'loadPdb';
          break;
        case 'AlphaFoldDB (UniProt)':
          command = `loadAlphaFoldDb`;
          break;
        case 'EMDB':
          command = `loadEmdb`;
          break;
      }
	  const panel = BioViewerPanel.create(context.extensionUri, `BioViewer - ${selection}-${accession}`, outputChannel);

	  // Wait for the panel to be ready before loading files
    await panel.waitForReady();
    outputChannel.appendLine('Panel is ready');
	  
	  panel.loadContent(command, { accession: accession });
      outputChannel.appendLine(`Sending load command to panel: ${command}`);
    } else {
      outputChannel.appendLine('User cancelled selection');
    }
  }
}

async function activateFromFiles(context: vscode.ExtensionContext, fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) {
  let filesToOpen = selectedFiles && selectedFiles.length > 0 ? selectedFiles : await selectFiles();
  if (filesToOpen.length === 0) { return; }

  const title = `BioViewer - ${filesToOpen.map(f => path.basename(f.fsPath)).join(', ')}`;
  const panel = BioViewerPanel.create(context.extensionUri, title, outputChannel);
  
  outputChannel.appendLine(`New panel created: ${panel}`);
  outputChannel.appendLine(`Files to open: ${filesToOpen}`);

  // Wait for the panel to be ready before loading files
  await panel.waitForReady();
  outputChannel.appendLine('Panel is ready');

  for (const file of filesToOpen) {
    outputChannel.appendLine(`Loading file in new panel: ${file.fsPath}`);
    await loadFile(panel, file);
  }
}

async function activateFromFolder(context: vscode.ExtensionContext, folderUri: vscode.Uri) {
  const files = await vscode.workspace.findFiles(`${vscode.workspace.asRelativePath(folderUri)}/*.{pdb,cif,mmcif,mcif,ent,map,mrc}`);
  if (files.length === 0) {
    outputChannel.appendLine(`No supported files found in folder: ${folderUri.fsPath}`);
    return;
  }

  const title = `BioViewer - ${path.basename(folderUri.fsPath)}`;
  const panel = BioViewerPanel.create(context.extensionUri, title, outputChannel);
  
  outputChannel.appendLine(`New panel created for folder: ${panel}`);
  outputChannel.appendLine(`Files found in folder: ${files}`);

  // Wait for the panel to be ready before loading files
  await panel.waitForReady();
  outputChannel.appendLine('Panel is ready');

  for (const file of files) {
    outputChannel.appendLine(`Loading file from folder in new panel: ${file.fsPath}`);
    await loadFile(panel, file);
  }
}

async function appendFile(context: vscode.ExtensionContext, fileUri?: vscode.Uri) {
  const filesToAppend = fileUri ? [fileUri] : await selectFiles();
  if (filesToAppend.length === 0) {return;}

  // Get the current panel or create a new one if it doesn't exist
  let panel = BioViewerPanel.getCurrentPanel();
  if (!panel) {
    panel = BioViewerPanel.create(context.extensionUri, "BioViewer", outputChannel);
    // Wait for the new panel to be ready
    await panel.waitForReady();
    outputChannel.appendLine('New panel created and ready');
  }

  filesToAppend.forEach(file => loadFile(panel, file));
}

async function loadFile(panel: BioViewerPanel, fileUri: vscode.Uri) {
  outputChannel.appendLine(`Loading file: ${fileUri.fsPath}`);
  const fileExtension = path.extname(fileUri.fsPath).toLowerCase();
  const webviewUri = panel.getWebviewUri(fileUri);
  const format = ['.pdb', '.cif', '.mmcif', '.mcif'].includes(fileExtension) ? 'mmcif' : 'ccp4';
  const command = format === 'mmcif' ? 'appendStructure' : 'appendVolume';

  outputChannel.appendLine(`Command: ${command}`);
  outputChannel.appendLine(`Params: ${JSON.stringify({
    url: webviewUri.toString(),
    format,
    isBinary: command === 'appendVolume',
    label: path.basename(fileUri.fsPath, path.extname(fileUri.fsPath))
  })}`);

  return new Promise<void>((resolve) => {
    panel.loadContent(command, {
      url: webviewUri.toString(),
      format,
      isBinary: command === 'appendVolume',
      label: path.basename(fileUri.fsPath, path.extname(fileUri.fsPath))
    });
  });
}

async function selectFiles(): Promise<vscode.Uri[]> {
  outputChannel.appendLine('Prompting user to select files');
  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: 'Open in BioViewer',
    filters: {
      'Supported Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'map', 'mrc', 'ccp4']
    }
  };
  const result = await vscode.window.showOpenDialog(options);
  outputChannel.appendLine(`User selected files: ${result?.map(uri => uri.fsPath).join(', ') || 'None'}`);
  return result || [];
}

export function deactivate() {
  outputChannel.appendLine('BioViewer extension is deactivating');
}
