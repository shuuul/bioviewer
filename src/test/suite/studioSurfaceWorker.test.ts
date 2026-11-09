import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * The studio webview starts its MolStudio surface worker from a blob: module worker, and hands the
 * worker a blob: URL for the wasm module: extension resources come from a different origin than the
 * webview document, so neither can be loaded from their asWebviewUri directly. MolStudio also uses
 * this factory for the worker downsample protocol (open uses in-process wasm; the protocol remains
 * a host/test check), so this test mirrors the production bootstrap (fetch both assets from the
 * webview, then start the worker) against the built assets and exercises both worker requests:
 * engine init + mesh, and downsample. A CSP,
 * connect-src, CORS, worker-protocol or build regression fails here instead of silently degrading to
 * the main-thread, JS or Mol* fallback.
 */
suite("Studio surface worker", () => {
    test("runs the MolStudio surface worker and downsample requests as a blob: module worker", async function (this: Mocha.Context) {
        this.timeout(30000);
        const extensionUri = vscode.extensions.getExtension("shuuul.bioviewer")!.extensionUri;
        const workerUri = vscode.Uri.joinPath(extensionUri, "dist", "webview", "molstudio-worker.js");
        const wasmUri = vscode.Uri.joinPath(extensionUri, "dist", "molstudio", "molstudio-wasm-engine.wasm");
        assert.ok(fs.existsSync(workerUri.fsPath), `the build is missing ${workerUri.fsPath}`);
        assert.ok(fs.existsSync(wasmUri.fsPath), `the build is missing ${wasmUri.fsPath}`);
        const panel = vscode.window.createWebviewPanel("studioSurfaceWorker", "surface worker", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
        });
        const webview = panel.webview;
        const nonce = "studioSurfaceWorkerNonce";
        const workerUrl = JSON.stringify(webview.asWebviewUri(workerUri).toString());
        const wasmUrl = JSON.stringify(webview.asWebviewUri(wasmUri).toString());
        // Keep the CSP in sync with src/webview/bioviewer.html.
        webview.html = `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'; connect-src ${webview.cspSource} https: data: blob:; font-src ${webview.cspSource}; worker-src ${webview.cspSource} blob:;">
</head><body>
<script nonce="${nonce}">
const api = acquireVsCodeApi();
const report = (value) => api.postMessage(value);
let meshVertices = 0;
const timer = setTimeout(() => report({ ok: false, error: "timed out" }), 20000);
const fail = (error) => { clearTimeout(timer); report({ ok: false, error }); };
const grid = () => {
  const dims = [8, 8, 8];
  const data = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let i = 0; i < data.length; i++) data[i] = i < 100 ? 1 : 0;
  return { dims, data };
};
Promise.all([
  fetch(${workerUrl}).then((response) => { if (!response.ok) throw new Error("worker script HTTP " + response.status); return response.text(); }),
  fetch(${wasmUrl}).then((response) => { if (!response.ok) throw new Error("wasm HTTP " + response.status); return response.arrayBuffer(); }),
]).then(([workerSource, wasmBytes]) => {
  const workerBlobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const wasmBlobUrl = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
  // The main-thread tier fetches the same blob: URL from the page, so prove that works too.
  fetch(wasmBlobUrl).then((response) => { if (!response.ok) fail("the page could not fetch the wasm blob URL"); });
  const worker = new Worker(workerBlobUrl, { type: "module" });
  worker.onerror = (event) => fail("worker error: " + (event.message || "unknown"));
  worker.onmessage = (event) => {
    const message = event.data;
    if (message.kind === "ready") {
      if (message.ok !== true) return fail("the worker could not initialize the wasm engine");
      worker.postMessage({ kind: "mesh", seq: 1, isoLevel: 0.5 });
    } else if (message.kind === "mesh") {
      meshVertices = message.mesh.vertices.length;
      if (meshVertices === 0) return fail("the worker returned no isosurface vertices");
      const { dims, data } = grid();
      worker.postMessage({
        kind: "downsample",
        wasmUrl: wasmBlobUrl,
        dims,
        data,
        factor: 2,
        axisOrderSlowToFast: [2, 1, 0],
        seq: 2,
      }, [data.buffer]);
    } else if (message.kind === "downsampled") {
      clearTimeout(timer);
      report({ ok: true, vertices: meshVertices, downsampleDims: message.dims, downsampleLength: message.data.length });
      worker.terminate();
    } else if (message.kind === "error") {
      fail(message.message);
    }
  };
  const { dims, data } = grid();
  worker.postMessage({ kind: "init", wasmUrl: wasmBlobUrl, dims, data, wrap: false }, [data.buffer]);
}).catch((error) => fail("setup failed: " + error.message));
</script></body></html>`;

        try {
            const result = await new Promise<{
                ok: boolean;
                error?: string;
                vertices?: number;
                downsampleDims?: [number, number, number];
                downsampleLength?: number;
            }>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("timed out waiting for the webview")), 30000);
                const subscription = webview.onDidReceiveMessage((message: {
                    ok?: boolean;
                    error?: string;
                    vertices?: number;
                    downsampleDims?: [number, number, number];
                    downsampleLength?: number;
                }) => {
                    if (message.ok === undefined) {
                        return;
                    }
                    clearTimeout(timeout);
                    subscription.dispose();
                    resolve({
                        ok: message.ok === true,
                        error: message.error,
                        vertices: message.vertices,
                        downsampleDims: message.downsampleDims,
                        downsampleLength: message.downsampleLength,
                    });
                });
            });
            assert.strictEqual(result.ok, true, JSON.stringify(result));
            assert.ok((result.vertices ?? 0) > 0, "the worker returned no isosurface vertices");
            assert.deepStrictEqual(result.downsampleDims, [4, 4, 4], "the worker returned the wrong downsampled dims");
            assert.strictEqual(result.downsampleLength, 64, "the worker returned the wrong downsampled cell count");
        } finally {
            panel.dispose();
        }
    });
});
