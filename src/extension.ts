import * as vscode from "vscode";
import { openFromDatabase } from "./commands/databaseCommands";
import { addFiles, addFolderToCurrentPanel, openFiles, openFolder } from "./commands/fileCommands";
import type { FileCommandArg } from "./commands/types";

const outputChannel = vscode.window.createOutputChannel("BioViewer");

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.appendLine("BioViewer extension is now active");

  const commands = [
    vscode.commands.registerCommand("bioviewer.openFromDatabase", () => openFromDatabase(context, outputChannel)),
    vscode.commands.registerCommand("bioviewer.openFiles", (fileArg?: FileCommandArg, selectedFiles?: vscode.Uri[]) =>
      openFiles(context, outputChannel, fileArg, selectedFiles)
    ),
    vscode.commands.registerCommand("bioviewer.openFolder", (folderUri?: vscode.Uri) =>
      openFolder(context, outputChannel, folderUri)
    ),
    vscode.commands.registerCommand("bioviewer.addFiles", (fileArg?: FileCommandArg, selectedFiles?: vscode.Uri[]) =>
      addFiles(context, outputChannel, fileArg, selectedFiles)
    ),
    vscode.commands.registerCommand("bioviewer.addFolder", (folderUri?: vscode.Uri) =>
      addFolderToCurrentPanel(context, outputChannel, folderUri)
    )
  ];

  context.subscriptions.push(outputChannel, ...commands);
}

export function deactivate(): void {
  outputChannel.appendLine("BioViewer extension is deactivating");
}
