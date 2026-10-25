export type DatabaseCommand = "loadPdb" | "loadAlphaFoldDb" | "loadEmdb";
export type FileLoadCommand = "loadStructure" | "loadVolume" | "loadMarkers";
export type ExtensionCommand = DatabaseCommand | FileLoadCommand;

type LoadPayload =
  | { command: DatabaseCommand; accession: string }
  | {
      [Command in "loadStructure" | "loadVolume"]: {
        command: Command;
        data: string;
        format: string;
        isBinary: boolean;
        isCompressed: boolean;
        label: string;
      }
    }["loadStructure" | "loadVolume"]
  | {
      command: "loadMarkers";
      data: string;
      format: "cmm";
      isBinary: boolean;
      isCompressed: boolean;
      label: string;
    };

export type ExtensionToWebviewMessage = LoadPayload & { requestId: string };

export type WebviewToExtensionMessage =
  | { command: "ready" }
  | { command: "error"; error: string }
  | { command: "info"; info: string }
  | { command: "debug"; message: string }
  | { command: "loadResult"; requestId: string; success: true }
  | { command: "loadResult"; requestId: string; success: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

function hasRequestId(value: Record<string, unknown>): boolean {
  return typeof value.requestId === "string" && value.requestId.trim().length > 0;
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
    case "loadResult":
      return hasRequestId(value) && (
        value.success === true ||
        (value.success === false && hasString(value, "error"))
      );
    default:
      return false;
  }
}

export function isExtensionToWebviewMessage(value: unknown): value is ExtensionToWebviewMessage {
  if (!isRecord(value) || !hasRequestId(value)) {
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
      return hasString(value, "data") &&
        hasString(value, "format") &&
        (value.command !== "loadMarkers" || value.format === "cmm") &&
        typeof value.isBinary === "boolean" &&
        typeof value.isCompressed === "boolean" &&
        hasString(value, "label");
    default:
      return false;
  }
}
