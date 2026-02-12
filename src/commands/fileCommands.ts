import * as path from "path";
import * as vscode from "vscode";
import { BioViewerPanel } from "../panels/BioViewerPanel";
import { buildFileFilters, buildSearchPattern, getFileConfig } from "./fileTypes";
import type { FileCommandArg } from "./types";

function resolveCommandFiles(fileArg?: FileCommandArg, selectedFiles?: vscode.Uri[]): vscode.Uri[] {
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

function getRelativeFolderPattern(folderUri: vscode.Uri): string {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  return vscode.workspace.asRelativePath(folderUri) || path.relative(workspaceRoot, folderUri.fsPath);
}

async function selectFiles(outputChannel: vscode.OutputChannel): Promise<vscode.Uri[]> {
  outputChannel.appendLine("Prompting user to select files");

  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: "Open in BioViewer",
    title: "Select Biological Structure Files",
    filters: buildFileFilters()
  };

  const result = await vscode.window.showOpenDialog(options);
  const fileCount = result?.length || 0;

  outputChannel.appendLine(`User selected ${fileCount} file(s)`);
  if (result && result.length > 0) {
    outputChannel.appendLine(`Selected files: ${result.map((uri) => path.basename(uri.fsPath)).join(", ")}`);
  }

  return result || [];
}

async function findSupportedFolderFiles(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
  const relativePath = getRelativeFolderPattern(folderUri);
  const searchPattern = buildSearchPattern(relativePath);
  return vscode.workspace.findFiles(searchPattern);
}

async function getOrCreateCurrentPanel(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<BioViewerPanel> {
  let panel = BioViewerPanel.getCurrentPanel();
  if (!panel) {
    outputChannel.appendLine("No active panel found, creating new panel");
    panel = BioViewerPanel.create(context.extensionUri, "BioViewer", outputChannel);
    await panel.waitForReady();
    outputChannel.appendLine("New panel created and ready");
    return panel;
  }

  outputChannel.appendLine("Using existing panel");
  return panel;
}

async function loadFile(
  panel: BioViewerPanel,
  fileUri: vscode.Uri,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const fileName = path.basename(fileUri.fsPath);
  let fileExtension = path.extname(fileUri.fsPath).toLowerCase();
  const isCompressed = fileExtension === ".gz";

  if (fileExtension === ".gz") {
    const baseName = path.basename(fileUri.fsPath, ".gz");
    const innerExtension = path.extname(baseName).toLowerCase();
    if (innerExtension) {
      fileExtension = `${innerExtension}.gz`;
    }
  }

  outputChannel.appendLine(`Processing file: ${fileName} (compressed: ${isCompressed})`);

  const fileConfig = getFileConfig(fileExtension);
  if (!fileConfig) {
    const errorMessage = `Unsupported file format: ${fileExtension}`;
    outputChannel.appendLine(errorMessage);
    vscode.window.showErrorMessage(`BioViewer: ${errorMessage}`);
    return;
  }

  try {
    const fileStats = await vscode.workspace.fs.stat(fileUri);
    const fileSizeBytes = fileStats.size;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    outputChannel.appendLine(`File size: ${fileSizeMB.toFixed(2)} MB`);
    if (fileSizeMB > 50) {
      outputChannel.appendLine(`Loading large file: ${fileName} (${fileSizeMB.toFixed(2)} MB)`);
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
      label
    };

    outputChannel.appendLine(
      `Loading with command: ${fileConfig.command}, format: ${fileConfig.format}, compressed: ${isCompressed}`
    );
    panel.loadContent(fileConfig.command, loadParams);
    outputChannel.appendLine(`Successfully queued loading of: ${fileName}`);
  } catch (error) {
    const errorMessage = `Failed to load file: ${fileName}`;
    outputChannel.appendLine(`${errorMessage} - ${error}`);
    vscode.window.showErrorMessage(`BioViewer: ${errorMessage}`);
  }
}

export async function openFiles(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  fileArg?: FileCommandArg,
  selectedFiles?: vscode.Uri[]
): Promise<void> {
  const resolvedFiles = resolveCommandFiles(fileArg, selectedFiles);
  const filesToOpen = resolvedFiles.length > 0 ? resolvedFiles : await selectFiles(outputChannel);

  if (filesToOpen.length === 0) {
    outputChannel.appendLine("No files selected to open");
    return;
  }

  const fileNames = filesToOpen.map((file) => path.basename(file.fsPath));
  const title =
    fileNames.length > 3
      ? `BioViewer - ${fileNames.slice(0, 2).join(", ")} and ${fileNames.length - 2} more`
      : `BioViewer - ${fileNames.join(", ")}`;

  const panel = BioViewerPanel.create(context.extensionUri, title, outputChannel);

  outputChannel.appendLine(`Created new panel for ${filesToOpen.length} file(s)`);
  outputChannel.appendLine(`Files: ${filesToOpen.map((file) => file.fsPath).join(", ")}`);

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, loading files...");

  for (const file of filesToOpen) {
    outputChannel.appendLine(`Loading file: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file, outputChannel);
  }

  outputChannel.appendLine(`Successfully loaded ${filesToOpen.length} file(s)`);
}

export async function openFolder(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  folderUri?: vscode.Uri
): Promise<void> {
  if (!folderUri) {
    outputChannel.appendLine("No folder provided to open");
    return;
  }

  const files = await findSupportedFolderFiles(folderUri);
  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`
    );
    outputChannel.appendLine(`No supported files found in folder: ${folderUri.fsPath}`);
    return;
  }

  const folderName = path.basename(folderUri.fsPath);
  const panel = BioViewerPanel.create(
    context.extensionUri,
    `BioViewer - ${folderName} (${files.length} files)`,
    outputChannel
  );

  outputChannel.appendLine(`Created panel for folder: ${folderName}`);
  outputChannel.appendLine(`Found ${files.length} supported files`);

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, loading folder contents...");

  for (const file of files) {
    outputChannel.appendLine(`Loading file from folder: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file, outputChannel);
  }

  outputChannel.appendLine(`Successfully loaded ${files.length} files from folder: ${folderName}`);
}

export async function addFiles(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  fileArg?: FileCommandArg,
  selectedFiles?: vscode.Uri[]
): Promise<void> {
  const resolvedFiles = resolveCommandFiles(fileArg, selectedFiles);
  const filesToAdd = resolvedFiles.length > 0 ? resolvedFiles : await selectFiles(outputChannel);

  outputChannel.appendLine(`[addFiles] Selected ${filesToAdd.length} files`);
  if (filesToAdd.length > 0) {
    outputChannel.appendLine(`[addFiles] Files: ${filesToAdd.map((file) => path.basename(file.fsPath)).join(", ")}`);
  }

  if (filesToAdd.length === 0) {
    outputChannel.appendLine("No files selected to add");
    return;
  }

  const panel = await getOrCreateCurrentPanel(context, outputChannel);

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, adding files...");
  outputChannel.appendLine(`Adding ${filesToAdd.length} file(s) to current panel`);

  for (let index = 0; index < filesToAdd.length; index++) {
    const file = filesToAdd[index];
    outputChannel.appendLine(`[addFiles] Processing file ${index + 1}/${filesToAdd.length}: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file, outputChannel);
    outputChannel.appendLine(`[addFiles] Completed loading file ${index + 1}/${filesToAdd.length}: ${path.basename(file.fsPath)}`);
  }

  outputChannel.appendLine(`[addFiles] Successfully added ${filesToAdd.length} file(s) to panel`);
}

export async function addFolderToCurrentPanel(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  folderUri?: vscode.Uri
): Promise<void> {
  if (!folderUri) {
    outputChannel.appendLine("No folder provided to append");
    return;
  }

  const files = await findSupportedFolderFiles(folderUri);
  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`
    );
    outputChannel.appendLine(`No supported files found in folder: ${folderUri.fsPath}`);
    return;
  }

  const folderName = path.basename(folderUri.fsPath);
  outputChannel.appendLine(`[addFolderToCurrentPanel] Found ${files.length} supported files in folder: ${folderName}`);
  outputChannel.appendLine(`[addFolderToCurrentPanel] Files: ${files.map((file) => path.basename(file.fsPath)).join(", ")}`);

  const panel = await getOrCreateCurrentPanel(context, outputChannel);

  await panel.waitForReady();
  outputChannel.appendLine("Panel is ready, adding folder contents...");
  outputChannel.appendLine(`Adding ${files.length} file(s) from folder: ${folderName} to current panel`);

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    outputChannel.appendLine(`[addFolderToCurrentPanel] Processing file ${index + 1}/${files.length}: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file, outputChannel);
    outputChannel.appendLine(`[addFolderToCurrentPanel] Completed loading file ${index + 1}/${files.length}: ${path.basename(file.fsPath)}`);
  }

  outputChannel.appendLine(`[addFolderToCurrentPanel] Successfully added ${files.length} file(s) from folder: ${folderName} to panel`);
}
