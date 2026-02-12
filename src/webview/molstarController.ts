import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "../shared/webviewProtocol";
import type { MolstarGlobal, MolstarViewer } from "./molstarTypes";

type Reporter = (message: WebviewToExtensionMessage) => void;

interface ViewerQueryConfig {
  debugMode: boolean;
  hideControls: boolean;
  collapseLeftPanel: boolean;
  pdbProvider: string;
  emdbProvider: string;
  mapProvider: string;
  pixelScale?: number;
  pickScale?: number;
  pickPadding?: number;
  disableWboit: boolean;
  preferWebgl1?: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseBooleanQueryParam(params: URLSearchParams, key: string): boolean {
  return params.get(key)?.trim() === "1";
}

function parseNumberQueryParam(params: URLSearchParams, key: string): number | undefined {
  const rawValue = params.get(key)?.trim();
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number.parseFloat(rawValue);
  return Number.isNaN(parsedValue) ? undefined : parsedValue;
}

function parseViewerQueryConfig(): ViewerQueryConfig {
  const params = new URLSearchParams(window.location.search);

  return {
    debugMode: parseBooleanQueryParam(params, "debug-mode"),
    hideControls: parseBooleanQueryParam(params, "hide-controls"),
    collapseLeftPanel: parseBooleanQueryParam(params, "collapse-left-panel"),
    pdbProvider: params.get("pdb-provider")?.trim().toLowerCase() ?? "",
    emdbProvider: params.get("emdb-provider")?.trim().toLowerCase() ?? "",
    mapProvider: params.get("map-provider")?.trim().toLowerCase() ?? "",
    pixelScale: parseNumberQueryParam(params, "pixel-scale"),
    pickScale: parseNumberQueryParam(params, "pick-scale"),
    pickPadding: parseNumberQueryParam(params, "pick-padding"),
    disableWboit: parseBooleanQueryParam(params, "disable-wboit"),
    preferWebgl1: parseBooleanQueryParam(params, "prefer-webgl1") || undefined
  };
}

function ensureMolstarRuntime(): MolstarGlobal {
  const globalScope = globalThis as typeof globalThis & { molstar?: MolstarGlobal };

  const runtime =
    window.molstar ??
    globalScope.molstar ??
    // Mol* UMD bundle is attached to `self` in webviews.
    (typeof self !== "undefined" ? (self as unknown as { molstar?: MolstarGlobal }).molstar : undefined);

  if (!runtime) {
    throw new Error("Mol* runtime is not available in the webview.");
  }
  return runtime;
}

export class MolstarController {
  private readonly viewer: MolstarViewer;
  private readonly report: Reporter;
  private readonly loadingQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private isDisposed = false;

  private constructor(viewer: MolstarViewer, report: Reporter) {
    this.viewer = viewer;
    this.report = report;
  }

  public static async create(containerId: string, report: Reporter): Promise<MolstarController> {
    const molstar = ensureMolstarRuntime();
    const config = parseViewerQueryConfig();

    if (config.debugMode && molstar.setDebugMode) {
      molstar.setDebugMode(config.debugMode, config.debugMode);
    }

    const viewer = await molstar.Viewer.create(containerId, {
      layoutShowControls: !config.hideControls,
      viewportShowExpand: false,
      collapseLeftPanel: config.collapseLeftPanel,
      pdbProvider: config.pdbProvider || "pdbe",
      emdbProvider: config.emdbProvider || "pdbe",
      volumeStreamingServer:
        (config.mapProvider || "pdbe") === "rcsb"
          ? "https://maps.rcsb.org"
          : "https://www.ebi.ac.uk/pdbe/densities",
      pixelScale: config.pixelScale ?? 1,
      pickScale: config.pickScale ?? 0.25,
      pickPadding: config.pickPadding ?? 1,
      enableWboit: config.disableWboit ? true : undefined,
      preferWebgl1: config.preferWebgl1
    });

    return new MolstarController(viewer, report);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.loadingQueue.length = 0;
  }

  public async handleCommand(message: ExtensionToWebviewMessage): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    switch (message.command) {
      case "loadPdb":
        await this.loadPdb(message.accession);
        break;
      case "loadAlphaFoldDb":
        await this.loadAlphaFold(message.accession);
        break;
      case "loadEmdb":
        await this.loadEmdb(message.accession);
        break;
      case "loadStructure":
        this.enqueueTask(() => this.loadStructure(message));
        break;
      case "loadVolume":
        this.enqueueTask(() => this.loadVolume(message));
        break;
    }
  }

  private emitInfo(info: string): void {
    this.report({ command: "info", info });
  }

  private emitError(error: string): void {
    this.report({ command: "error", error });
  }

  private emitDebug(message: string): void {
    this.report({ command: "debug", message });
  }

  private enqueueTask(task: () => Promise<void>): void {
    this.loadingQueue.push(task);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.isDisposed) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.loadingQueue.length > 0 && !this.isDisposed) {
      const task = this.loadingQueue.shift();
      if (!task) {
        continue;
      }

      try {
        await task();
      } catch (error) {
        this.emitError(`Failed to process queued loading task: ${getErrorMessage(error)}`);
      }
    }

    this.isProcessingQueue = false;
  }

  private async loadPdb(accession: string): Promise<void> {
    try {
      await this.viewer.loadPdb(accession);
      this.emitInfo(`Loaded PDB: ${accession}`);
    } catch (error) {
      this.emitError(`Failed to load PDB ${accession}: ${getErrorMessage(error)}`);
    }
  }

  private async loadAlphaFold(accession: string): Promise<void> {
    try {
      await this.viewer.loadAlphaFoldDb(accession);
      this.emitInfo(`Loaded AlphaFoldDB: ${accession}`);
    } catch (error) {
      this.emitError(`Failed to load AlphaFoldDB ${accession}: ${getErrorMessage(error)}`);
    }
  }

  private async loadEmdb(accession: string): Promise<void> {
    const emdbId = `emd-${accession}`;
    try {
      await this.viewer.loadEmdb(emdbId);
      this.emitInfo(`Loaded EMDB: ${emdbId}`);
    } catch (error) {
      this.emitError(`Failed to load EMDB ${emdbId}: ${getErrorMessage(error)}`);
    }
  }

  private base64ToUint8Array(base64Data: string): Uint8Array {
    return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
  }

  private async decompressGzip(compressedData: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser does not support gzip decompression.");
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(compressedData);
        controller.close();
      }
    });

    const decompressor =
      new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>;
    const decompressedStream = stream.pipeThrough(decompressor);
    const response = new Response(decompressedStream);
    const decompressedArrayBuffer = await response.arrayBuffer();
    return new Uint8Array(decompressedArrayBuffer);
  }

  private toBlobPayload(data: Uint8Array): ArrayBuffer {
    const normalizedData = data.slice();
    return normalizedData.buffer;
  }

  private async createBinaryBlob(
    data: string,
    isCompressed: boolean,
    mimeType: string
  ): Promise<Blob> {
    let finalData = this.base64ToUint8Array(data);
    if (isCompressed) {
      this.emitDebug("Decompressing gzip content in webview.");
      finalData = await this.decompressGzip(finalData);
    }

    return new Blob([this.toBlobPayload(finalData)], { type: mimeType });
  }

  private async loadStructure(
    message: Extract<ExtensionToWebviewMessage, { command: "loadStructure" }>
  ): Promise<void> {
    let blobUrl: string | undefined;

    try {
      const blob = message.isBinary
        ? await this.createBinaryBlob(message.data, message.isCompressed, "text/plain")
        : new Blob([message.data], { type: "text/plain" });

      blobUrl = URL.createObjectURL(blob);
      const structureParams = {
        label: message.label,
        name: message.label,
        id: message.label
      };

      await this.viewer.loadStructureFromUrl(blobUrl, message.format, false, structureParams);
      this.emitInfo(`Loaded structure: ${message.label}`);
    } catch (error) {
      this.emitError(`Failed to load structure ${message.label}: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    }
  }

  private async loadVolume(
    message: Extract<ExtensionToWebviewMessage, { command: "loadVolume" }>
  ): Promise<void> {
    if (!this.viewer.loadVolumeFromUrl) {
      this.emitError("Volume loading is not supported in this Mol* version.");
      return;
    }

    let blobUrl: string | undefined;

    try {
      const blob = message.isBinary
        ? await this.createBinaryBlob(message.data, message.isCompressed, "application/octet-stream")
        : new Blob([message.data], { type: "text/plain" });

      blobUrl = URL.createObjectURL(blob);

      const isosurfaces = [
        {
          type: "absolute",
          value: 0.1,
          color: 0x33bb33,
          alpha: 0.34,
          entryId: message.label
        }
      ];

      const volumeParams = {
        url: blobUrl,
        format: message.format,
        isBinary: message.isBinary,
        label: message.label,
        name: message.label,
        id: message.label
      };

      await this.viewer.loadVolumeFromUrl(volumeParams, isosurfaces);
      this.renameLastVolume(message.label);
      this.emitInfo(`Loaded volume: ${message.label}`);
    } catch (error) {
      this.emitError(`Failed to load volume ${message.label}: ${getErrorMessage(error)}`);
      throw error;
    } finally {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    }
  }

  private renameLastVolume(label: string): void {
    const volumeItems = this.viewer.plugin?.managers?.volume?.hierarchy?.current?.volumes;
    if (!volumeItems || volumeItems.length === 0) {
      return;
    }

    const lastVolume = volumeItems[volumeItems.length - 1];
    if (lastVolume.cell?.obj) {
      lastVolume.cell.obj.label = label;
    }
  }
}
