import * as assert from "assert";
import {
    buildFileFilters,
    getFileConfig,
    isSupportedFileName
} from "../../commands/fileTypes";

suite("BioViewer File Types Test Suite", () => {
    test("Should recognize CMM marker files", () => {
        assert.deepStrictEqual(getFileConfig(".cmm"), {
            format: "cmm",
            command: "loadMarkers"
        });
        assert.deepStrictEqual(getFileConfig(".cmm.gz"), {
            format: "cmm",
            command: "loadMarkers"
        });
    });

    test("Should select the native parser for each small molecule format", () => {
        for (const [extension, format] of [
            ["sdf", "sdf"], ["sd", "sdf"], ["mol", "mol"],
            ["mol2", "mol2"], ["pdbqt", "pdbqt"]
        ]) {
            for (const suffix of [`.${extension}`, `.${extension}.gz`, `.${extension.toUpperCase()}.GZ`]) {
                assert.deepStrictEqual(getFileConfig(suffix), { format, command: "loadStructure" });
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
