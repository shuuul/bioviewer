import * as vscode from "vscode";
import { openFromDatabase } from "./commands/databaseCommands";
import { addFiles, addFolderToCurrentPanel, openFiles, openFolder } from "./commands/fileCommands";
import type { FileCommandArg } from "./commands/types";
import { getErrorMessage } from "./shared/errors";

const outputChannel = vscode.window.createOutputChannel("BioViewer");

function registerCommand<T extends unknown[]>(
  command: string,
  handler: (...args: T) => Promise<void>,
): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      const message = getErrorMessage(error);
      outputChannel.appendLine(`Error: ${message}`);
      void vscode.window.showErrorMessage(`BioViewer: ${message}`);
      throw error;
    }
  });
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.appendLine("BioViewer extension is now active");

  const commands = [
    registerCommand("bioviewer.openFromDatabase", () => openFromDatabase(context, outputChannel)),
    registerCommand("bioviewer.openFiles", (fileArg?: FileCommandArg, selectedFiles?: vscode.Uri[]) =>
      openFiles(context, outputChannel, fileArg, selectedFiles)
    ),
    registerCommand("bioviewer.openFolder", (folderUri?: vscode.Uri) =>
      openFolder(context, outputChannel, folderUri)
    ),
    registerCommand("bioviewer.addFiles", (fileArg?: FileCommandArg, selectedFiles?: vscode.Uri[]) =>
      addFiles(context, outputChannel, fileArg, selectedFiles)
    ),
    registerCommand("bioviewer.addFolder", (folderUri?: vscode.Uri) =>
      addFolderToCurrentPanel(context, outputChannel, folderUri)
    )
  ];

  context.subscriptions.push(outputChannel, ...commands);
}

export function deactivate(): void {
  outputChannel.appendLine("BioViewer extension is deactivating");
}
