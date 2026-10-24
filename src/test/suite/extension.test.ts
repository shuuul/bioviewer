import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { findSupportedFolderFiles } from "../../commands/fileCommands";
import {
    EXAMPLES_PATH,
    ensureExtensionActivated,
    fileExists,
    getExampleUri,
    resetUiState
} from "./testUtils";

suite("BioViewer Extension Test Suite", () => {
    const timeout = 20000;

    suiteSetup(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await ensureExtensionActivated();
        await resetUiState();
    });

    teardown(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await resetUiState();
    });

    test("All commands should be registered", async function(this: Mocha.Context) {
        this.timeout(timeout);

        const commands = await vscode.commands.getCommands(true);
        const bioviewerCommands = commands.filter((command) => command.startsWith("bioviewer."));

        assert.ok(bioviewerCommands.includes("bioviewer.openFiles"));
        assert.ok(bioviewerCommands.includes("bioviewer.openFolder"));
        assert.ok(bioviewerCommands.includes("bioviewer.addFiles"));
        assert.ok(bioviewerCommands.includes("bioviewer.addFolder"));
        assert.ok(bioviewerCommands.includes("bioviewer.openFromDatabase"));
    });

    test("Should recognize supported file extensions", function(this: Mocha.Context) {
        this.timeout(timeout);

        const extension = vscode.extensions.getExtension("shuuul.bioviewer");
        assert.ok(extension, "Extension should be available");

        const packageJson = extension?.packageJSON;
        assert.ok(packageJson, "Package.json should be available");

        const menus = packageJson?.contributes?.menus;
        assert.ok(menus, "Menus configuration should be available");

        const explorerContext = menus["explorer/context"];
        assert.ok(explorerContext, "Explorer context menu should be defined");

        const openFilesMenu = explorerContext.find((item: any) => item.command === "bioviewer.openFiles");
        assert.ok(openFilesMenu, "openFiles menu item should be defined");

        const whenClause = openFilesMenu.when;
        assert.ok(whenClause, "When clause should be defined");
        assert.ok(
            whenClause.includes("pdb") && whenClause.includes("cif") && whenClause.includes("mrc"),
            "Should support common file extensions"
        );
    });

    test("Should create webview panel", async function(this: Mocha.Context) {
        this.timeout(timeout);

        const mrcFile = getExampleUri("0004_unified_apix2.mrc");
        assert.ok(fileExists(mrcFile), "MRC example file should exist");

        await assert.doesNotReject(async () => {
            await vscode.commands.executeCommand("bioviewer.openFiles", [mrcFile]);
        });
    });

    test("Should handle invalid file paths gracefully", async function(this: Mocha.Context) {
        this.timeout(timeout);

        const invalidFile = getExampleUri("nonexistent.mrc");
        assert.ok(!fileExists(invalidFile), "Invalid test file should not exist");

        const initialEditorCount = vscode.window.visibleTextEditors.length;

        try {
            await vscode.commands.executeCommand("bioviewer.openFiles", [invalidFile]);
        } catch {
            // Throwing is acceptable for invalid paths; we only care that no editor is opened.
        }

        assert.strictEqual(
            vscode.window.visibleTextEditors.length,
            initialEditorCount,
            "No text editor should open for invalid files"
        );
    });

    test("Should handle folder activation", async function(this: Mocha.Context) {
        this.timeout(timeout);

        await assert.doesNotReject(async () => {
            await vscode.commands.executeCommand("bioviewer.openFolder", vscode.Uri.file(EXAMPLES_PATH));
        });
    });

    test("Should find supported files in nested folders recursively", async function(this: Mocha.Context) {
        this.timeout(timeout);

        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-folder-test-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, "nested", "deeper"));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, ".hidden"));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, "node_modules"));

        const writeFile = (relative: string, contents = "x") =>
            vscode.workspace.fs.writeFile(vscode.Uri.joinPath(root, relative), Buffer.from(contents));
        await writeFile("a.pdb", "ATOM");
        await writeFile("skip.txt");
        await writeFile("nested/b.cif.gz");
        await writeFile("nested/deeper/c.mrc");
        await writeFile(".hidden/d.pdb");
        await writeFile("node_modules/e.pdb");

        try {
            const found = await findSupportedFolderFiles(root);
            const names = found.map((uri) => path.basename(uri.fsPath));
            assert.deepStrictEqual(names, ["a.pdb", "b.cif.gz", "c.mrc"]);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });
});
