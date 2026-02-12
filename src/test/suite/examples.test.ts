import * as assert from "assert";
import * as vscode from "vscode";
import {
    EXAMPLES_PATH,
    ensureExtensionActivated,
    fileExists,
    getExampleUri,
    resetUiState
} from "./testUtils";

suite("BioViewer Example Files Test Suite", () => {
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

    const openFilesCases: Array<{ name: string; files: string[]; timeoutMultiplier?: number }> = [
        { name: "Should load MRC file", files: ["0004_unified_apix2.mrc"] },
        { name: "Should load CIF file", files: ["6GIQ_ba1.cif"] },
        { name: "Should load SDF file", files: ["ADP_ideal.sdf"] },
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

    test("Should load all supported files from folder", async function(this: Mocha.Context) {
        this.timeout(timeout * 2);

        await assert.doesNotReject(async () => {
            await vscode.commands.executeCommand("bioviewer.openFolder", vscode.Uri.file(EXAMPLES_PATH));
        });
    });
});
