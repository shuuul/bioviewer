import * as assert from "assert";
import { isExtensionToWebviewMessage, isWebviewConfig, isWebviewToExtensionMessage } from "../../shared/webviewProtocol";

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

    test("The webview config requires the surface engine assets", () => {
        const config = {
            settings: { customColors: [], locale: null },
            displayLanguage: "en",
            surfaceEngine: { wasmUrl: "https://test.invalid/wasm", workerUrl: "https://test.invalid/worker.js" },
        };
        assert.ok(isWebviewConfig(config));
        assert.ok(!isWebviewConfig({ ...config, surfaceEngine: { wasmUrl: config.surfaceEngine.wasmUrl } }));
        assert.ok(!isWebviewConfig({ ...config, surfaceEngine: { ...config.surfaceEngine, workerUrl: "" } }));
        assert.ok(!isWebviewConfig({ ...config, settings: { customColors: [] } }));
    });
});
