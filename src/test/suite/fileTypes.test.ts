import * as assert from "assert";
import { buildFileFilters, getFileConfig } from "../../commands/fileTypes";

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

    test("Should expose marker file filters", () => {
        assert.deepStrictEqual(buildFileFilters()["Marker Files"], ["cmm", "cmm.gz"]);
    });
});
