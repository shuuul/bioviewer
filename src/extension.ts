import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('BioViewer extension is now active');

	async function showSelectionBox() {
		const options = ['PDB', 'AlphaFoldDB (UniProt)'];
		const selection = await vscode.window.showQuickPick(options, {
			placeHolder: 'Select file type',
		});
		return selection;
	}

	const helloCommand = vscode.commands.registerCommand("bioviewer.start", async () => {
		const fileType = await showSelectionBox();
		if (fileType === 'PDB') {
			const accession = await showInputBox();
			if (accession) {
				console.log(accession);
				BioViewerPanel.render(context.extensionUri, accession);
			}
		} else if (fileType === 'AlphaFoldDB (UniProt)') {
			const accession = await showInputBox();
			if (accession) {
				console.log(accession);
				BioViewerPanel.render(context.extensionUri, accession);
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

	context.subscriptions.push(helloCommand, activateFromFiles, activateFromFolder);

}

// This method is called when your extension is deactivated
export function deactivate() {}

async function showInputBox() {
	const accession = await vscode.window.showInputBox({
		value: '',
		placeHolder: 'Enter a PDB or AlphaFoldDB (UniProt) accession',
	});
	return accession;
}

async function showSequenceInputBox() {
	const sequence = await vscode.window.showInputBox({
		value: '',
		placeHolder: 'Enter a protein sequence',
	});
	return sequence;
}

async function writeFoldToFile(file_contents: string) {
	const time = new Date().getTime();
	const fname = "/esmfold_" + time.toString() + ".pdb";

	const setting: vscode.Uri = vscode.Uri.parse("untitled:" + (vscode.workspace.workspaceFolders?.[0].uri.fsPath || '') + fname);
	await vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
		vscode.window.showTextDocument(a, 1, false).then(e => {
			e.edit(edit => {
				edit.insert(new vscode.Position(0, 0), file_contents);
				a.save();
			});
		});
	});

	console.log("wrote to test file.");
	console.log(setting);
	return setting.fsPath;
}
