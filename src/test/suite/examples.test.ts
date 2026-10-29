import * as assert from "assert";
import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { gzipSync } from "zlib";
import {
    EXAMPLES_PATH,
    ensureExtensionActivated,
    fileExists,
    getExampleUri,
    resetUiState
} from "./testUtils";

suite("BioViewer Example Files Test Suite", () => {
    const timeout = 60000;

    suiteSetup(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await ensureExtensionActivated();
        await resetUiState();
    });

    teardown(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await resetUiState();
    });

    const openFilesCases: Array<{ name: string; files: string[]; timeoutMultiplier?: number }> = [
        { name: "Should load MRC file", files: ["0004_unified_apix2.mrc"] },
        { name: "Should load CIF file", files: ["6GIQ_ba1.cif"] },
        { name: "Should load SDF file", files: ["ADP_ideal.sdf"] },
        { name: "Should load CMM marker file", files: ["blob_1_NDP_1_prompt.cmm"] },
        {
            name: "Should load multiple files in same viewer",
            files: ["0004_unified_apix2.mrc", "6GIQ_ba1.cif"],
            timeoutMultiplier: 2
        }
    ];

    for (const { name, files, timeoutMultiplier } of openFilesCases) {
        test(name, async function(this: Mocha.Context) {
            this.timeout(timeout * (timeoutMultiplier ?? 1));

            const fileUris = files.map((filename) => getExampleUri(filename));
            for (const fileUri of fileUris) {
                assert.ok(fileExists(fileUri), `Example file should exist: ${fileUri.fsPath}`);
            }

            await assert.doesNotReject(async () => {
                await vscode.commands.executeCommand("bioviewer.openFiles", fileUris);
            });
        });
    }

    test("Should create a fresh viewer when adding files after closing the previous viewer", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const file = getExampleUri("ADP_ideal.sdf");
        await vscode.commands.executeCommand("bioviewer.openFiles", [file]);
        await resetUiState();
        await vscode.commands.executeCommand("bioviewer.addFiles", [file]);
        const viewerTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs)
            .filter((tab) => tab.input instanceof vscode.TabInputWebview);
        assert.strictEqual(viewerTabs.length, 1);
    });

    test("Should load uppercase gzip files through the viewer", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-gzip-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(root);
        const file = vscode.Uri.joinPath(root, "LIGAND.SDF.GZ");
        const data = await vscode.workspace.fs.readFile(getExampleUri("ADP_ideal.sdf"));
        await vscode.workspace.fs.writeFile(file, gzipSync(data));
        try {
            await vscode.commands.executeCommand("bioviewer.openFiles", [file]);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });

    test("Should load MOL2 and PDBQT with their native parsers", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-formats-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(root);
        const mol2 = vscode.Uri.joinPath(root, "ligand.mol2");
        const pdbqt = vscode.Uri.joinPath(root, "ligand.pdbqt");
        await vscode.workspace.fs.writeFile(mol2, Buffer.from([
            "@<TRIPOS>MOLECULE", "methanol", "2 1 0 0 0", "SMALL", "NO_CHARGES", "",
            "@<TRIPOS>ATOM", "1 C1 0.000 0.000 0.000 C.3 1 LIG 0.000",
            "2 O1 1.400 0.000 0.000 O.3 1 LIG 0.000", "@<TRIPOS>BOND", "1 1 2 1", ""
        ].join("\n")));
        await vscode.workspace.fs.writeFile(pdbqt, Buffer.from([
            "ROOT",
            "ATOM      1  C1  LIG A   1       0.000   0.000   0.000  1.00  0.00     0.000 C ",
            "ATOM      2  O1  LIG A   1       1.400   0.000   0.000  1.00  0.00     0.000 OA",
            "ENDROOT", "TORSDOF 0", ""
        ].join("\n")));
        try {
            await vscode.commands.executeCommand("bioviewer.openFiles", [mol2, pdbqt]);
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });

    test("Should report parsing failures and continue loading the batch", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-invalid-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(root);
        const invalid = vscode.Uri.joinPath(root, "invalid.cmm");
        await vscode.workspace.fs.writeFile(invalid, Buffer.from("<marker_set><marker /></marker_set>"));
        try {
            await assert.rejects(
                async () => vscode.commands.executeCommand("bioviewer.openFiles", [invalid, getExampleUri("ADP_ideal.sdf")]),
                /Failed to load 1 of 2 file\(s\).*invalid\.cmm/,
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });

    test("Should reject structure input that produces no model", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-empty-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(root);
        const invalid = vscode.Uri.joinPath(root, "empty.sdf");
        await vscode.workspace.fs.writeFile(invalid, Buffer.from("not a molecular structure\n"));
        try {
            await assert.rejects(
                async () => vscode.commands.executeCommand("bioviewer.openFiles", [invalid]),
                /Failed to load 1 of 1 file\(s\).*empty\.sdf/,
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });

    test("Should load all supported files from folder", async function(this: Mocha.Context) {
        this.timeout(timeout * 2);

        await assert.doesNotReject(async () => {
            await vscode.commands.executeCommand("bioviewer.openFolder", vscode.Uri.file(EXAMPLES_PATH));
        });
    });
});

suite("BioViewer Classic Viewer Test Suite", () => {
    const timeout = 60000;
    const settings = () => vscode.workspace.getConfiguration("bioviewer");

    suiteSetup(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await ensureExtensionActivated();
        await resetUiState();
        await settings().update("viewer", "classic", vscode.ConfigurationTarget.Global);
    });

    suiteTeardown(async function(this: Mocha.Context) {
        this.timeout(timeout);
        await resetUiState();
        await settings().update("viewer", undefined, vscode.ConfigurationTarget.Global);
    });

    test("Should load maps, structures, ligands and markers in the classic viewer", async function(this: Mocha.Context) {
        this.timeout(timeout * 2);
        const files = ["0004_unified_apix2.mrc", "6GIQ_ba1.cif", "ADP_ideal.sdf", "blob_1_NDP_1_prompt.cmm"];
        await vscode.commands.executeCommand("bioviewer.openFiles", files.map((file) => getExampleUri(file)));
    });

    test("Should reject structure input that produces no model in the classic viewer", async function(this: Mocha.Context) {
        this.timeout(timeout);
        const root = vscode.Uri.file(path.join(os.tmpdir(), `bioviewer-classic-empty-${Date.now()}`));
        await vscode.workspace.fs.createDirectory(root);
        const invalid = vscode.Uri.joinPath(root, "empty.sdf");
        await vscode.workspace.fs.writeFile(invalid, Buffer.from("not a molecular structure\n"));
        try {
            await assert.rejects(
                async () => vscode.commands.executeCommand("bioviewer.openFiles", [invalid]),
                /Failed to load 1 of 1 file\(s\).*empty\.sdf/,
            );
        } finally {
            await vscode.workspace.fs.delete(root, { recursive: true });
        }
    });
});
