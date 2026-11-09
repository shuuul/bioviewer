import type { SurfaceEngineAssets } from "@molstudio/core";
import type { SurfaceEngineConfig } from "../../shared/webviewProtocol";

async function fetchAsset(url: string, asset: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch the MolStudio ${asset} (HTTP ${response.status}).`);
  }
  return response;
}

/**
 * Prepares the surface engine assets for the Studio viewer. Extension resources are
 * served from a different origin than the webview document (`vscode-webview://`), so
 * a worker and the wasm module cannot load them directly. Both are fetched once and
 * started from blob: URLs, which share the webview's origin: the worker as a module
 * worker, the wasm module as the engine's `wasmUrl`.
 */
export async function loadSurfaceEngineAssets({
  wasmUrl,
  workerUrl,
}: SurfaceEngineConfig): Promise<SurfaceEngineAssets> {
  const [workerSource, wasmBytes] = await Promise.all([
    fetchAsset(workerUrl, "surface worker").then((response) => response.text()),
    fetchAsset(wasmUrl, "wasm engine").then((response) => response.arrayBuffer()),
  ]);
  const workerBlobUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const wasmBlobUrl = URL.createObjectURL(new Blob([wasmBytes], { type: "application/wasm" }));
  return {
    wasmUrl: wasmBlobUrl,
    makeWorker: () => new Worker(workerBlobUrl, { type: "module" }),
  };
}
