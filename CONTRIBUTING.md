# Contributing to BioViewer

We welcome contributions and aim to keep the process simple and predictable.

## What to Contribute

- Bug reports and fixes
- Feature proposals and implementations
- Test improvements
- Documentation updates

## Development Workflow

1. Fork the repository and branch from `master`.
2. Implement your change.
3. Add or update tests when behavior changes.
4. Update documentation for API/UX/workflow changes.
5. Run validation locally:
   - `npm run compile`
   - `npm run test`
6. Open a pull request with a clear summary.

## Pull Request Process

1. Keep changes focused and scoped to one goal.
2. Include screenshots or logs when helpful (especially for webview/UI issues).
3. If the extension version changes, update `CHANGELOG.md` in the same change.
4. Ensure CI checks pass before requesting review.

## Commit Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/) style where practical, for example:
- `feat: add xyz`
- `fix: handle abc edge case`
- `docs: update contributing guide`

## Any Contributions You Make Will Be Under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report Bugs Using GitHub's [Issue Tracker](https://github.com/shuuul/bioviewer/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/shuuul/bioviewer/issues/new).

## Write Bug Reports With Detail, Background, and Sample Code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Build and Packaging Notes

- Keep the extension offline-friendly: required runtime assets must be packaged in the VSIX.
- Do not introduce runtime web dependencies that force users to download JavaScript from the internet.
- Use `npm run build:vsix` to generate a local package for installation tests.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
