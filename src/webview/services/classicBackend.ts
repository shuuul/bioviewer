import type { Viewer } from "molstar/lib/apps/viewer/app";
import type { LoadDataOptions, MarkerSet, StructureFormat, VolumeFormat } from "@molstudio/core";
import { buildMarkerPlyMesh } from "./markerPly";
import type { ViewerBackend } from "./viewerController";

/** Adapts Mol*'s prebuilt Viewer app (loaded as `window.molstar`) to the loading surface BioViewer uses. */
export class ClassicBackend implements ViewerBackend {
  constructor(private readonly viewer: Viewer) {}

  get plugin(): Viewer["plugin"] {
    return this.viewer.plugin;
  }

  loadPdb(id: string): Promise<void> {
    return this.expectStructure(() => this.viewer.loadPdb(id.trim().toLowerCase()));
  }

  loadAlphaFoldDb(uniprotId: string): Promise<void> {
    return this.expectStructure(() => this.viewer.loadAlphaFoldDb(uniprotId.trim().toUpperCase()));
  }

  loadEmdb(id: string): Promise<void> {
    const value = id.trim().toUpperCase();
    const emdbId = /^\d+$/.test(value) ? `EMD-${value}` : value;
    return this.expectVolume(() => this.viewer.loadEmdb(emdbId));
  }

  loadStructure({ data, label, format }: LoadDataOptions<StructureFormat>): Promise<void> {
    return this.expectStructure(async () => {
      const raw = await this.plugin.builders.data.rawData({ data, label });
      const trajectory = await this.plugin.builders.structure.parseTrajectory(raw, format);
      await this.plugin.builders.structure.hierarchy.applyPreset(trajectory, "default");
    });
  }

  loadVolume({ data, label, format }: LoadDataOptions<VolumeFormat>): Promise<void> {
    return this.expectVolume(async () => {
      const provider = this.plugin.dataFormats.get(format);
      if (!provider) {
        throw new Error(`Mol* has no volume reader for format "${format}".`);
      }
      const raw = await this.plugin.builders.data.rawData({ data, label });
      const parsed = await provider.parse(this.plugin, raw);
      await provider.visuals?.(this.plugin, parsed);
    });
  }

  /** The prebuilt Mol* has no MolStudio marker shape, so the set is drawn as a mesh through its PLY reader. */
  async loadMarkers(markerSet: MarkerSet): Promise<void> {
    const provider = this.plugin.dataFormats.get("ply");
    if (!provider?.visuals) {
      throw new Error("Mol* has no PLY mesh reader for marker files.");
    }
    const raw = await this.plugin.builders.data.rawData({ data: buildMarkerPlyMesh(markerSet), label: markerSet.label });
    const parsed = await provider.parse(this.plugin, raw);
    const shape = (parsed as { shape?: { cell?: { obj?: { label: string; data?: { label: string } } } } }).shape?.cell?.obj;
    if (!shape?.data) {
      throw new Error(`Marker set ${markerSet.label} produced no shape.`);
    }
    shape.label = markerSet.label;
    shape.data.label = markerSet.label;
    await provider.visuals(this.plugin, parsed);
  }

  /** Mol* parses some malformed input into an empty structure without failing, so check the result. */
  private async expectStructure(load: () => Promise<void>): Promise<void> {
    const structures = () => this.plugin.managers.structure.hierarchy.current.structures;
    const before = structures().length;
    await load();
    const added = structures().slice(before);
    if (!added.some((ref) => ref.cell.obj?.data.elementCount)) {
      throw new Error("Loading produced no molecular structure.");
    }
  }

  private async expectVolume(load: () => Promise<void>): Promise<void> {
    const before = this.plugin.managers.volume.hierarchy.current.volumes.length;
    await load();
    if (this.plugin.managers.volume.hierarchy.current.volumes.length <= before) {
      throw new Error("Loading produced no volume.");
    }
  }
}
