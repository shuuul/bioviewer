import * as vscode from 'vscode';
import { BioViewerPanel } from './panels/BioViewerPanel';
import * as path from 'path';

// Output channel for logging extension activities
let outputChannel = vscode.window.createOutputChannel("BioViewer");

/**
 * Activates the BioViewer extension and registers all commands
 * @param context - The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel.appendLine('BioViewer extension is now active');

  // Register all extension commands
  const commands = [
    vscode.commands.registerCommand("bioviewer.openFromDatabase", () => openFromDatabase(context)),
    vscode.commands.registerCommand("bioviewer.openFiles", (fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) => openFiles(context, fileUri, selectedFiles)),
    vscode.commands.registerCommand("bioviewer.openFolder", (folderUri: vscode.Uri) => openFolder(context, folderUri)),
    vscode.commands.registerCommand("bioviewer.addFiles", (fileUri?: vscode.Uri) => addFiles(context, fileUri))
  ];

  context.subscriptions.push(...commands);
}

/**
 * Opens structures from online databases (PDB, AlphaFoldDB, EMDB)
 * Prompts user to select database type and enter accession ID
 * @param context - The extension context
 */
async function openFromDatabase(context: vscode.ExtensionContext) {
  outputChannel.appendLine('Opening structure from database');
  
  // Available database options
  const options = ['PDB', 'AlphaFoldDB (UniProt)', 'EMDB'];
  const selection = await vscode.window.showQuickPick(options, { 
    placeHolder: 'Select database type' 
  });
  
  if (!selection) {
    outputChannel.appendLine('User cancelled database selection');
    return;
  }

  outputChannel.appendLine(`User selected: ${selection}`);
  
  // Get appropriate placeholder text and command for selected database
  const { placeholder, command } = getDatabaseConfig(selection);
  
  const accession = await vscode.window.showInputBox({
    placeHolder: placeholder,
    prompt: `Enter the ${selection} identifier`
  });

  if (!accession?.trim()) {
    outputChannel.appendLine('User cancelled or entered empty accession');
    return;
  }

  outputChannel.appendLine(`User entered accession: ${accession}`);
  
  // Create new panel and load structure
  const panel = BioViewerPanel.create(
    context.extensionUri, 
    `BioViewer - ${selection}: ${accession}`, 
    outputChannel
  );

  // Wait for the panel to be ready before loading structure
  await panel.waitForReady();
  outputChannel.appendLine('Panel is ready');
  
  panel.loadContent(command, { accession: accession });
  outputChannel.appendLine(`Loading ${selection} structure: ${accession}`);
}

/**
 * Gets database-specific configuration for placeholders and commands
 * @param selection - The selected database type
 * @returns Object containing placeholder text and command
 */
function getDatabaseConfig(selection: string): { placeholder: string; command: string } {
  switch (selection) {
    case 'PDB':
      return { placeholder: 'Enter PDB ID (e.g. 6giq)', command: 'loadPdb' };
    case 'AlphaFoldDB (UniProt)':
      return { placeholder: 'Enter UniProt ID (e.g. P68871)', command: 'loadAlphaFoldDb' };
    case 'EMDB':
      return { placeholder: 'Enter EMDB ID (e.g. 1234)', command: 'loadEmdb' };
    default:
      throw new Error(`Unknown database selection: ${selection}`);
  }
}

/**
 * Opens selected files in a new BioViewer panel
 * @param context - The extension context
 * @param fileUri - The primary file URI (when called from context menu)
 * @param selectedFiles - Array of selected files (when multiple files selected)
 */
async function openFiles(context: vscode.ExtensionContext, fileUri: vscode.Uri, selectedFiles: vscode.Uri[]) {
  // Use selected files if available, otherwise prompt user to select files
  const filesToOpen = selectedFiles && selectedFiles.length > 0 ? selectedFiles : await selectFiles();
  
  if (filesToOpen.length === 0) {
    outputChannel.appendLine('No files selected to open');
    return;
  }

  // Create descriptive panel title from file names
  const fileNames = filesToOpen.map(f => path.basename(f.fsPath));
  const title = fileNames.length > 3 
    ? `BioViewer - ${fileNames.slice(0, 2).join(', ')} and ${fileNames.length - 2} more`
    : `BioViewer - ${fileNames.join(', ')}`;
    
  const panel = BioViewerPanel.create(context.extensionUri, title, outputChannel);
  
  outputChannel.appendLine(`Created new panel for ${filesToOpen.length} file(s)`);
  outputChannel.appendLine(`Files: ${filesToOpen.map(f => f.fsPath).join(', ')}`);

  // Wait for the panel to be ready before loading files
  await panel.waitForReady();
  outputChannel.appendLine('Panel is ready, loading files...');

  // Load all files sequentially
  for (const file of filesToOpen) {
    outputChannel.appendLine(`Loading file: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file);
  }
  
  outputChannel.appendLine(`Successfully loaded ${filesToOpen.length} file(s)`);
}

/**
 * Opens all supported files from a folder in a new BioViewer panel
 * @param context - The extension context
 * @param folderUri - The folder URI to scan for supported files
 */
async function openFolder(context: vscode.ExtensionContext, folderUri: vscode.Uri) {
  // Find all supported file types in the folder
  const searchPattern = `${vscode.workspace.asRelativePath(folderUri)}/*.{pdb,cif,mmcif,mcif,ent,map,mrc,ccp4,pdb.gz,cif.gz,mmcif.gz,mcif.gz,ent.gz,map.gz,mrc.gz,ccp4.gz}`;
  const files = await vscode.workspace.findFiles(searchPattern);
  
  if (files.length === 0) {
    vscode.window.showInformationMessage(
      `No supported biological structure files found in folder: ${path.basename(folderUri.fsPath)}`
    );
    outputChannel.appendLine(`No supported files found in folder: ${folderUri.fsPath}`);
    return;
  }

  const folderName = path.basename(folderUri.fsPath);
  const title = `BioViewer - ${folderName} (${files.length} files)`;
  const panel = BioViewerPanel.create(context.extensionUri, title, outputChannel);
  
  outputChannel.appendLine(`Created panel for folder: ${folderName}`);
  outputChannel.appendLine(`Found ${files.length} supported files`);

  // Wait for the panel to be ready before loading files
  await panel.waitForReady();
  outputChannel.appendLine('Panel is ready, loading folder contents...');

  // Load all files from the folder
  for (const file of files) {
    outputChannel.appendLine(`Loading file from folder: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file);
  }
  
  outputChannel.appendLine(`Successfully loaded ${files.length} files from folder: ${folderName}`);
}

/**
 * Adds files to the current BioViewer panel, or creates a new panel if none exists
 * @param context - The extension context
 * @param fileUri - Optional single file URI (when called from context menu)
 */
async function addFiles(context: vscode.ExtensionContext, fileUri?: vscode.Uri) {
  // Get files to add - either the provided file or prompt user to select
  const filesToAdd = fileUri ? [fileUri] : await selectFiles();
  
  if (filesToAdd.length === 0) {
    outputChannel.appendLine('No files selected to add');
    return;
  }

  // Get the current panel or create a new one if none exists
  let panel = BioViewerPanel.getCurrentPanel();
  if (!panel) {
    outputChannel.appendLine('No active panel found, creating new panel');
    panel = BioViewerPanel.create(context.extensionUri, "BioViewer", outputChannel);
    // Wait for the new panel to be ready
    await panel.waitForReady();
    outputChannel.appendLine('New panel created and ready');
  }

  outputChannel.appendLine(`Adding ${filesToAdd.length} file(s) to current panel`);
  
  // Add all files to the current panel
  for (const file of filesToAdd) {
    outputChannel.appendLine(`Adding file: ${path.basename(file.fsPath)}`);
    await loadFile(panel, file);
  }
  
  outputChannel.appendLine(`Successfully added ${filesToAdd.length} file(s) to panel`);
}

/**
 * Loads a file into the specified BioViewer panel
 * Determines the appropriate format and command based on file extension
 * @param panel - The BioViewer panel to load the file into
 * @param fileUri - The URI of the file to load
 */
async function loadFile(panel: BioViewerPanel, fileUri: vscode.Uri): Promise<void> {
  const fileName = path.basename(fileUri.fsPath);
  const originalFilename = fileName; // Keep original filename for compression detection
  let fileExtension = path.extname(fileUri.fsPath).toLowerCase();
  
  // Detect if file is compressed
  const isCompressed = fileExtension === '.gz';
  
  // Handle double extensions like .mrc.gz
  if (fileExtension === '.gz') {
    const baseName = path.basename(fileUri.fsPath, '.gz');
    const innerExtension = path.extname(baseName).toLowerCase();
    if (innerExtension) {
      fileExtension = innerExtension + '.gz';
    }
  }
  
  outputChannel.appendLine(`Processing file: ${fileName} (compressed: ${isCompressed})`);
  
  // Determine format and command based on file extension
  const fileConfig = getFileConfig(fileExtension);
  if (!fileConfig) {
    const errorMsg = `Unsupported file format: ${fileExtension}`;
    outputChannel.appendLine(errorMsg);
    vscode.window.showErrorMessage(`BioViewer: ${errorMsg}`);
    return;
  }

  const { format, command } = fileConfig;
  
  try {
    // Check file size first
    const fileStats = await vscode.workspace.fs.stat(fileUri);
    const fileSizeBytes = fileStats.size;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    
    outputChannel.appendLine(`File size: ${fileSizeMB.toFixed(2)} MB`);
    
    // For very large files (>50MB), warn user and potentially skip
    if (fileSizeMB > 50) {
      const proceed = await vscode.window.showWarningMessage(
        `File ${fileName} is ${fileSizeMB.toFixed(2)} MB. Loading large files may cause performance issues. Continue?`,
        'Yes', 'No'
      );
      if (proceed !== 'Yes') {
        outputChannel.appendLine(`User cancelled loading of large file: ${fileName}`);
        return;
      }
    }
    
    // Read file content (keep compressed for efficient transfer)
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const isBinary = true; // Treat all files as binary for blob URL handling
    
    // Convert file content to base64 for consistent blob handling (keep compressed)
    const data = Buffer.from(fileContent).toString('base64');
    
    // Create clean label without extensions
    let label = path.basename(fileUri.fsPath, path.extname(fileUri.fsPath));
    if (isCompressed) {
      // Remove .gz from label but keep the base format extension
      label = path.basename(label, path.extname(label));
    }
    
    const loadParams = {
      data,
      format,
      isBinary,
      isCompressed, // Pass actual compression status for webview handling
      originalFilename, // Pass original filename for Mol* compression detection
      label,
      fileSize: fileSizeBytes
    };

    outputChannel.appendLine(`Loading with command: ${command}, format: ${format}, compressed: ${isCompressed}`);
    
    panel.loadContent(command, loadParams);
    outputChannel.appendLine(`Successfully queued loading of: ${fileName}`);
  } catch (error) {
    const errorMsg = `Failed to load file: ${fileName}`;
    outputChannel.appendLine(`${errorMsg} - ${error}`);
    vscode.window.showErrorMessage(`BioViewer: ${errorMsg}`);
  }
}

/**
 * Gets file format configuration based on file extension
 * @param extension - The file extension (with dot)
 * @returns File configuration object or null if unsupported
 */
function getFileConfig(extension: string): { format: string; command: string } | null {
  // Handle compressed files by stripping .gz extension
  let actualExtension = extension;
  if (extension.endsWith('.gz')) {
    actualExtension = extension.slice(0, -3);
  }
  
  // Structure file formats
  if (['.pdb', '.ent'].includes(actualExtension)) {
    return { format: 'pdb', command: 'loadStructure' };
  }
  if (['.cif', '.mmcif', '.mcif'].includes(actualExtension)) {
    return { format: 'mmcif', command: 'loadStructure' };
  }
  // Volume/density map formats
  if (['.map', '.mrc', '.ccp4'].includes(actualExtension)) {
    return { format: 'ccp4', command: 'loadVolume' };
  }
  
  return null;
}

/**
 * Prompts user to select biological structure files
 * @returns Array of selected file URIs
 */
async function selectFiles(): Promise<vscode.Uri[]> {
  outputChannel.appendLine('Prompting user to select files');
  
  const options: vscode.OpenDialogOptions = {
    canSelectMany: true,
    openLabel: 'Open in BioViewer',
    title: 'Select Biological Structure Files',
    filters: {
      'All Supported Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'map', 'mrc', 'ccp4', 'pdb.gz', 'cif.gz', 'mmcif.gz', 'mcif.gz', 'ent.gz', 'map.gz', 'mrc.gz', 'ccp4.gz'],
      'Structure Files': ['pdb', 'cif', 'mmcif', 'mcif', 'ent', 'pdb.gz', 'cif.gz', 'mmcif.gz', 'mcif.gz', 'ent.gz'],
      'Volume/Density Maps': ['map', 'mrc', 'ccp4', 'map.gz', 'mrc.gz', 'ccp4.gz']
    }
  };
  
  const result = await vscode.window.showOpenDialog(options);
  const fileCount = result?.length || 0;
  
  outputChannel.appendLine(`User selected ${fileCount} file(s)`);
  if (result && result.length > 0) {
    outputChannel.appendLine(`Selected files: ${result.map(uri => path.basename(uri.fsPath)).join(', ')}`);
  }
  
  return result || [];
}

/**
 * Deactivates the BioViewer extension
 * Called when the extension is deactivated by VS Code
 */
export function deactivate() {
  outputChannel.appendLine('BioViewer extension is deactivating');
  // Cleanup is handled automatically by VS Code for registered commands and disposables
}