import type { MolStudio } from "@molstudio/core";
import type {
  LoadMessage,
  WebviewToExtensionMessage,
} from "../../shared/webviewProtocol";
import { buildCmmPlyMesh, parseCmmMarkerSet } from "./cmmMarkers";
import { getErrorMessage } from "./errorUtils";

type Reporter = (message: WebviewToExtensionMessage) => void;
type StructureFormat = Parameters<MolStudio["loadStructure"]>[0]["format"];
type VolumeFormat = Parameters<MolStudio["loadVolume"]>[0]["format"];

/** Runs extension load requests against the viewer one at a time and settles each with a `loadResult`. */
export class ViewerController {
  private readonly queue: LoadMessage[] = [];
  private processing = false;
  private disposed = false;

  constructor(
    private readonly studio: MolStudio,
    private readonly report: Reporter,
  ) {}

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
  }

  enqueue(message: LoadMessage): void {
    if (this.disposed) {
      return;
    }
    this.queue.push(message);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0 && !this.disposed) {
        const message = this.queue.shift()!;
        try {
          const info = await this.load(message);
          if (!this.disposed) {
            this.report({ command: "info", info });
            this.report({ command: "loadResult", requestId: message.requestId, success: true });
          }
        } catch (error) {
          if (!this.disposed) {
            this.report({ command: "loadResult", requestId: message.requestId, success: false, error: getErrorMessage(error) });
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /** Loads one request and returns the log line for the extension. */
  private async load(message: LoadMessage): Promise<string> {
    switch (message.command) {
      case "loadPdb":
        await this.withContext(`PDB ${message.accession}`, () => this.studio.loadPdb(message.accession));
        return `Loaded PDB: ${message.accession}`;
      case "loadAlphaFoldDb":
        await this.withContext(`AlphaFoldDB ${message.accession}`, () => this.studio.loadAlphaFoldDb(message.accession));
        return `Loaded AlphaFoldDB: ${message.accession}`;
      case "loadEmdb":
        await this.withContext(`EMDB ${message.accession}`, () => this.studio.loadEmdb(message.accession));
        return `Loaded EMDB: ${message.accession}`;
      case "loadStructure": {
        // Every structure format BioViewer opens is text; Mol* would read bytes as BinaryCIF.
        const data = await this.decodeText(message);
        await this.withContext(`structure ${message.label}`, () =>
          this.studio.loadStructure({ data, label: message.label, format: message.format as StructureFormat }),
        );
        return `Loaded structure: ${message.label}`;
      }
      case "loadVolume": {
        const data = await this.decode(message);
        await this.withContext(`volume ${message.label}`, () =>
          this.studio.loadVolume({ data, label: message.label, format: message.format as VolumeFormat }),
        );
        return `Loaded volume: ${message.label}`;
      }
      case "loadMarkers":
        return this.withContext(`markers ${message.label}`, () => this.loadMarkers(message));
    }
  }

  private async withContext<T>(what: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      throw new Error(`Failed to load ${what}: ${getErrorMessage(error)}`);
    }
  }

  private async decode(
    message: Extract<LoadMessage, { data: string }>,
  ): Promise<string | Uint8Array<ArrayBuffer>> {
    if (!message.isBinary) {
      if (message.isCompressed) {
        throw new Error("Compressed files must be binary encoded.");
      }
      return message.data;
    }
    const bytes = await base64ToBytes(message.data);
    if (!message.isCompressed) {
      return bytes;
    }
    this.report({ command: "debug", message: "decompressing gzip content in webview" });
    return gunzip(bytes);
  }

  private async decodeText(message: Extract<LoadMessage, { data: string }>): Promise<string> {
    const data = await this.decode(message);
    return typeof data === "string" ? data : new TextDecoder().decode(data);
  }

  private async loadMarkers(message: Extract<LoadMessage, { command: "loadMarkers" }>): Promise<string> {
    const markerSet = parseCmmMarkerSet(await this.decodeText(message), message.label);

    const plugin = this.studio.plugin;
    const provider = plugin.dataFormats.get("ply");
    if (!provider?.visuals) {
      throw new Error("Mol* has no PLY mesh reader for marker files.");
    }
    const raw = await plugin.builders.data.rawData({ data: buildCmmPlyMesh(markerSet), label: message.label });
    const parsed = await provider.parse(plugin, raw);
    const shape = (parsed as { shape?: { cell?: { obj?: { label: string; data?: { label: string } } } } }).shape?.cell?.obj;
    if (!shape?.data) {
      throw new Error("Marker loading produced no shape.");
    }
    shape.label = message.label;
    shape.data.label = message.label;
    await provider.visuals(plugin, parsed);
    return `Loaded markers: ${message.label} (${markerSet.markers.length} marker(s), ${markerSet.links.length} link(s))`;
  }
}

async function base64ToBytes(base64: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(`data:application/octet-stream;base64,${base64}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Base64 without the data-URL prefix, for sending binary files over postMessage. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the exported file."));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
