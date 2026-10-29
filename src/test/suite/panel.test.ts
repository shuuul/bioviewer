import * as assert from "assert";
import * as vscode from "vscode";
import { BioViewerPanel, type PanelContext, type ViewerKind } from "../../panels/BioViewerPanel";
import { ensureExtensionActivated } from "./testUtils";

suite("BioViewer Panel Lifecycle", () => {
    let output: vscode.OutputChannel;
    let extensionUri: vscode.Uri;
    let instance: BioViewerPanel;
    let disposed: vscode.EventEmitter<void>;
    let messages: vscode.EventEmitter<unknown>;
    let changes: vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>;
    let posted: Record<string, unknown>[];
    let delivery: boolean;
    let webview: { html: string };
    let createPanel: (viewer: ViewerKind) => BioViewerPanel;

    suiteSetup(async () => {
        await ensureExtensionActivated();
        extensionUri = vscode.extensions.getExtension("shuuul.bioviewer")!.extensionUri;
        output = { appendLine() {}, dispose() {} } as unknown as vscode.OutputChannel;
    });

    setup(() => {
        disposed = new vscode.EventEmitter<void>();
        messages = new vscode.EventEmitter<unknown>();
        changes = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
        posted = [];
        delivery = true;
        createPanel = (viewer) => {
            let closed = false;
            webview = {
                html: "",
                cspSource: "https://test.invalid",
                asWebviewUri: (uri: vscode.Uri) => uri,
                onDidReceiveMessage: messages.event,
                postMessage: async (message: Record<string, unknown>) => {
                    posted.push(message);
                    return delivery;
                },
            } as { html: string };
            const panel = {
                title: "test",
                onDidDispose: disposed.event,
                onDidChangeViewState: changes.event,
                webview,
                dispose: () => {
                    if (!closed) {
                        closed = true;
                        disposed.fire();
                    }
                },
            } as unknown as vscode.WebviewPanel;
            const Panel = BioViewerPanel as unknown as {
                new(panel: vscode.WebviewPanel, context: PanelContext, viewer: ViewerKind): BioViewerPanel;
                _outputChannel: vscode.OutputChannel;
            };
            Panel._outputChannel = output;
            const globalState = { get: () => undefined, update: async () => {} } as unknown as PanelContext["globalState"];
            return new Panel(panel, { extensionUri, globalState }, viewer);
        };
        instance = createPanel("studio");
    });

    teardown(() => {
        instance.dispose();
        disposed.dispose();
        messages.dispose();
        changes.dispose();
    });

    suiteTeardown(() => output.dispose());

    test("Studio panel loads the MolStudio bundle with its settings", () => {
        assert.match(webview.html, /webview\/app\.js/);
        assert.match(webview.html, /data-config="\{&quot;settings&quot;/);
        assert.doesNotMatch(webview.html, /\$\{/);
    });

    test("Classic panel loads the prebuilt Mol* viewer", () => {
        instance.dispose();
        instance = createPanel("classic");
        assert.match(webview.html, /molstar\/molstar\.js/);
        assert.match(webview.html, /webview\/classic\.js/);
        assert.doesNotMatch(webview.html, /\$\{/);
    });

    test("Closing before ready rejects readiness immediately", async () => {
        const waiting = instance.waitForReady();
        const rejected = assert.rejects(waiting, /panel was closed/);
        disposed.fire();
        await rejected;
        await assert.rejects(instance.waitForReady(), /panel was closed/);
    });

    test("A viewer startup failure rejects readiness", async () => {
        const waiting = instance.waitForReady();
        messages.fire({ command: "startupFailed", error: "WebGL is unavailable" });
        await assert.rejects(waiting, /failed to start: WebGL is unavailable/);
    });

    test("Only matching completion settles a load; info is not completion", async () => {
        messages.fire({ command: "ready" });
        let completed = false;
        const loading = instance.loadContent({ command: "loadPdb", accession: "6giq" }).then(() => { completed = true; });
        await new Promise((resolve) => setImmediate(resolve));
        assert.strictEqual(posted.length, 1);
        messages.fire({ command: "info", info: "progress" });
        messages.fire({ command: "loadResult", requestId: "unrelated", success: true });
        await Promise.resolve();
        assert.strictEqual(completed, false);
        assert.strictEqual(instance.isLoading, true);
        messages.fire({ command: "loadResult", requestId: posted[0].requestId, success: true });
        await loading;
        assert.strictEqual(instance.isLoading, false);
    });

    test("Viewer parsing failures reject the corresponding load", async () => {
        messages.fire({ command: "ready" });
        const loading = instance.loadContent({ command: "loadPdb", accession: "bad" });
        const rejected = assert.rejects(loading, /Invalid structure/);
        await new Promise((resolve) => setImmediate(resolve));
        messages.fire({ command: "loadResult", requestId: posted[0].requestId, success: false, error: "Invalid structure" });
        await rejected;
        assert.strictEqual(instance.isLoading, false);
    });

    test("Undelivered messages fail immediately", async () => {
        messages.fire({ command: "ready" });
        delivery = false;
        await assert.rejects(instance.loadContent({ command: "loadPdb", accession: "6giq" }), /Failed to deliver/);
        assert.strictEqual(instance.isLoading, false);
    });

    test("Closing rejects pending loads and clears current panel", async () => {
        messages.fire({ command: "ready" });
        BioViewerPanel.currentPanel = instance;
        const loading = instance.loadContent({ command: "loadPdb", accession: "6giq" });
        const rejected = assert.rejects(loading, /panel was closed/);
        await new Promise((resolve) => setImmediate(resolve));
        disposed.fire();
        await rejected;
        assert.strictEqual(instance.isLoading, false);
        assert.strictEqual(BioViewerPanel.currentPanel, undefined);
        await assert.rejects(instance.loadContent({ command: "loadPdb", accession: "6giq" }), /panel was closed/);
    });
});
