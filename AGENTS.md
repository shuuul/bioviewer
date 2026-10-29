# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Coding Rules

### Core Defaults

- Default to forward development.
- Do not preserve backward compatibility unless explicitly requested.
- Prefer the simplest implementation that satisfies the requirement.
- Remove dead code, obsolete branches, compatibility layers, unused parameters, and stale helper functions during edits.
- Keep public APIs small and direct.

### Abstraction and Code Shape

- Do not add thin wrapper functions that only rename a function, forward arguments, or mirror an existing API.
- Add a wrapper only when it contributes at least one of:
  - domain meaning,
  - input validation,
  - output normalization,
  - composition of multiple operations,
  - a materially clearer call boundary.
- Do not duplicate logic across files or functions.
- Extract shared code only when the abstraction is clearer than the repeated code.
- Prefer one obvious implementation for each behavior.
- Merge overlapping helpers and remove single-use indirection.

### Interfaces and Data Flow

- Keep interfaces compact and explicit.
- Add parameters only when the current task requires them.
- Avoid speculative extensibility.
- Prefer direct data flow over layered indirection.
- Prefer structured outputs over ad hoc dictionaries and loosely shaped blobs.

### Validation and Failure Semantics

- Validate external inputs at boundaries.
- Fail loudly when required data, required outputs, or required intermediate artifacts are missing.
- Preserve useful failure signals.
- Raise explicit, domain-appropriate errors when validation fails.
- Do not swallow exceptions.
- Do not add silent fallback paths for required behavior.

### Readability and Maintainability

- Prefer readability over cleverness.
- Prefer explicit control flow over dense one-liners.
- Keep nesting shallow.
- Split files when they contain multiple unrelated responsibilities.
- Write comments only for non-obvious logic, invariants, edge cases, or algorithmic intent.
- Keep comments factual and concise.

### Anti-Patterns

- Thin wrappers with no behavioral value.
- Redundant helpers that duplicate existing code paths.
- Silent fallback logic for required data.
- Broad exception handling with vague recovery.
- Compatibility shims added by default.
- Dead branches kept "just in case".
- Comment noise that restates the code.

## Essential Commands

### Development Workflow
- `npm run compile` - Full build: type check, lint, and build extension
- `npm run watch` - Start development mode with auto-rebuild and type checking
- `npm run check-types` - TypeScript type checking only
- `npm run lint` - ESLint code quality checks
- `npm run test` - Run all tests using vscode-test framework
- `uvx prek run --all-files` - Run pre-commit checks; use `uvx prek`, not `pre-commit`

### Testing & Packaging
- `npm run compile-tests` - Compile test files to out/ directory
- `npm run test:vsix` - Build and install extension locally for testing
- `npm run build:vsix` - Package extension into releases/bioviewer.vsix
- `npm run clean` - Clean build artifacts from dist/ and out/ directories

### Release Management
- `npm run version` - Generate changelog and bump version using commit-and-tag-version
- To publish a release, push a tag that matches `package.json` version after the release commit is on `origin/master`: `VERSION=$(node -p "require('./package.json').version"); git tag "v$VERSION"; git push origin "v$VERSION"`. The `v*` tag triggers `.github/workflows/release.yml`, which packages the VSIX once and uploads it to the GitHub Release, the VS Code Marketplace and Open VSX.
- When updating the extension version (manual or scripted), automatically update `CHANGELOG.md` in the same change.
- Update `CHANGELOG.md` for every user-visible behavior change, format support change, command/menu change, or documented workflow change, even when the extension version is not bumped.
- Keep `package.json` `engines.vscode` aligned with the current Cursor VS Code Extension API (`^1.128.0`).
- Do not include Amp as a co-author in commit messages.

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
- One instance per webview tab; `currentPanel` tracks the most recently active tab for the "add to current tab" commands
- Handles secure webview communication with message filtering
- Implements ready-state management and correlated load acknowledgements; commands wait for Mol* completion and reject failed loads
- Injects webview asset URIs, security context (CSP, nonces) and the initial `WebviewConfig` (persisted viewer settings + VS Code display language)
- Chooses the viewer from the `bioviewer.viewer` setting (`studio` → `bioviewer.html` + `app.js`; `classic` → `classic.html`, Mol*'s prebuilt `dist/molstar/molstar.js`, its `light.css`/`dark.css` skins and `classic.js`) and shows a one-time notification (`globalState` flag) the first time the studio viewer opens
- Persists viewer settings (language, custom colors) in `globalState`, saves exported images via `showSaveDialog`, and forwards the viewer's "Open file" action to `bioviewer.addFiles`

**Command Modules (`src/commands/*.ts`)**
- `databaseCommands.ts`: database picker + accession prompt + `loadPdb/loadAlphaFoldDb/loadEmdb`
- `fileCommands.ts`: open/add files/folders (recursive folder scan via `vscode.workspace.fs.readDirectory`), panel selection, file reading, and command dispatch
- `fileTypes.ts`: supported extension list, open dialog filters, supported-filename matching, file format/command mapping
- `types.ts`: shared command argument typings

**React Webview (`src/webview/main.tsx`, `src/webview/App.tsx`, `src/webview/classic.ts`, `src/webview/hooks/*`, `src/webview/services/*`)**
- The UI is `<Studio>` from the published `@molstudio/react` package (Mol* v5.13.1 via `@molstudio/core`); BioViewer only supplies theme, locale, settings and `saveFile`
- `services/extensionBridge.ts`: extension messaging for both viewers: runs loads once a viewer is attached, reports startup failures (`startupFailed` rejects the panel's readiness), correlates image saves
- `classic.ts` + `services/classicBackend.ts`: the classic viewer entry; adapts Mol*'s prebuilt `Viewer` (`window.molstar`) to the same `ViewerBackend` the load queue uses
- `services/vscodeTheme.ts`: reads the VS Code body theme class and watches it; `hooks/useVsCodeTheme.ts` feeds it to the Studio theme, and `classic.ts` swaps the Mol* skin and canvas background
- `services/viewerController.ts`: `ViewerBackend` interface and the serial load queue, gzip decoding, CMM markers via Mol*'s PLY reader
- Type-checked by `src/webview/tsconfig.json` (bundler resolution, since `@molstudio/*` is ESM-only); the root `tsconfig.json` excludes `src/webview`
- Change viewer UI behavior in the molstudio repository and publish a new version instead of patching it here

### Data Flow Architecture

1. **User Interaction** → VS Code commands (Command Palette/Context Menu)
2. **File Processing** → Extension reads the file (prefetching the next one in a batch) and, in remote sessions, gzips uncompressed files over 1 MB
3. **Message Passing** → Extension sends structured data to webview via postMessage
4. **Mol* Loading** → Webview processes commands and loads data through MolStudio
5. **Feedback Loop** → Webview returns a correlated success/failure result after loading; the extension settles the command and reports batch counts

### File Format Handling

**Structure and Volume/Map Files**: Read as bytes and posted as a `Uint8Array` (VS Code transfers typed arrays without re-encoding); the webview decodes structures to text (Mol* would read bytes as BinaryCIF) and passes maps as bytes, labeled by filename
**Compressed Files (.gz)**: Automatically detected and decompressed in browser for bandwidth efficiency
**Database Loading**: `MolStudio.loadPdb/loadAlphaFoldDb/loadEmdb` (PDBe, AlphaFold DB, EMDB)

### Memory Management Strategy

- File sizes are logged when read; there is no size confirmation dialog
- Browser-side gzip decompression for minimal network transfer (ideal for remote SSH scenarios)
- Truncated logging to prevent console spam with large file content

### Build System

**esbuild Configuration**:
- Bundles extension code into `dist/extension.js`, the React webview into `dist/webview/app.js` + `app.css`, and the classic viewer entry into `dist/webview/classic.js` + `classic.css`
- Bundles the Mol* modules MolStudio imports into `app.js` and the MolStudio stylesheet into `app.css` (no separate Mol* runtime, no CDN)
- Copies both webview HTML templates, Mol*'s prebuilt viewer (`molstar.js` and the `theme/light.css`/`theme/dark.css` skins → `dist/molstar/`, classic viewer only) and resources to dist/
- Supports watch mode for development with problem matcher integration

**Key Build Plugins**:
- `copyHtmlPlugin` - Copies the studio and classic webview templates (placeholders are filled by the panel)
- `copyMolstarPlugin` - Copies Mol*'s prebuilt viewer for the classic viewer
- `copyResourcesPlugin` - Copies static assets (icons, etc.)

### Error Handling Patterns

- **Webview Communication**: Filters undefined commands and invalid messages
- **File Loading**: Each file in a batch settles separately; the command reports failed files and counts
- **Large Files**: Sizes are logged when read; files load without a confirmation dialog
- **API Failures**: Comprehensive error reporting with specific failure reasons

## Logging Conventions

### Extension-Side Logging (`outputChannel.appendLine`)

All extension-side logs follow these rules:
- Use plain English sentences with **no bracket prefixes** (`[Constructor]`, `[Create]`, etc.)
- Start with a lowercase verb — present tense for ongoing actions, past tense for completed ones:
  - `creating panel...` → `panel created (42ms)`
  - `loading file: example.cif` → `file loaded: example.cif`
- Use `Warning: ` prefix for warnings
- Use `Error: ` prefix for errors
- Use `debug: ` prefix for diagnostic details forwarded from the webview
- Append timing in parentheses: `panel created in 42ms`
- Keep messages concise and human-readable

### Webview-Side Logging (`emitInfo` / `emitError` / `emitDebug`)

- Use `emitInfo()` for successful results: `"Loaded PDB: 6giq"`
- Use `emitError()` for failures: `"Failed to load PDB 6giq: connection timed out"`
- Use `emitDebug()` for diagnostic details: `"decompressing gzip content in webview"`
- Messages should be short, descriptive, and consistent with extension-side style

### Development Notes

- Use the shared `BioViewer` output channel and `appendLine()` for extension logs
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
