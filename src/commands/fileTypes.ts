import type { FileLoadCommand } from "../shared/webviewProtocol";

interface FileKind {
  group: string;
  command: FileLoadCommand;
  /** Mol* format per extension. Every extension also opens with a `.gz` suffix. */
  formats: Record<string, string>;
}

// Keep the extension lists in sync with the explorer menu `when` clauses in package.json.
const FILE_KINDS: FileKind[] = [
  {
    group: "Structure Files",
    command: "loadStructure",
    formats: { pdb: "pdb", ent: "pdb", cif: "mmcif", mmcif: "mmcif", mcif: "mmcif" },
  },
  {
    group: "Volume/Density Maps",
    command: "loadVolume",
    formats: { map: "ccp4", mrc: "ccp4", ccp4: "ccp4" },
  },
  {
    group: "Small Molecules",
    command: "loadStructure",
    formats: { sdf: "sdf", sd: "sdf", mol: "mol", mol2: "mol2", pdbqt: "pdbqt" },
  },
  {
    group: "Marker Files",
    command: "loadMarkers",
    formats: { cmm: "cmm" },
  },
];

const SUPPORTED_EXTENSIONS = FILE_KINDS.flatMap((kind) => Object.keys(kind.formats));

export interface FileLoadConfig {
  command: FileLoadCommand;
  format: string;
  /** File name without its format extension and `.gz` suffix. */
  label: string;
  isCompressed: boolean;
}

/** Resolves how to load `name.ext` or `name.ext.gz`; null when the format is unsupported. */
export function getFileConfig(fileName: string): FileLoadConfig | null {
  const isCompressed = fileName.toLowerCase().endsWith(".gz");
  const base = isCompressed ? fileName.slice(0, -3) : fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const extension = base.slice(dot + 1).toLowerCase();
  for (const kind of FILE_KINDS) {
    const format = kind.formats[extension];
    if (format) {
      return { command: kind.command, format, label: base.slice(0, dot), isCompressed };
    }
  }
  return null;
}

export function isSupportedFileName(fileName: string): boolean {
  return getFileConfig(fileName) !== null;
}

export function buildFileFilters(): Record<string, string[]> {
  const withGzip = (extensions: string[]) => extensions.flatMap((extension) => [extension, `${extension}.gz`]);
  const filters: Record<string, string[]> = { "All Supported Files": withGzip(SUPPORTED_EXTENSIONS) };
  for (const kind of FILE_KINDS) {
    filters[kind.group] = withGzip(Object.keys(kind.formats));
  }
  return filters;
}
