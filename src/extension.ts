import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';
const path = require('node:path');

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('BioViewer extension is now active');

	const helloCommand = vscode.commands.registerCommand("bioviewer.start", () => {
		vscode.window.showInputBox().then((accession) => {
			console.log(accession);
			BioViewerPanel.render(context.extensionUri, accession);
		});
	});

	const activateFromFiles = vscode.commands.registerCommand("bioviewer.activateFromFiles", (file_uri: vscode.Uri, selectedFiles: vscode.Uri[]) => {
		console.log(file_uri);
		console.log(selectedFiles);
		BioViewerPanel.renderFromFiles(context.extensionUri, selectedFiles);
	});

	const activateFromFolder = vscode.commands.registerCommand("bioviewer.activateFromFolder", (folder_uri: vscode.Uri) => {
		vscode.workspace.findFiles(`${vscode.workspace.asRelativePath(folder_uri)}/*.{pdb,cif,mmcif,mcif,ent,map,mrc}`).then((files_uri) => {
			BioViewerPanel.renderFromFiles(context.extensionUri, files_uri);
		});
	});

	context.subscriptions.push(helloCommand, activateFromFiles, activateFromFolder);

}

// This method is called when your extension is deactivated
export function deactivate() {

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

}
