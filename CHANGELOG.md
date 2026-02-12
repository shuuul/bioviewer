# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.16](https://github.com/shuuul/bioviewer/compare/v0.1.14...v0.1.16) (2026-02-12)

- refactor: migrate the webview runtime to a React + TypeScript architecture with typed extension/webview messaging
- refactor: remove outdated legacy webview/test scaffolding and simplify build/package outputs
- test: optimize extension test speed and reliability with shared setup utilities and table-driven cases

### [0.1.14](https://github.com/shuuul/bioviewer/compare/v0.1.12...v0.1.14) (2026-02-12)

### [0.1.13](https://github.com/shuuul/bioviewer/compare/v0.1.12...v0.1.13) (2026-02-12)

- chore: refresh dependencies and lockfile for maintenance
- docs: rename `CLAUDE.md` to `AGENTS.md` and clarify changelog/versioning workflow
- docs: rewrite changelog sections to match git tag/commit history
- docs: update user-facing wording from "panel" to "tab" in command titles and README

### [0.1.12](https://github.com/shuuul/bioviewer/compare/v0.1.11...v0.1.12) (2025-12-22)

- fix: replace fs-extra with native fs modules ([db8b45b](https://github.com/shuuul/bioviewer/commit/db8b45be2cfc6956f51ddf206108fa005e05fad5))
- chore(release): 0.1.12 ([4349a42](https://github.com/shuuul/bioviewer/commit/4349a424e43c7bf6ec585488146ac65b8ad1d418))

### [0.1.11](https://github.com/shuuul/bioviewer/compare/v0.1.10...v0.1.11) (2025-12-22)

- chore(release): 0.1.11 ([af6b685](https://github.com/shuuul/bioviewer/commit/af6b6858454a61f88cbafd9debb39cd2e06cfe54))

### [0.1.10](https://github.com/shuuul/bioviewer/compare/v0.1.9...v0.1.10) (2025-12-22)

- fix: resolve F5 debug issue by adding one-time build task ([f69ad10](https://github.com/shuuul/bioviewer/commit/f69ad100a5149bf5b13d77b5b274b5f121a1040f))
- perf: implement multiple optimizations ([47f966a](https://github.com/shuuul/bioviewer/commit/47f966a36b6113a78032ea2f3e8853cacf43e753))
- chore(release): 0.1.10 ([ae2318b](https://github.com/shuuul/bioviewer/commit/ae2318b965f70a7a8478a78243bba19fa2319537))

### [0.1.9](https://github.com/shuuul/bioviewer/compare/v0.1.8...v0.1.9) (2025-12-21)

- refactor: remove redundant legacy commands and consolidate to 5 main commands ([0cc2844](https://github.com/shuuul/bioviewer/commit/0cc2844fa952f4fd343a7b62294a8824b009e969))

### [0.1.8](https://github.com/shuuul/bioviewer/compare/v0.1.7...v0.1.8) (2025-12-21)

- chore(release): 0.1.8 ([db110f2](https://github.com/shuuul/bioviewer/commit/db110f2bdb62f92342c93e25db71d4f8af9e11ab))

### [0.1.7](https://github.com/shuuul/bioviewer/compare/v0.1.6...v0.1.7) (2025-12-21)

- feat: add legacy commands and sdf test ([1f1eac5](https://github.com/shuuul/bioviewer/commit/1f1eac5591273e1c9acf308f712f7cd739c7231a))
- chore(release): 0.1.7 ([5fd1794](https://github.com/shuuul/bioviewer/commit/5fd1794a044182c1b273fac356e4a7034efd9c84))
- fix: restore activation events for publish ([255bcc4](https://github.com/shuuul/bioviewer/commit/255bcc4f25fc5532f084b50575293bbb1996ca33))

### [0.1.6](https://github.com/shuuul/bioviewer/compare/v0.1.5...v0.1.6) (2025-12-21)

- docs: update documentation for VS Code 1.105.1 compatibility ([f690575](https://github.com/shuuul/bioviewer/commit/f690575f980f696b48f9a35eacf104dbc0701da2))
- feat: add small molecule support (SDF, MOL, MOL2, PDBQT) ([42a1858](https://github.com/shuuul/bioviewer/commit/42a1858d7f2857714540295e13056fafb4958375))
- chore(release): 0.1.6 ([e8ab14e](https://github.com/shuuul/bioviewer/commit/e8ab14ee0bd69e1c76fae1787f8b36f0889eb755))

### [0.1.5](https://github.com/shuuul/bioviewer/compare/v0.1.4...v0.1.5) (2025-12-21)

- fix: resolve folder loading issue for files outside workspace ([7cfcf3e](https://github.com/shuuul/bioviewer/commit/7cfcf3ec13660ef9b953331ff2bee31dc016d085))
- chore(deps): bump glob from 10.4.5 to 10.5.0 ([4822334](https://github.com/shuuul/bioviewer/commit/482233460274b9507aa3bdc02591442d70903fd3))
- Merge pull request #1 from shuuul/dependabot/npm_and_yarn/glob-10.5.0 ([866f09a](https://github.com/shuuul/bioviewer/commit/866f09ae5784c8facb5f7b018b1a7aad7d2a6bcf))
- chore(release): 0.1.5 ([cec122d](https://github.com/shuuul/bioviewer/commit/cec122d411a87f73b24cea0eba695f0201f7c576))

### [0.1.4](https://github.com/shuuul/bioviewer/compare/v0.1.3...v0.1.4) (2025-06-24)

- feat: add 'Add Folder to Current Panel' command ([20c0dd3](https://github.com/shuuul/bioviewer/commit/20c0dd3561dff7eb77d3add5b126f67db3b54f26))
- chore(release): 0.1.4 ([8a752e2](https://github.com/shuuul/bioviewer/commit/8a752e251790cd43133d04ebc581819b66269ec8))

### [0.1.3](https://github.com/shuuul/bioviewer/compare/v0.1.2...v0.1.3) (2025-06-24)

- chore(release): 0.1.3 ([a935eee](https://github.com/shuuul/bioviewer/commit/a935eee975a502a5c46fe220284bcf8808da2c2e))

### [0.1.2](https://github.com/shuuul/bioviewer/compare/v0.1.0...v0.1.2) (2025-06-19)

- feat: update extension functionality and documentation ([9d71bd5](https://github.com/shuuul/bioviewer/commit/9d71bd56866a0a87a6b1d3cbaef987bd9882092b))
- chore(release): 0.1.2 ([6fc5e0d](https://github.com/shuuul/bioviewer/commit/6fc5e0d6e2c0845e5c565a9f1ca9a03735c169bf))

### [0.1.0](https://github.com/shuuul/bioviewer/compare/v0.0.16...v0.1.0) (2025-06-17)

- fix: include LICENSE file in package distribution ([1601369](https://github.com/shuuul/bioviewer/commit/16013699fab5eed50d3bc20e3ba8c15974b643ef))
- chore: update version history for v0.0.16 with bug fixes and packaging details ([22f086a](https://github.com/shuuul/bioviewer/commit/22f086ab7aa4a343c884d08bd9ff92bba23ed7d1))
- fix: resolve MRC/MAP volume naming issue with blob URLs ([6dfafda](https://github.com/shuuul/bioviewer/commit/6dfafdae30a4514b5af60337f66d7fe89d3e211e))
- feat: release v0.1.0 with compressed file support and remote SSH optimization ([c29b11d](https://github.com/shuuul/bioviewer/commit/c29b11dffadde32c0cd9aaec542ecbfcb23d2a8b))

### [0.0.16](https://github.com/shuuul/bioviewer/compare/v0.0.15...v0.0.16) (2025-06-14)

- feat: improve memory efficiency with binary blob handling for all file types ([b38cdfd](https://github.com/shuuul/bioviewer/commit/b38cdfd1c1fc28b7ded8717ef507f2b2830804f0))
- chore: update version to 0.0.16 and downgrade vscode dependencies for compatibility ([0404623](https://github.com/shuuul/bioviewer/commit/0404623dab8b41b91b0a8ab3bd7da7ee0f8c4a27))

### [0.0.15](https://github.com/shuuul/bioviewer/compare/v0.0.14...v0.0.15) (2025-06-14)

- chore(release): 0.0.15 ([294f652](https://github.com/shuuul/bioviewer/commit/294f652c8704b9a0e88a022d5284c943516b63c6))

### [0.0.14](https://github.com/shuuul/bioviewer/compare/v0.0.12...v0.0.14) (2025-06-14)

- chore: update dependencies and version for BioViewer extension ([28958fa](https://github.com/shuuul/bioviewer/commit/28958fa69741ea239eb4c26ee6d7ae498ca67467))
- Enhance BioViewerPanel and webview HTML for improved functionality and user experience ([82d9f65](https://github.com/shuuul/bioviewer/commit/82d9f657572e7685acf49973af36287cc28edcae))
- chore: release v0.0.14 ([fdd733e](https://github.com/shuuul/bioviewer/commit/fdd733e9b4618b9bb6c7b0053d1e95bef6595aa7))

### [0.0.12](https://github.com/shuuul/bioviewer/compare/v0.0.11...v0.0.12) (2024-11-29)

- refactor(add comitizen support.): add comitizen support ([35276e7](https://github.com/shuuul/bioviewer/commit/35276e78a230c62cd24b55e6e441c72047de09a1))
- chore(release): 0.0.12 ([bca7cfd](https://github.com/shuuul/bioviewer/commit/bca7cfdc95acae06bb7a2f22e68575a94cd89231))
- Update icon. ([d7fe9b0](https://github.com/shuuul/bioviewer/commit/d7fe9b032975634d00c29490b60b8b0fbf592f0b))
- fix: update release workflow to handle icon and LICENSE ([e8f48b5](https://github.com/shuuul/bioviewer/commit/e8f48b5dd508528c076e0d7a5c9a903ce4ad4971))
- fix: update esbuild to copy resources and fix icon path ([7128bef](https://github.com/shuuul/bioviewer/commit/7128befb191e2a72cdf04433604c381d514f58e8))

### [0.0.11](https://github.com/shuuul/bioviewer/compare/v0.0.10...v0.0.11) (2024-11-22)

- chore(release): 0.0.11 ([dcf2728](https://github.com/shuuul/bioviewer/commit/dcf2728bbf0d8e168c72ba2fa6247a11cefecc67))

### [0.0.10](https://github.com/shuuul/bioviewer/compare/v0.0.9...v0.0.10) (2024-11-19)

- Update icon. ([e35fdc9](https://github.com/shuuul/bioviewer/commit/e35fdc9ec0867423710f17b7b4b89abedd180af0))
- Remove all .DS_Store ([d3d7f2c](https://github.com/shuuul/bioviewer/commit/d3d7f2c6de887202b928b4f3ccf297383b33403b))

### [0.0.9](https://github.com/shuuul/bioviewer/compare/v0.0.8...v0.0.9) (2024-11-16)

- fix: update Node.js to v20 in release workflow ([127cf99](https://github.com/shuuul/bioviewer/commit/127cf9934509a48ba337467592c0b1303c5683d6))
- feat: enhance logging and debugging capabilities ([4e26df0](https://github.com/shuuul/bioviewer/commit/4e26df0fb3c3ccd1cfa370884ed4be9d7609bdae))
- Filter .DS_Stroe. ([c4d3ca5](https://github.com/shuuul/bioviewer/commit/c4d3ca5eb76c7ca4b5d752d9e4a691d98dab47e4))
- fix: update tests to work with enhanced logging ([a6032c6](https://github.com/shuuul/bioviewer/commit/a6032c6bb96f11dba2e7026076b6813f991a960c))

### [0.0.8](https://github.com/shuuul/bioviewer/releases/tag/v0.0.8) (2024-11-15)

- Initialization. ([d96e88d](https://github.com/shuuul/bioviewer/commit/d96e88dae90a60eda8246c8015ca3aa4fd3da97e))
- Read BioStructures. ([aeeb376](https://github.com/shuuul/bioviewer/commit/aeeb376bccf7ba7d74d0dec0694398ed2caaf951))
- Update html template. ([300cf79](https://github.com/shuuul/bioviewer/commit/300cf791ca59fa4831034ab49dd55239876914f2))
- Read map/mrc file from explorer. ([3cd9407](https://github.com/shuuul/bioviewer/commit/3cd94073c5d42f88635b938a11d8a9b181ccadde))
- Append file into one panel. ([3604da9](https://github.com/shuuul/bioviewer/commit/3604da96df08a969cf4d737afe44b661cc534df3))
- stable. Fix bugs in loading strutrues. ([69ab756](https://github.com/shuuul/bioviewer/commit/69ab75629a3a0fe190d74c75de0c316dc8851e2a))
- The problem is append also create a new panel. ([def33d7](https://github.com/shuuul/bioviewer/commit/def33d79523b89dad4f414dc30a58af45e86eb96))
- Update README. ([9afea44](https://github.com/shuuul/bioviewer/commit/9afea44345efec30e2806a5b8359d60f1d66fc57))
- Update README and CHANGELOG. ([9b4f02a](https://github.com/shuuul/bioviewer/commit/9b4f02adeab745757cda6a07ea4969229c0291f4))
- Bump the version to 0.0.3 ([81bb3e6](https://github.com/shuuul/bioviewer/commit/81bb3e6b7dc0a407bc24b98bc17b9ed9a1ecdbfb))
- Fix bug when loading webview.html. ([f5942a1](https://github.com/shuuul/bioviewer/commit/f5942a19d6310944f44883c527f20228b234ddad))
- Refactor command name to startBioViewer with ID in new panel. ([dbad4cb](https://github.com/shuuul/bioviewer/commit/dbad4cbb8910c6428158d0a08357ae0ba98e4b12))
- Bump the version to 0.0.4. ([a55cf4b](https://github.com/shuuul/bioviewer/commit/a55cf4bb1849a9c743c21b6a943635ba7d2cf3fd))
- Add PDB extension support. ([0eb9c1e](https://github.com/shuuul/bioviewer/commit/0eb9c1e9ccf0a5d7c70930c753bf87d6a08e2517))
- Support Cursor. ([318d58a](https://github.com/shuuul/bioviewer/commit/318d58a6ac28634f3f96ebe348628ea8db334b48))
- Add icon to the package. ([af8d5e1](https://github.com/shuuul/bioviewer/commit/af8d5e1497380e1a7540d75d4f0668b3f23bd756))
- feat: bump version to 0.0.7 ([471fe7c](https://github.com/shuuul/bioviewer/commit/471fe7c93a73ac46283cf6eb9ab523185af779d3))
- Update config. ([554a06d](https://github.com/shuuul/bioviewer/commit/554a06d585fc97aa32ddeb1a5a592c080f0dbc96))
- chore: bump version to 0.0.8 ([95adb93](https://github.com/shuuul/bioviewer/commit/95adb93b155393d7c586dfba9a5cf429a23652f8))
- fix: improve release workflow to properly include .vsix file ([d118fb5](https://github.com/shuuul/bioviewer/commit/d118fb56fd84e23f70c85f8307fd5e33711d0ec5))
- chore: remove test step from release workflow ([1d1d6c7](https://github.com/shuuul/bioviewer/commit/1d1d6c79c06020cfddbba83a8d80ff5f8b15ca99))
- fix: remove .vscodeignore in favor of package.json files ([2c2079a](https://github.com/shuuul/bioviewer/commit/2c2079a436b282d68c2c93885c184170b24f1fe9))
