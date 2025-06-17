# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Workflow
- `npm run compile` - Full build: type check, lint, and build extension
- `npm run watch` - Start development mode with auto-rebuild and type checking
- `npm run check-types` - TypeScript type checking only
- `npm run lint` - ESLint code quality checks
- `npm run test` - Run all tests using vscode-test framework

### Testing & Packaging
- `npm run compile-tests` - Compile test files to out/ directory
- `npm run test:vsix` - Build and install extension locally for testing
- `npm run build:vsix` - Package extension into releases/bioviewer.vsix
- `npm run clean` - Clean build artifacts from dist/ and out/ directories

### Release Management
- `npm run version` - Generate changelog and bump version using standard-version
- `npm run commit` - Create conventional commits using commitizen

## Architecture Overview

### Core Components

**Extension Entry Point (`src/extension.ts`)**
- Registers 4 main commands: openFromDatabase, openFiles, openFolder, addFiles
- Manages file loading logic with memory optimization for large files (>50MB warning)
- Handles file format detection: structures (.pdb, .cif, .mmcif, .ent) and volumes (.mrc, .map, .ccp4)
- Supports compressed files (.gz) with browser-side decompression for bandwidth efficiency
- Implements chunked reading for binary files to prevent memory issues

**Webview Panel Management (`src/panels/BioViewerPanel.ts`)**
- Singleton pattern for managing Mol* viewer instances
- Handles secure webview communication with message filtering
- Implements ready-state management for reliable content loading
- Manages resource URIs and security context (CSP, nonces)

**Mol* Integration (`src/webview/bioviewer.html`)**
- Embeds Mol* viewer v4.18.0 for molecular visualization
- Handles multiple loading methods: database APIs, local file data, volume rendering
- Implements blob URL management for efficient memory usage with large files
- Provides command routing for structure/volume loading and error handling

### Data Flow Architecture

1. **User Interaction** → VS Code commands (Command Palette/Context Menu)
2. **File Processing** → Extension reads file, checks size, converts to appropriate format
3. **Message Passing** → Extension sends structured data to webview via postMessage
4. **Mol* Loading** → Webview processes commands and loads data into Mol* viewer
5. **Feedback Loop** → Webview sends status updates back to extension for user notification

### File Format Handling

**Structure Files**: Read as UTF-8 text, passed directly to Mol* with filename-based labeling
**Volume/Map Files**: Read as binary, converted to base64, processed in 1MB chunks to prevent browser freezing
**Compressed Files (.gz)**: Automatically detected and decompressed in browser for bandwidth efficiency
**Database Loading**: Direct API calls to PDB, AlphaFold, and EMDB through Mol* viewer methods

### Memory Management Strategy

- File size detection with user warnings for files >50MB
- Chunked processing for large binary files (1MB chunks)
- Blob URL usage instead of data URLs for better memory efficiency
- Browser-side gzip decompression for minimal network transfer (ideal for remote SSH scenarios)
- Automatic cleanup of blob URLs after successful loading
- Truncated logging to prevent console spam with large file content

### Build System

**esbuild Configuration**: 
- Bundles TypeScript extension code into single `dist/extension.js`
- Copies Mol* library files from node_modules to `dist/molstar/`
- Copies webview HTML template and resources to appropriate dist/ subdirectories
- Supports watch mode for development with problem matcher integration

**Key Build Plugins**:
- `copyMolstarPlugin` - Ensures Mol* viewer files are available to webview
- `copyHtmlPlugin` - Copies webview template with placeholder replacement
- `copyResourcesPlugin` - Copies static assets (icons, etc.)

### Error Handling Patterns

- **Webview Communication**: Filters undefined commands and invalid messages
- **File Loading**: Graceful degradation with user feedback for unsupported formats
- **Memory Issues**: Proactive file size checking with user confirmation dialogs
- **API Failures**: Comprehensive error reporting with specific failure reasons

### Development Notes

- Use `BioViewerPanel.log()` for consistent logging across the extension
- Always check file size before processing with `vscode.workspace.fs.stat()`
- Test with large files (>50MB) to verify memory handling
- Webview debugging available in VS Code's Output panel ("BioViewer" channel)
- Structure names from CIF files may override custom labels - this is expected Mol* behavior

### Extension Debugging

- Set breakpoints in TypeScript source files (works with source maps)
- Use F5 or "Run Extension" launch configuration for debugging
- Monitor webview console through Developer Tools when webview is focused
- Check VS Code Output panel "BioViewer" channel for extension logs