import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BioViewerPanel } from "../../panels/BioViewerPanel";

const EXTENSION_ID = "shuuul.bioviewer";
const POLL_INTERVAL_MS = 50;

let activationPromise: Promise<void> | undefined;

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  timeoutMessage: string
): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error(timeoutMessage);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function ensureExtensionActivated(): Promise<void> {
  if (!activationPromise) {
    activationPromise = (async () => {
      const extension = vscode.extensions.getExtension(EXTENSION_ID);
      if (!extension) {
        throw new Error(`Extension '${EXTENSION_ID}' is not installed.`);
      }

      if (!extension.isActive) {
        await extension.activate();
      }
    })();
  }

  await activationPromise;
}

export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitFor(
    () => vscode.window.visibleTextEditors.length === 0,
    3000,
    "Timed out waiting for editors to close."
  );
}

export async function disposeCurrentPanel(): Promise<void> {
  const panel = BioViewerPanel.getCurrentPanel();
  if (!panel) {
    return;
  }

  panel.dispose();
  await waitFor(
    () => BioViewerPanel.getCurrentPanel() === undefined,
    3000,
    "Timed out waiting for BioViewer panel disposal."
  );
}

export async function resetUiState(): Promise<void> {
  await disposeCurrentPanel();
  await closeAllEditors();
}

export const EXAMPLES_PATH = path.join(__dirname, "..", "..", "..", "test-resources", "examples");

export function getExampleUri(filename: string): vscode.Uri {
  return vscode.Uri.file(path.join(EXAMPLES_PATH, filename));
}

export function fileExists(uri: vscode.Uri): boolean {
  return fs.existsSync(uri.fsPath);
}
