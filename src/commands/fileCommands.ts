import * as path from "path";
import * as vscode from "vscode";
import { BioViewerPanel } from "../panels/BioViewerPanel";
import {
  buildFileFilters,
  getFileConfig,
  isSupportedFileName,
} from "./fileTypes";
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
  let panel = BioViewerPanel.getCurrentPanel();
  if (!panel) {
    outputChannel.appendLine("No active panel found, creating new panel");
    panel = BioViewerPanel.create(
      context.extensionUri,
      "BioViewer",
      outputChannel,
    );
    return panel;
  }

  outputChannel.appendLine("Using existing panel");
  return panel;
}

async function loadFile(
  panel: BioViewerPanel,
  fileUri: vscode.Uri,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const fileName = path.basename(fileUri.fsPath);
  let fileExtension = path.extname(fileUri.fsPath).toLowerCase();
  const isCompressed = fileExtension === ".gz";

  if (fileExtension === ".gz") {
    const baseName = fileName.slice(0, -3);
    const innerExtension = path.extname(baseName).toLowerCase();
    if (innerExtension) {
      fileExtension = `${innerExtension}.gz`;
    }
  }

  outputChannel.appendLine(
    `Processing file: ${fileName} (compressed: ${isCompressed})`,
  );

  const fileConfig = getFileConfig(fileExtension);
  if (!fileConfig) {
    const errorMessage = `Unsupported file format: ${fileExtension}`;
    throw new Error(errorMessage);
  }

  const fileStats = await vscode.workspace.fs.stat(fileUri);
  const fileSizeBytes = fileStats.size;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  outputChannel.appendLine(`File size: ${fileSizeMB.toFixed(2)} MB`);
  if (fileSizeMB > 50) {
    outputChannel.appendLine(
      `Loading large file: ${fileName} (${fileSizeMB.toFixed(2)} MB)`,
    );
  }

  const fileContent = await vscode.workspace.fs.readFile(fileUri);
  const data = Buffer.from(fileContent).toString("base64");

  let label = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath));
  if (isCompressed) {
    label = path.basename(label, path.extname(label));
  }

  const loadParams = {
    data,
    format: fileConfig.format,
    isBinary: true,
    isCompressed,
    label,
  };

  outputChannel.appendLine(
    `Loading with command: ${fileConfig.command}, format: ${fileConfig.format}, compressed: ${isCompressed}`,
  );
  await panel.loadContent(fileConfig.command, loadParams);
  outputChannel.appendLine(`file loaded: ${fileName}`);
}

async function loadFiles(
  panel: BioViewerPanel,
  files: vscode.Uri[],
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const failures: string[] = [];
  for (const file of files) {
    try {
      await loadFile(panel, file, outputChannel);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = `${path.basename(file.fsPath)}: ${reason}`;
      failures.push(message);
      outputChannel.appendLine(`Error: failed to load ${message}`);
    }
  }

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
    context.extensionUri,
    title,
    outputChannel,
  );

  outputChannel.appendLine(
    `created new panel for ${filesToOpen.length} file(s)`,
  );
  outputChannel.appendLine(
    `loading ${filesToOpen.length} file(s) from: ${filesToOpen.map((file) => file.fsPath).join(", ")}`,
  );

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, loading files...");

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

  const files = await findSupportedFolderFiles(folderUri);
  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`,
    );
    outputChannel.appendLine(
      `No supported files found in folder: ${folderUri.fsPath}`,
    );
    return;
  }

  const folderName = path.basename(folderUri.fsPath);
  const panel = BioViewerPanel.create(
    context.extensionUri,
    `BioViewer - ${folderName} (${files.length} files)`,
    outputChannel,
  );

  outputChannel.appendLine(`Created panel for folder: ${folderName}`);
  outputChannel.appendLine(`Found ${files.length} supported files`);

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, loading folder contents...");

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

  await panel.waitForReady();
  outputChannel.appendLine(
    `Adding ${filesToAdd.length} file(s) to current panel`,
  );

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

  const files = await findSupportedFolderFiles(folderUri);
  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`,
    );
    outputChannel.appendLine(
      `No supported files found in folder: ${folderUri.fsPath}`,
    );
    return;
  }

  const folderName = path.basename(folderUri.fsPath);
  outputChannel.appendLine(
    `Found ${files.length} supported files in folder: ${folderName}`,
  );

  const panel = getOrCreateCurrentPanel(context, outputChannel);

  await panel.waitForReady();
  outputChannel.appendLine(
    `Adding ${files.length} file(s) from folder: ${folderName} to current panel`,
  );

  await loadFiles(panel, files, outputChannel);
}
