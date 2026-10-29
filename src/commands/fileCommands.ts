import * as path from "path";
import { promisify } from "util";
import * as vscode from "vscode";
import { gzip } from "zlib";
import { BioViewerPanel } from "../panels/BioViewerPanel";
import { getErrorMessage } from "../shared/errors";
import {
  buildFileFilters,
  getFileConfig,
  isSupportedFileName,
} from "./fileTypes";
import type { FileLoad } from "../shared/webviewProtocol";
import type { FileCommandArg } from "./types";

function resolveCommandFiles(
  fileArg?: FileCommandArg,
  selectedFiles?: vscode.Uri[],
): vscode.Uri[] {
  if (Array.isArray(fileArg)) {
    return fileArg;
  }

  if (selectedFiles && selectedFiles.length > 0) {
    return selectedFiles;
  }

  if (fileArg) {
    return [fileArg];
  }

  return [];
}

/** Directory names never scanned when loading a folder recursively */
const SKIPPED_FOLDER_NAMES = new Set(["node_modules"]);

export async function findSupportedFolderFiles(
  folderUri: vscode.Uri,
): Promise<vscode.Uri[]> {
  const files: vscode.Uri[] = [];
  await collectSupportedFiles(folderUri, files);
  return files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}

/** Finds the folder's supported files, telling the user when there are none. */
async function findFolderFilesOrNotify(
  folderUri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
): Promise<vscode.Uri[]> {
  const files = await findSupportedFolderFiles(folderUri);
  if (files.length === 0) {
    void vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`,
    );
    outputChannel.appendLine(`no supported files found in folder: ${folderUri.fsPath}`);
  }
  return files;
}

async function collectSupportedFiles(
  folderUri: vscode.Uri,
  files: vscode.Uri[],
): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(folderUri);

  for (const [name, fileType] of entries) {
    // Only plain directories and files are followed; symlinks report
    // FileType.SymbolicLink, which keeps directory cycles out of the walk.
    if (fileType === vscode.FileType.Directory) {
      if (name.startsWith(".") || SKIPPED_FOLDER_NAMES.has(name)) {
        continue;
      }
      await collectSupportedFiles(vscode.Uri.joinPath(folderUri, name), files);
    } else if (fileType === vscode.FileType.File && isSupportedFileName(name)) {
      files.push(vscode.Uri.joinPath(folderUri, name));
    }
  }
}

async function selectFiles(
  outputChannel: vscode.OutputChannel,
): Promise<vscode.Uri[]> {
  outputChannel.appendLine("Prompting user to select files");

  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: "Open in BioViewer",
    title: "Select Biological Structure Files",
    filters: buildFileFilters(),
  };

  const result = await vscode.window.showOpenDialog(options);
  const fileCount = result?.length || 0;

  outputChannel.appendLine(`user selected ${fileCount} file(s)`);
  if (result && result.length > 0) {
    outputChannel.appendLine(
      `files selected: ${result.map((uri) => path.basename(uri.fsPath)).join(", ")}`,
    );
  }

  return result || [];
}

function getOrCreateCurrentPanel(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
): BioViewerPanel {
  const panel = BioViewerPanel.currentPanel;
  if (panel) {
    return panel;
  }
  outputChannel.appendLine("no open panel, creating one");
  return BioViewerPanel.create(context, "BioViewer", outputChannel);
}

/** Remote sessions gzip uncompressed files above this size before sending them to the local viewer. */
const REMOTE_GZIP_MIN_BYTES = 1024 * 1024;
const gzipAsync = promisify(gzip);

/** Reads a file into the load request the viewer expects. */
async function readFileLoad(fileUri: vscode.Uri, outputChannel: vscode.OutputChannel): Promise<FileLoad> {
  const fileName = path.basename(fileUri.fsPath);
  const fileConfig = getFileConfig(fileName);
  if (!fileConfig) {
    throw new Error(`Unsupported file format: ${fileName}`);
  }

  const bytes = await vscode.workspace.fs.readFile(fileUri);
  const sizeMB = (bytes.byteLength / (1024 * 1024)).toFixed(2);
  // The webview runs on the local machine, so in a remote session every byte crosses the network.
  if (vscode.env.remoteName && !fileConfig.isCompressed && bytes.byteLength >= REMOTE_GZIP_MIN_BYTES) {
    const compressed = await gzipAsync(bytes, { level: 1 });
    outputChannel.appendLine(
      `read file: ${fileName} (${sizeMB} MB, sending ${(compressed.byteLength / (1024 * 1024)).toFixed(2)} MB gzip)`,
    );
    return { ...fileConfig, isCompressed: true, data: plainBytes(compressed) };
  }
  outputChannel.appendLine(`read file: ${fileName} (${sizeMB} MB, ${fileConfig.format})`);
  return { ...fileConfig, data: plainBytes(bytes) };
}

/** A Node Buffer's toJSON would make postMessage send a plain object instead of transferring bytes. */
function plainBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** Loads files in order, reading the next file from disk while the viewer parses the current one. */
async function loadFiles(
  panel: BioViewerPanel,
  files: vscode.Uri[],
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  await panel.waitForReady();
  const failures: string[] = [];
  const read = (index: number) => {
    const reading = readFileLoad(files[index], outputChannel);
    // Failures surface when the read is awaited; this keeps an early prefetch from going unhandled.
    reading.catch(() => {});
    return reading;
  };

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: "BioViewer" },
    async (progress) => {
      let next = read(0);
      for (let index = 0; index < files.length; index++) {
        const fileName = path.basename(files[index].fsPath);
        const current = next;
        if (index + 1 < files.length) {
          next = read(index + 1);
        }
        progress.report({ message: files.length > 1 ? `loading ${fileName} (${index + 1}/${files.length})` : `loading ${fileName}` });
        try {
          await panel.loadContent(await current);
          outputChannel.appendLine(`file loaded: ${fileName}`);
        } catch (error) {
          const message = `${fileName}: ${getErrorMessage(error)}`;
          failures.push(message);
          outputChannel.appendLine(`Error: failed to load ${message}`);
        }
      }
    },
  );

  outputChannel.appendLine(
    `loaded ${files.length - failures.length} of ${files.length} file(s); ${failures.length} failed`,
  );
  if (failures.length > 0) {
    throw new Error(
      `Failed to load ${failures.length} of ${files.length} file(s): ${failures.join("; ")}`,
    );
  }
}

export async function openFiles(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  fileArg?: FileCommandArg,
  selectedFiles?: vscode.Uri[],
): Promise<void> {
  const resolvedFiles = resolveCommandFiles(fileArg, selectedFiles);
  const filesToOpen =
    resolvedFiles.length > 0 ? resolvedFiles : await selectFiles(outputChannel);

  if (filesToOpen.length === 0) {
    outputChannel.appendLine("No files selected to open");
    return;
  }

  const fileNames = filesToOpen.map((file) => path.basename(file.fsPath));
  const title =
    fileNames.length > 3
      ? `BioViewer - ${fileNames.slice(0, 2).join(", ")} and ${fileNames.length - 2} more`
      : `BioViewer - ${fileNames.join(", ")}`;

  const panel = BioViewerPanel.create(
    context,
    title,
    outputChannel,
  );

  await loadFiles(panel, filesToOpen, outputChannel);
}

export async function openFolder(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  folderUri?: vscode.Uri,
): Promise<void> {
  if (!folderUri) {
    outputChannel.appendLine("No folder provided to open");
    return;
  }

  const files = await findFolderFilesOrNotify(folderUri, outputChannel);
  if (files.length === 0) {
    return;
  }

  const panel = BioViewerPanel.create(
    context,
    `BioViewer - ${path.basename(folderUri.fsPath)} (${files.length} files)`,
    outputChannel,
  );
  await loadFiles(panel, files, outputChannel);
}

export async function addFiles(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  fileArg?: FileCommandArg,
  selectedFiles?: vscode.Uri[],
): Promise<void> {
  const resolvedFiles = resolveCommandFiles(fileArg, selectedFiles);
  const filesToAdd =
    resolvedFiles.length > 0 ? resolvedFiles : await selectFiles(outputChannel);

  if (filesToAdd.length === 0) {
    outputChannel.appendLine("No files selected to add");
    return;
  }

  const panel = getOrCreateCurrentPanel(context, outputChannel);
  await loadFiles(panel, filesToAdd, outputChannel);
}

export async function addFolderToCurrentPanel(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  folderUri?: vscode.Uri,
): Promise<void> {
  if (!folderUri) {
    outputChannel.appendLine("No folder provided to append");
    return;
  }

  const files = await findFolderFilesOrNotify(folderUri, outputChannel);
  if (files.length === 0) {
    return;
  }

  const panel = getOrCreateCurrentPanel(context, outputChannel);
  await loadFiles(panel, files, outputChannel);
}
