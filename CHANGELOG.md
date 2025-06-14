# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### [0.0.16](https://github.com/shuuul/bioviewer/compare/v0.0.15...v0.0.16) (2025-06-15)

### 🔧 Bug Fixes

- Downgraded `@types/vscode` to `^1.96.0` to match `engines.vscode` version `^1.96.2`.

### ⚙️ Miscellaneous

- Downgraded `engines.vscode` to `^1.96.2`.

### 📜 Packaging

- Included LICENSE file in the VSIX package.

### [0.0.15](https://github.com/shuuul/bioviewer/compare/v0.0.14...v0.0.15) (2025-06-14)

### 🚀 Performance Improvements

- **Memory Optimization**: Implemented chunked processing for large binary files to prevent browser freezing
- **Smart File Handling**: Added automatic file size detection with user warnings for files >50MB
- **Blob URL Management**: Replaced data URLs with blob URLs for better memory efficiency and proper cleanup

### 🔧 Bug Fixes & Enhancements

- **Webview Communication**: Fixed "Unknown command: undefined" errors by filtering invalid messages
- **Volume Loading**: Fixed `loadVolumeFromData is not a function` error by using correct Mol* API methods
- **File Access**: Resolved 401 download errors by reading file content directly in extension
- **Volume Naming**: Volume/map files now display proper filename-based names instead of blob URLs
- **File Size Display**: Added file size information in logs for better debugging
- **Error Handling**: Improved error messages and user feedback for failed operations

### 📊 Development Improvements

- **Logging**: Reduced verbose output by truncating large file content in logs
- **Debug Information**: Enhanced debugging with detailed timing and performance metrics
- **Code Quality**: Improved error handling and message validation throughout the codebase

### [0.0.13](https://github.com/shuuul/bioviewer/compare/v0.0.12...v0.0.13) (2024-12-XX)

### [0.0.12](https://github.com/shuuul/bioviewer/compare/v0.0.11...v0.0.12) (2024-11-29)

### [0.0.11](https://github.com/shuuul/bioviewer/compare/v0.0.10...v0.0.11) (2024-11-21)

## [0.0.9] - 2024-11-16

- Enhanced logging system throughout the application for better debugging
- Added detailed performance metrics for panel initialization
- Improved error handling with detailed error messages
- Added structured logging with categories
- Added timing metrics for critical operations
- Improved message tracing between webview and extension

## [0.0.8] - 2024-11-15

- Added GitHub Actions workflow for automated releases
- Package extension as .vsix file in releases

## [0.0.7] - 2024-11-15

- Fixed all test cases
- Improved code quality and stability

## [0.0.6] - 2024-09-28

- Downgrade vsce to 1.91.0 to support cursor

## [0.0.5] - 2024-09-26

- Fix bugs in loading PDB files

## [0.0.4] - 2024-09-09

- Fix bugs in communication between VSCode and BioViewer

## [0.0.3] - 2024-09-08

- Fix bugs in loading files from server

## [0.0.2] - 2024-09-08

- Added support for local files, PDB, AlphaFoldDB, EMDB, and volumes

## [0.0.1] - 2024-09-08

- Initial release
