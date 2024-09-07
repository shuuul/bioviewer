# BioViewer README

The package is a wrapper around the Mol* library to allow for the display of biological structures and volumes in VS Code.

## Features

- Display PDB, AlphaFoldDB, EMDB, and local files in the Mol* viewer
- Display volumes in the Mol* volume viewer
- Display local files in the VS Code text editor

## Usage

- Open a file in VS Code
- Use the `BioViewer: Start` command to open the BioViewer
- Use the `BioViewer: Append File` command to append a file to the BioViewer
- Use the `BioViewer: Activate from Files` command to activate the BioViewer from a file
- Use the `BioViewer: Activate from Folder` command to activate the BioViewer from a folder

## Requirements

- VS Code 1.93.0 or later
- Mol* library

## Extension Settings

This extension does not contribute any settings through the `contributes.configuration` extension point.

## Known Issues

- The extension may not work with all file types.
- The extension may not work with all file sizes.
- The extension may not work with all file formats.

## Release Notes

- 0.0.1: Initial release
- 0.0.2: Added support for local files, PDB, AlphaFoldDB, EMDB, and volumes

## Contributing

This extension is built using TypeScript and ESBuild. If you want to contribute to the extension, please open an issue or a pull request.

## License

This extension is licensed under the MIT License. See the LICENSE file for more details.
