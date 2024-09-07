import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('BioViewer extension is now active');

	async function showSelectionBox() {
		const options = ['PDB', 'AlphaFoldDB (UniProt)', 'EMDB'];
		const selection = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select file type',
		});
		return selection;
	}

	const helloCommand = vscode.commands.registerCommand("bioviewer.start", async () => {
		const fileType = await showSelectionBox();
		if (fileType === 'PDB') {
			const accession = await showInputBox('Enter a PDB accession (e.g. 1abc)');
			if (accession) {
				console.log(accession);
				BioViewerPanel.renderStructure(context.extensionUri, accession);
			}
		} else if (fileType === 'AlphaFoldDB (UniProt)') {
			const accession = await showInputBox('Enter a UniProt accession for AlphaFoldDB (e.g. P68871)');
			if (accession) {
				console.log(accession);
				BioViewerPanel.renderStructure(context.extensionUri, accession);
			}
		} else if (fileType === 'EMDB') {
			const accession = await showInputBox('Enter an EMDB accession (e.g. 0006)');
			if (accession) {
				console.log(accession);
				BioViewerPanel.renderEMDB(context.extensionUri, accession);
			}
		}
	});

	const activateFromFiles = vscode.commands.registerCommand("bioviewer.activateFromFiles", async (file_uri: vscode.Uri, selectedFiles: vscode.Uri[]) => {
		console.log('file_uri:', file_uri);
		console.log('selectedFiles:', selectedFiles);
		
		let filesToOpen: vscode.Uri[] = [];

		if (!selectedFiles || selectedFiles.length === 0) {
			// If called from command palette or without selection
			const options: vscode.OpenDialogOptions = {
				canSelectMany: true,
				openLabel: 'Open in BioViewer',
				filters: {
					'Supported Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'map', 'mrc']
				}
			};

			filesToOpen = await vscode.window.showOpenDialog(options) || [];
			
			if (filesToOpen.length === 0) {
				vscode.window.showInformationMessage('No files selected for BioViewer');
				return;
			}
		} else {
			// If called from explorer with selected files
			filesToOpen = selectedFiles;
		}
		
		BioViewerPanel.renderFromFiles(context.extensionUri, filesToOpen);
	});

	const activateFromFolder = vscode.commands.registerCommand("bioviewer.activateFromFolder", (folder_uri: vscode.Uri) => {
		vscode.workspace.findFiles(`${vscode.workspace.asRelativePath(folder_uri)}/*.{pdb,cif,mmcif,mcif,ent,map,mrc}`).then((files_uri) => {
			BioViewerPanel.renderFromFiles(context.extensionUri, files_uri);
		});
	});

	const appendFileCommand = vscode.commands.registerCommand("bioviewer.appendFile", async (fileUri?: vscode.Uri) => {
		let filesToAppend: vscode.Uri[] = [];
	  
		if (!fileUri) {
		  // If called from command palette without a file
		  console.info('Appending file from command palette');
		  const options: vscode.OpenDialogOptions = {
			canSelectMany: true,
			openLabel: 'Append',
			filters: {
			  'Supported Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'map', 'mrc', 'ccp4']
			}
		  };
	  
		  filesToAppend = await vscode.window.showOpenDialog(options) || [];
		  console.log('filesToAppend:', filesToAppend);
		  if (filesToAppend.length === 0) {
			vscode.window.showInformationMessage('No files selected to append');
			return;
		  }
		} else {
			console.info('Appending file from explorer');
			filesToAppend = [fileUri];
		}
	  
		const currentPanel = BioViewerPanel.getCurrentPanel();
		if (!currentPanel) {
			console.info('No active BioViewer panel to append to');
			vscode.window.showErrorMessage('No active BioViewer panel to append to');
			return;
		}
		
		for (const file of filesToAppend) {
			console.info('Appending file:', file);
			currentPanel._appendStructureOrVolume(context.extensionUri, file);
		}
	});

	context.subscriptions.push(helloCommand, activateFromFiles, activateFromFolder, appendFileCommand);

}

// This method is called when your extension is deactivated
export function deactivate() {}

async function showInputBox(notification: string) {
	const accession = await vscode.window.showInputBox({
		value: '',
		placeHolder: notification,
	});
	return accession;
}
