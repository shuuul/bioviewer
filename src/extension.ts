import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  console.log('BioViewer extension is now active');

  const commands = [
    vscode.commands.registerCommand("bioviewer.start", () => startBioViewer(context)),
    vscode.commands.registerCommand("bioviewer.activateFromFiles", (fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) => activateFromFiles(context, fileUri, selectedFiles)),
    vscode.commands.registerCommand("bioviewer.activateFromFolder", (folderUri: vscode.Uri) => activateFromFolder(context, folderUri)),
    vscode.commands.registerCommand("bioviewer.appendFile", (fileUri?: vscode.Uri) => appendFile(context, fileUri))
  ];

  context.subscriptions.push(...commands);
}

async function startBioViewer(context: vscode.ExtensionContext) {
  const options = ['PDB', 'AlphaFoldDB (UniProt)', 'EMDB'];
  const selection = await vscode.window.showQuickPick(options, { placeHolder: 'Select file type' });
  
  if (selection) {
    const accession = await vscode.window.showInputBox({
      placeHolder: `Enter ${selection} accession`,
    });

    if (accession) {
      const panel = BioViewerPanel.create(context.extensionUri, `BioViewer - ${selection}`);
      let command = '';
      switch (selection) {
        case 'PDB':
          command = 'loadPdb';
          break;
        case 'AlphaFoldDB (UniProt)':
          command = 'loadAlphaFoldDb';
          break;
        case 'EMDB':
          command = 'loadEmdb';
          break;
      }
      panel.loadContent(command, { accession });
    }
  }
}

async function activateFromFiles(context: vscode.ExtensionContext, fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) {
  let filesToOpen = selectedFiles && selectedFiles.length > 0 ? selectedFiles : await selectFiles();
  if (filesToOpen.length === 0) { return; }

  const title = `BioViewer - ${filesToOpen.map(f => path.basename(f.fsPath)).join(', ')}`;
  const panel = BioViewerPanel.create(context.extensionUri, title);
  
  console.log('New panel created:', panel);
  console.log('Files to open:', filesToOpen);

  // Wait for the panel to be ready before loading files
  await new Promise(resolve => setTimeout(resolve, 500));

  for (const file of filesToOpen) {
    console.log('Loading file in new panel:', file.fsPath);
    await loadFile(panel, file);
  }
}

async function activateFromFolder(context: vscode.ExtensionContext, folderUri: vscode.Uri) {
  const files = await vscode.workspace.findFiles(`${vscode.workspace.asRelativePath(folderUri)}/*.{pdb,cif,mmcif,mcif,ent,map,mrc}`);
  if (files.length === 0) {
    console.log('No supported files found in folder:', folderUri.fsPath);
    return;
  }

  const title = `BioViewer - ${path.basename(folderUri.fsPath)}`;
  const panel = BioViewerPanel.create(context.extensionUri, title);
  
  console.log('New panel created for folder:', panel);
  console.log('Files found in folder:', files);

  // Wait for the panel to be ready before loading files
  await new Promise(resolve => setTimeout(resolve, 500));

  for (const file of files) {
    console.log('Loading file from folder in new panel:', file.fsPath);
    await loadFile(panel, file);
  }
}

async function appendFile(context: vscode.ExtensionContext, fileUri?: vscode.Uri) {
  const filesToAppend = fileUri ? [fileUri] : await selectFiles();
  if (filesToAppend.length === 0) {return;}

  console.log('Current panel before append:', BioViewerPanel.getCurrentPanel());
  
  // Use the current panel if it exists, or create a new one
  const panel = BioViewerPanel.getCurrentPanel() || BioViewerPanel.create(context.extensionUri, "BioViewer");
  
  console.log('Panel used for append:', panel);
  console.log('Is new panel created:', panel === BioViewerPanel.getCurrentPanel());

  filesToAppend.forEach(file => loadFile(panel, file));
}

async function loadFile(panel: BioViewerPanel, fileUri: vscode.Uri) {
  const fileExtension = path.extname(fileUri.fsPath).toLowerCase();
  const webviewUri = panel.getWebviewUri(fileUri);
  const format = ['.pdb', '.cif', '.mmcif', '.mcif'].includes(fileExtension) ? 'mmcif' : 'ccp4';
  const command = format === 'mmcif' ? 'appendStructure' : 'appendVolume';

  console.log('Loading file:', fileUri.fsPath);
  console.log('Command:', command);
  console.log('Params:', {
    url: webviewUri.toString(),
    format,
    isBinary: command === 'appendVolume',
    label: path.basename(fileUri.fsPath, path.extname(fileUri.fsPath))
  });

  return new Promise<void>((resolve) => {
    panel.loadContent(command, {
      url: webviewUri.toString(),
      format,
      isBinary: command === 'appendVolume',
      label: path.basename(fileUri.fsPath, path.extname(fileUri.fsPath))
    });
    
    // Add a small delay to ensure the message is processed
    setTimeout(resolve, 100);
  });
}

async function selectFiles(): Promise<vscode.Uri[]> {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: 'Open in BioViewer',
    filters: {
      'Supported Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'map', 'mrc', 'ccp4']
    }
  };
  const result = await vscode.window.showOpenDialog(options);
  return result || [];
}

export function deactivate() {}
