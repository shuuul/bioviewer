export type DatabaseCommand = "loadPdb" | "loadAlphaFoldDb" | "loadEmdb";
export type FileLoadCommand = "loadStructure" | "loadVolume" | "loadMarkers";
export type ExtensionCommand = DatabaseCommand | FileLoadCommand;

export type ExtensionToWebviewMessage =
  | { command: "loadPdb"; accession: string }
  | { command: "loadAlphaFoldDb"; accession: string }
  | { command: "loadEmdb"; accession: string }
  | {
      command: "loadStructure";
      data: string;
      format: string;
      isBinary: boolean;
      isCompressed: boolean;
      label: string;
    }
  | {
      command: "loadVolume";
      data: string;
      format: string;
      isBinary: boolean;
      isCompressed: boolean;
      label: string;
    }
  | {
      command: "loadMarkers";
      data: string;
      format: "cmm";
      isBinary: boolean;
      isCompressed: boolean;
      label: string;
    };

export type WebviewToExtensionMessage =
  | { command: "ready" }
  | { command: "error"; error: string }
  | { command: "info"; info: string }
  | { command: "debug"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

export function isWebviewToExtensionMessage(value: unknown): value is WebviewToExtensionMessage {
  if (!isRecord(value) || typeof value.command !== "string") {
    return false;
  }

  switch (value.command) {
    case "ready":
      return true;
    case "error":
      return hasString(value, "error");
    case "info":
      return hasString(value, "info");
    case "debug":
      return hasString(value, "message");
    default:
      return false;
  }
}

function isFileLoadMessage(value: Record<string, unknown>): boolean {
  return (
    hasString(value, "data") &&
    hasString(value, "format") &&
    typeof value.isBinary === "boolean" &&
    typeof value.isCompressed === "boolean" &&
    hasString(value, "label")
  );
}

export function isExtensionToWebviewMessage(value: unknown): value is ExtensionToWebviewMessage {
  if (!isRecord(value) || typeof value.command !== "string") {
    return false;
  }

  switch (value.command) {
    case "loadPdb":
    case "loadAlphaFoldDb":
    case "loadEmdb":
      return hasString(value, "accession");
    case "loadStructure":
    case "loadVolume":
    case "loadMarkers":
      return isFileLoadMessage(value);
    default:
      return false;
  }
}
