import * as assert from "assert";
import {
    buildFileFilters,
    getFileConfig,
    isSupportedFileName
} from "../../commands/fileTypes";

suite("BioViewer File Types Test Suite", () => {
    test("Should recognize CMM marker files", () => {
        assert.deepStrictEqual(getFileConfig("sites.cmm"), {
            command: "loadMarkers",
            format: "cmm",
            label: "sites",
            isCompressed: false
        });
        assert.deepStrictEqual(getFileConfig("sites.cmm.gz"), {
            command: "loadMarkers",
            format: "cmm",
            label: "sites",
            isCompressed: true
        });
    });

    test("Should select the native parser for each small molecule format", () => {
        for (const [extension, format] of [
            ["sdf", "sdf"], ["sd", "sdf"], ["mol", "mol"],
            ["mol2", "mol2"], ["pdbqt", "pdbqt"]
        ]) {
            for (const suffix of [`.${extension}`, `.${extension}.gz`, `.${extension.toUpperCase()}.GZ`]) {
                const config = getFileConfig(`ligand${suffix}`);
                assert.strictEqual(config?.format, format);
                assert.strictEqual(config?.command, "loadStructure");
                assert.strictEqual(config?.label, "ligand");
            }
        }
    });

    test("Should expose marker file filters", () => {
        assert.deepStrictEqual(buildFileFilters()["Marker Files"], ["cmm", "cmm.gz"]);
    });

    test("Should recognize supported file names including gzip", () => {
        assert.ok(isSupportedFileName("structure.pdb"));
        assert.ok(isSupportedFileName("STRUCTURE.PDB.GZ"));
        assert.ok(isSupportedFileName("map.mrc.gz"));
        assert.ok(!isSupportedFileName("notes.txt"));
        assert.ok(!isSupportedFileName("pdb"));
    });
});
