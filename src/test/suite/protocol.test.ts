import * as assert from "assert";
import { isExtensionToWebviewMessage, isWebviewToExtensionMessage } from "../../shared/webviewProtocol";

suite("BioViewer Load Protocol", () => {
    test("Requires request identifiers and valid result payloads", () => {
        assert.ok(isExtensionToWebviewMessage({ command: "loadPdb", accession: "6giq", requestId: "1" }));
        assert.ok(!isExtensionToWebviewMessage({ command: "loadPdb", accession: "6giq" }));
        assert.ok(!isExtensionToWebviewMessage({ command: "loadPdb", accession: "6giq", requestId: " " }));
        assert.ok(isWebviewToExtensionMessage({ command: "loadResult", requestId: "1", success: true }));
        assert.ok(isWebviewToExtensionMessage({ command: "loadResult", requestId: "1", success: false, error: "Invalid file" }));
        assert.ok(!isWebviewToExtensionMessage({ command: "loadResult", requestId: "1", success: false }));
        assert.ok(!isWebviewToExtensionMessage({ command: "loadResult", requestId: "1", success: "true" }));
        assert.ok(!isWebviewToExtensionMessage({ command: "loadResult", success: true }));
    });
});
