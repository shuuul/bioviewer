import * as vscode from "vscode";
import { BioViewerPanel } from "../panels/BioViewerPanel";
import type { DatabaseCommand } from "../shared/webviewProtocol";

interface DatabaseConfig {
  placeholder: string;
  command: DatabaseCommand;
}

const DATABASE_CONFIG: Record<string, DatabaseConfig> = {
  PDB: { placeholder: "Enter PDB ID (e.g. 6giq)", command: "loadPdb" },
  "AlphaFoldDB (UniProt)": {
    placeholder: "Enter UniProt ID (e.g. P68871)",
    command: "loadAlphaFoldDb"
  },
  EMDB: { placeholder: "Enter EMDB ID (e.g. 1234)", command: "loadEmdb" }
};

export async function openFromDatabase(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  outputChannel.appendLine("Opening structure from database");

  const options = Object.keys(DATABASE_CONFIG);
  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: "Select database type"
  });

  if (!selection) {
    outputChannel.appendLine("User cancelled database selection");
    return;
  }

  outputChannel.appendLine(`User selected: ${selection}`);

  const config = DATABASE_CONFIG[selection];
  if (!config) {
    throw new Error(`Unknown database selection: ${selection}`);
  }

  const accession = await vscode.window.showInputBox({
    placeHolder: config.placeholder,
    prompt: `Enter the ${selection} identifier`
  });

  if (!accession?.trim()) {
    outputChannel.appendLine("User cancelled or entered empty accession");
    return;
  }

  outputChannel.appendLine(`User entered accession: ${accession}`);

  const panel = BioViewerPanel.create(
    context.extensionUri,
    `BioViewer - ${selection}: ${accession}`,
    outputChannel
  );

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready");

  panel.loadContent(config.command, { accession });
  outputChannel.appendLine(`Loading ${selection} structure: ${accession}`);
}
