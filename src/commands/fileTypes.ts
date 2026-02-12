import type { FileLoadCommand } from "../shared/webviewProtocol";

export const SUPPORTED_EXTENSIONS = [
  "pdb",
  "cif",
  "mmcif",
  "mcif",
  "ent",
  "map",
  "mrc",
  "ccp4",
  "sdf",
  "sd",
  "mol",
  "mol2",
  "pdbqt"
] as const;

export interface FileLoadConfig {
  format: string;
  command: FileLoadCommand;
}

export function buildSearchPattern(relativePath: string): string {
  const gzExtensions = SUPPORTED_EXTENSIONS.map((extension) => `${extension}.gz`);
  const allExtensions = [...SUPPORTED_EXTENSIONS, ...gzExtensions];
  return `${relativePath}/*.{${allExtensions.join(",")}}`;
}

export function buildFileFilters(): Record<string, string[]> {
  return {
    "All Supported Files": SUPPORTED_EXTENSIONS.flatMap((extension) => [extension, `${extension}.gz`]),
    "Structure Files": ["pdb", "cif", "mmcif", "mcif", "ent"].flatMap((extension) => [extension, `${extension}.gz`]),
    "Volume/Density Maps": ["map", "mrc", "ccp4"].flatMap((extension) => [extension, `${extension}.gz`]),
    "Small Molecules": ["sdf", "sd", "mol", "mol2", "pdbqt"].flatMap((extension) => [extension, `${extension}.gz`])
  };
}

export function getFileConfig(extension: string): FileLoadConfig | null {
  let actualExtension = extension;
  if (extension.endsWith(".gz")) {
    actualExtension = extension.slice(0, -3);
  }

  if ([".pdb", ".ent"].includes(actualExtension)) {
    return { format: "pdb", command: "loadStructure" };
  }

  if ([".cif", ".mmcif", ".mcif"].includes(actualExtension)) {
    return { format: "mmcif", command: "loadStructure" };
  }

  if ([".map", ".mrc", ".ccp4"].includes(actualExtension)) {
    return { format: "ccp4", command: "loadVolume" };
  }

  if ([".sdf", ".sd", ".mol", ".mol2", ".pdbqt"].includes(actualExtension)) {
    return { format: "sdf", command: "loadStructure" };
  }

  return null;
}
