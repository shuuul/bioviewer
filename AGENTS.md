# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

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
- `npm run version` - Generate changelog and bump version using commit-and-tag-version
- When updating the extension version (manual or scripted), automatically update `CHANGELOG.md` in the same change.

## Memory

### Release Management
- Automatically update `CHANGELOG.md` whenever the version is updated.

### Packaging
- The `.vscodeignore` file controls VSIX contents. Since esbuild bundles everything into `dist/`, `node_modules/` and source files are excluded. Keep `.vscodeignore` in sync when adding new top-level directories or build artifacts.
- Do NOT add a `"files"` field to `package.json` — it conflicts with `.vscodeignore`.

## Architecture Overview

### Core Components

**Extension Entry Point (`src/extension.ts`)**
- Thin activation layer: registers 5 commands and wires them to command modules
- Uses a shared `BioViewer` output channel and disposes it via `context.subscriptions`

**Webview Panel Management (`src/panels/BioViewerPanel.ts`)**
- Singleton pattern for managing Mol* viewer instances
- Handles secure webview communication with message filtering
- Implements ready-state management for reliable content loading
- Injects React/Mol* webview asset URIs and security context (CSP, nonces)

**Command Modules (`src/commands/*.ts`)**
- `databaseCommands.ts`: database picker + accession prompt + `loadPdb/loadAlphaFoldDb/loadEmdb`
- `fileCommands.ts`: open/add files/folders, panel selection, file reading, and command dispatch
- `fileTypes.ts`: supported extension list, open dialog filters, folder glob pattern, file format/command mapping
- `types.ts`: shared command argument typings

**React + Mol* Webview (`src/webview/main.tsx`, `src/webview/App.tsx`, `src/webview/hooks/*`, `src/webview/components/*`, `src/webview/services/*`)**
- React app mounts UI shell and uses a hook to manage viewer lifecycle and extension messaging
- UI overlay is split into reusable components (`components/ViewerOverlay.tsx`)
- Mol* viewer v5.7.0 initialization and load queue logic live in services (`services/molstarController.ts`)
- Blob URL management and gzip decompression happen in the webview service layer

### Data Flow Architecture

1. **User Interaction** → VS Code commands (Command Palette/Context Menu)
2. **File Processing** → Extension reads file, checks size, converts to appropriate format
3. **Message Passing** → Extension sends structured data to webview via postMessage
4. **Mol* Loading** → Webview processes commands and loads data into Mol* viewer
5. **Feedback Loop** → Webview sends status updates back to extension for user notification

### File Format Handling

**Structure Files**: Read as UTF-8 text, passed directly to Mol* with filename-based labeling
**Volume/Map Files**: Read as binary, converted to base64, then loaded via blob URLs in the webview
**Compressed Files (.gz)**: Automatically detected and decompressed in browser for bandwidth efficiency
**Database Loading**: Direct API calls to PDB, AlphaFold, and EMDB through Mol* viewer methods

### Memory Management Strategy

- File size detection with user warnings for files >50MB
- Blob URL usage instead of data URLs for better memory efficiency
- Browser-side gzip decompression for minimal network transfer (ideal for remote SSH scenarios)
- Automatic cleanup of blob URLs after successful loading
- Truncated logging to prevent console spam with large file content

### Build System

**esbuild Configuration**:
- Bundles extension code into `dist/extension.js` and React webview code into `dist/webview/app.js` + `app.css`
- Copies Mol* library files from node_modules to `dist/molstar/`
- Copies webview HTML template and resources to dist/
- Keeps Mol* runtime local in the VSIX (no runtime JS fetch from CDN)
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

- Use the shared `BioViewer` output channel and `appendLine()` for extension logs
- Always check file size before processing with `vscode.workspace.fs.stat()`
- Test with large files (>50MB) to verify memory handling
- Webview debugging available in VS Code's Output panel ("BioViewer" channel)
- Structure names from CIF files may override custom labels - this is expected Mol* behavior

### Extension Debugging

- Use VS Code launch configuration `Run Extension` in `.vscode/launch.json` (it runs pre-launch task `build`).
- Press `F5` (or Run and Debug -> `Run Extension`) to open an Extension Development Host window.
- Reproduce issues in the Extension Development Host using BioViewer commands from the Command Palette or Explorer context menu.
- Set breakpoints in TypeScript sources under `src/`; source maps map to `dist/**/*.js`.
- Open `Developer: Toggle Developer Tools` in the Extension Development Host to inspect webview console/runtime errors.
- Check the Output panel channel `BioViewer` for extension-side logs emitted by `outputChannel`.
- For test debugging, use launch configuration `Extension Tests` (after `npm run compile-tests`).

### Mol* References

- Official Mol* documentation: [https://molstar.org/docs/](https://molstar.org/docs/)
- For Mol* implementation questions, use the DeepWiki MCP server with `repoName: "molstar/molstar"` via `read_wiki_structure` and `ask_question`
