# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.4](https://github.com/shuuul/bioviewer/compare/v0.1.3...v0.1.4) (2025-06-24)


### Features

* add 'Add Folder to Current Panel' command ([20c0dd3](https://github.com/shuuul/bioviewer/commit/20c0dd3561dff7eb77d3add5b126f67db3b54f26))

### [0.1.3](https://github.com/shuuul/bioviewer/compare/v0.1.2...v0.1.3) (2025-06-23)

### [0.1.2](https://github.com/shuuul/bioviewer/compare/v0.1.0...v0.1.2) (2025-06-18)


### Features

* update extension functionality and documentation ([9d71bd5](https://github.com/shuuul/bioviewer/commit/9d71bd56866a0a87a6b1d3cbaef987bd9882092b))

## [0.1.0](https://github.com/shuuul/bioviewer/compare/v0.0.16...v0.1.0) (2025-06-17)

### 🚀 New Features

- **Compressed File Support**: Added automatic .gz file detection and browser-side decompression
- **Volume Naming Fix**: MRC/MAP volumes now display correct filename instead of blob URL prefix
- **Remote SSH Optimization**: Compressed files transfer efficiently over network connections

### 🔧 Technical Improvements

- **Browser-side Decompression**: Uses native `DecompressionStream` API for optimal performance
- **Bandwidth Efficiency**: Compressed files stay compressed during transfer to save network bandwidth
- **Volume Management**: Enhanced volume loading with proper format detection and renaming logic

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
