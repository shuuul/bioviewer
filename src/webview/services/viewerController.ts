import type { MarkerSet, MolStudio, StructureFormat, VolumeFormat } from "@molstudio/core";
import type { FileLoad, LoadMessage, WebviewToExtensionMessage } from "../../shared/webviewProtocol";
import { parseCmmMarkerSets } from "./cmmMarkers";
import { getErrorMessage } from "../../shared/errors";

type Reporter = (message: WebviewToExtensionMessage) => void;

/** The loading surface both viewers provide: MolStudio directly, the classic Mol* viewer via an adapter. */
export type ViewerBackend = Pick<MolStudio, "plugin" | "loadPdb" | "loadAlphaFoldDb" | "loadEmdb" | "loadStructure" | "loadVolume" | "loadMarkers">;

/** Runs extension load requests against the viewer one at a time and settles each with a `loadResult`. */
export class ViewerController {
  private readonly queue: LoadMessage[] = [];
  private processing = false;

  constructor(
    private readonly viewer: ViewerBackend,
    private readonly report: Reporter,
  ) {}

  enqueue(message: LoadMessage): void {
    this.queue.push(message);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const message = this.queue.shift()!;
        try {
          const info = await this.load(message);
          this.report({ command: "info", info });
          this.report({ command: "loadResult", requestId: message.requestId, success: true });
        } catch (error) {
          this.report({ command: "loadResult", requestId: message.requestId, success: false, error: getErrorMessage(error) });
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
        await this.withContext(`PDB ${message.accession}`, () => this.viewer.loadPdb(message.accession));
        return `Loaded PDB: ${message.accession}`;
      case "loadAlphaFoldDb":
        await this.withContext(`AlphaFoldDB ${message.accession}`, () => this.viewer.loadAlphaFoldDb(message.accession));
        return `Loaded AlphaFoldDB: ${message.accession}`;
      case "loadEmdb":
        await this.withContext(`EMDB ${message.accession}`, () => this.viewer.loadEmdb(message.accession));
        return `Loaded EMDB: ${message.accession}`;
      case "loadStructure": {
        // Every structure format BioViewer opens is text; Mol* would read bytes as BinaryCIF.
        const data = await this.decodeText(message);
        await this.withContext(`structure ${message.label}`, () =>
          this.viewer.loadStructure({ data, label: message.label, format: message.format as StructureFormat }),
        );
        return `Loaded structure: ${message.label}`;
      }
      case "loadVolume": {
        const data = await this.decode(message);
        await this.withContext(`volume ${message.label}`, () =>
          this.viewer.loadVolume({ data, label: message.label, format: message.format as VolumeFormat }),
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

  private async decode(message: FileLoad): Promise<Uint8Array<ArrayBuffer>> {
    // postMessage hands over a copy, so the bytes are always backed by a plain ArrayBuffer.
    const bytes = message.data as Uint8Array<ArrayBuffer>;
    if (!message.isCompressed) {
      return bytes;
    }
    this.report({ command: "debug", message: "decompressing gzip content in webview" });
    return gunzip(bytes);
  }

  private async decodeText(message: FileLoad): Promise<string> {
    return new TextDecoder().decode(await this.decode(message));
  }

  /** Loads each marker_set of a CMM file as its own object, so sets show, hide and restyle separately. */
  private async loadMarkers(message: FileLoad): Promise<string> {
    const markerSets = parseCmmMarkerSets(await this.decodeText(message), message.label);
    for (const markerSet of markerSets) {
      await this.viewer.loadMarkers(markerSet);
    }
    return `Loaded markers: ${message.label} (${describeMarkerSets(markerSets)})`;
  }
}

function describeMarkerSets(markerSets: MarkerSet[]): string {
  const markers = markerSets.reduce((total, markerSet) => total + markerSet.markers.length, 0);
  const links = markerSets.reduce((total, markerSet) => total + markerSet.links.length, 0);
  const counts = `${markers} marker(s), ${links} link(s)`;
  return markerSets.length === 1 ? counts : `${markerSets.length} marker sets, ${counts}`;
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
