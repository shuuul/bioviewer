# BioViewer

[![Version](https://img.shields.io/visual-studio-marketplace/v/shuuul.bioviewer)](https://marketplace.visualstudio.com/items?itemName=shuuul.bioviewer)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/shuuul.bioviewer)](https://marketplace.visualstudio.com/items?itemName=shuuul.bioviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

BioViewer is a powerful Visual Studio Code extension for visualizing biological macrostructures and electron microscopy data. Built on top of the latest **Mol* library (v4.18.0)**, it provides seamless integration for viewing and analyzing structural biology data directly within your IDE.

## 🧬 Features

### Database Integration
- **PDB Database**: Load structures directly using PDB IDs (e.g., 6giq)
- **AlphaFold Database**: Visualize AI-predicted protein structures using UniProt IDs (e.g., P68871)
- **EMDB Database**: Access electron microscopy structures using EMDB IDs (e.g., 1234)

### File Format Support
- **Structure Files**: PDB (.pdb), mmCIF (.cif, .mmcif, .mcif), ENT (.ent)
- **Density Maps**: MRC (.mrc), MAP (.map), CCP4 (.ccp4)
- **Multi-file Loading**: Open multiple files simultaneously in the same viewer
- **Folder Support**: Load all supported files from a directory at once

### Advanced Visualization
- **Multiple Representations**: Cartoon, surface, ball-and-stick, and more
- **Custom Coloring Schemes**: By chain, element, secondary structure, etc.
- **Interactive Controls**: Zoom, rotate, and explore structures with mouse controls
- **High-Quality Rendering**: WebGL-powered visualization with modern graphics
- **Memory Optimization**: Smart handling of large files with chunked processing
- **File Size Warnings**: Automatic warnings for large files (>50MB) to prevent performance issues

### VS Code Integration
- **Context Menu Integration**: Right-click on files to open in BioViewer
- **Command Palette**: Access all features through VS Code's command palette
- **Panel Management**: Seamlessly manage multiple viewer panels
- **File Watching**: Automatic detection of supported file types
- **Debug Output**: Comprehensive logging in VS Code Output panel for troubleshooting
- **Error Handling**: Robust error handling with user-friendly messages

## 🚀 Installation

1. Open Visual Studio Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "BioViewer"
4. Click **Install**

## 📖 Usage

### Commands

BioViewer provides four main commands accessible through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `BioViewer: Open Structure from Database` | Load structures from PDB, AlphaFold, or EMDB databases |
| `BioViewer: Open Files` | Open selected structure files in a new panel |
| `BioViewer: Open Folder` | Load all supported files from a directory |
| `BioViewer: Add Files to Current Panel` | Add files to the currently active viewer panel |

### Quick Access via Context Menu

Right-click on supported files in the Explorer to:
- **Open in new panel**: Create a new BioViewer panel with selected files
- **Add to current panel**: Append files to the existing viewer
- **Open folder**: Load all supported files from a directory

### Supported File Extensions

| Category | Extensions | Description |
|----------|------------|-------------|
| **Structure Files** | `.pdb`, `.cif`, `.mmcif`, `.mcif`, `.ent` | Protein and nucleic acid structures |
| **Density Maps** | `.mrc`, `.map`, `.ccp4` | Electron microscopy and crystallographic maps |

### Workflow Examples

#### 1. Loading from Database
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "BioViewer: Open Structure from Database"
3. Select database type (PDB, AlphaFold, or EMDB)
4. Enter the appropriate ID
5. Structure loads automatically in a new panel

#### 2. Working with Local Files
1. Right-click on a `.pdb` file in Explorer
2. Select "BioViewer: Open Files"
3. The structure opens in a new viewer panel
4. Use "Add Files to Current Panel" to load additional structures

#### 3. Batch Processing
1. Right-click on a folder containing structure files
2. Select "BioViewer: Open Folder"
3. All supported files load simultaneously in one panel

## ⚙️ Requirements

- **Visual Studio Code**: ^1.96.2
- **Node.js**: >=18.0.0 (for development)
- **Internet Connection**: Required for loading structures from online databases

## 🛠️ Technical Details

### Built With
- **Mol* Library**: v4.18.0 - Advanced molecular visualization platform
- **TypeScript**: v5.8.3 - Type-safe development
- **esbuild**: v0.25.5 - Fast JavaScript bundler
- **Modern Web Standards**: WebGL, ES2022, HTML5

### Architecture
- **Extension Host**: Manages commands and file operations
- **Webview Panel**: Hosts the Mol* viewer with secure communication
- **Resource Management**: Efficient loading and caching of molecular data

## 🔧 Development

### Prerequisites
```bash
# Clone the repository
git clone https://github.com/shuuul/bioviewer.git
cd bioviewer

# Install dependencies
npm install
```

### Build Scripts
```bash
# Development build with watching
npm run watch

# Production build
npm run compile

# Type checking
npm run check-types

# Linting
npm run lint

# Run tests
npm run test

# Package extension
npm run build:vsix
```

### Project Structure
```
bioviewer/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── panels/
│   │   └── BioViewerPanel.ts # Webview panel management
│   ├── webview/
│   │   └── bioviewer.html    # Mol* viewer interface
│   └── test/                 # Test files
├── dist/                     # Compiled output
├── resources/                # Static resources
└── package.json             # Extension manifest
```

### Extension API
The extension exposes a clean API for programmatic access:

```typescript
// Get the current active panel
const panel = BioViewerPanel.getCurrentPanel();

// Load content programmatically
panel?.loadContent('loadPdb', { accession: '6giq' });
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`npm run commit` for conventional commits)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Bug Reports & Feature Requests
Please use our [GitHub Issues](https://github.com/shuuul/bioviewer/issues) to report bugs or request features.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Mol*](https://molstar.org/)** - The powerful molecular visualization library that powers BioViewer
- **[PDBe](https://www.ebi.ac.uk/pdbe/)** & **[RCSB PDB](https://www.rcsb.org/)** - Structural biology databases
- **[AlphaFold](https://alphafold.ebi.ac.uk/)** - AI-powered protein structure predictions
- **[EMDB](https://www.ebi.ac.uk/emdb/)** - Electron Microscopy Data Bank
- **[Visual Studio Code](https://code.visualstudio.com/)** - The extensible code editor platform
- **[Recraft.ai](https://www.recraft.ai)** - AI-generated extension icon

## 📊 Version History

### v0.0.14 (Latest)
- 🚀 **Major Performance Improvements**: Optimized memory usage for large files
- 🛡️ **Smart File Handling**: Automatic warnings for large files (>50MB) with user confirmation
- 🔧 **Memory Management**: Chunked processing for large binary files to prevent browser freezing
- 📁 **Enhanced File Loading**: Improved blob URL handling for better file access
- 🏷️ **Better Naming**: Volume/map files now display proper filename-based names
- 🐛 **Bug Fixes**: Fixed webview communication issues and undefined command errors
- 📊 **Improved Logging**: Reduced verbose output while maintaining debugging capabilities

### v0.0.13
- ✨ Updated to Mol* v4.18.0
- 🔧 Modernized dependencies (TypeScript 5.8.3, esbuild 0.25.5)
- 🎨 Improved command names for better clarity
- 📚 Enhanced code documentation and error handling
- 🚀 Better VS Code integration and performance

### Previous Versions
See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [documentation](https://github.com/shuuul/bioviewer#readme)
2. Search [existing issues](https://github.com/shuuul/bioviewer/issues)
3. [Create a new issue](https://github.com/shuuul/bioviewer/issues/new) with detailed information

For development questions, feel free to reach out to [@shuuul](https://github.com/shuuul).

---

Made with ❤️ for the structural biology community