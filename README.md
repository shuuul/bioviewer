# BioViewer

[![Version](https://img.shields.io/visual-studio-marketplace/v/shuuul.bioviewer)](https://marketplace.visualstudio.com/items?itemName=shuuul.bioviewer)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/shuuul.bioviewer)](https://marketplace.visualstudio.com/items?itemName=shuuul.bioviewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Visual Studio Code extension for visualizing biological structures and electron microscopy maps. Built on [Mol*](https://molstar.org/), BioViewer brings advanced molecular visualization directly into your development environment.

## ✨ Key Features

- **🗺️ Electron Microscopy Maps**: Full support for MRC, MAP, and CCP4 volume files with proper visualization
- **🌐 Remote SSH Ready**: Optimized for remote development with efficient file transfer
- **📦 Compression Support**: Automatic .gz file handling saves bandwidth - especially valuable for remote connections
- **🧬 Multiple Formats**: PDB, mmCIF, and all standard structural biology file formats
- **🔗 Database Integration**: Direct access to PDB, AlphaFold, and EMDB databases

## 🚀 Installation

1. Open Visual Studio Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "BioViewer"
4. Click **Install**

## 📖 Usage

### Commands (Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`)

| Command | Description |
|---------|-------------|
| `BioViewer: Open Structure from Database` | Load from PDB, AlphaFold, or EMDB |
| `BioViewer: Open Files` | Open selected files in new tab |
| `BioViewer: Open Folder` | Load all supported files from directory |
| `BioViewer: Add Files to Current Tab` | Add files to active tab |
| `BioViewer: Add Folder to Current Tab` | Add all supported files from directory to active tab |

### Supported Formats

| Type | Extensions |
|------|------------|
| **Structures** | `.pdb`, `.cif`, `.mmcif`, `.mcif`, `.ent` |
| **Volume Maps** | `.mrc`, `.map`, `.ccp4` |
| **Small Molecules** | `.sdf`, `.sd`, `.mol`, `.mol2`, `.pdbqt` |
| **Compressed** | All above formats with `.gz` compression |

### Quick Start

**Right-click** any supported file in VS Code Explorer → **"BioViewer: Open Files"**

## 🌐 Remote Development

BioViewer is optimized for remote SSH scenarios:

- **Bandwidth Efficient**: .gz files stay compressed during transfer
- **Smart Decompression**: Files decompress in browser, not on server
- **Large File Handling**: Memory-efficient processing of big datasets

## ⚙️ Requirements

- Visual Studio Code ^1.105.1 (for compatibility with [Cursor](https://www.cursor.com/))
- Modern web browser (for WebGL support)]

## 🙏 Acknowledgments

This extension was inspired by [molstar/VSCoding-Sequence](https://github.com/molstar/VSCoding-Sequence) and builds upon the powerful [Mol* molecular visualization library](https://github.com/molstar/molstar).

**Key Dependencies:**
- **[Mol*](https://molstar.org/)** (v4.18.0) - The core molecular visualization engine
- **[PDBe](https://www.ebi.ac.uk/pdbe/)** & **[RCSB PDB](https://www.rcsb.org/)** - Structural databases
- **[AlphaFold](https://alphafold.ebi.ac.uk/)** - AI protein structure predictions
- **[EMDB](https://www.ebi.ac.uk/emdb/)** - Electron Microscopy Data Bank

## 🛠️ Development

```bash
git clone https://github.com/shuuul/bioviewer.git
cd bioviewer
npm install
npm run watch    # Development mode
npm run compile  # Production build
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- [Documentation](https://github.com/shuuul/bioviewer#readme)
- [Issues](https://github.com/shuuul/bioviewer/issues)
- [Releases](https://github.com/shuuul/bioviewer/releases)

---

Made with ❤️ for the structural biology community
