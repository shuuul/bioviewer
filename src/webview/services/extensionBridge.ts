import type { SaveFile } from "@molstudio/react";
import type { SaveResultMessage, WebviewToExtensionMessage } from "../../shared/webviewProtocol";
import { isExtensionToWebviewMessage } from "../../shared/webviewProtocol";
import { getErrorMessage } from "../../shared/errors";
import { ViewerController, type ViewerBackend } from "./viewerController";

const vscode = acquireVsCodeApi();

export function postToExtension(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

/**
 * Connects the webview to the extension for its whole lifetime: runs load requests once a viewer
 * is attached, forwards errors, and correlates image saves.
 */
export class ExtensionBridge {
  private controller: ViewerController | null = null;
  private readonly pendingSaves = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  private nextSaveId = 0;

  constructor() {
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (!isExtensionToWebviewMessage(event.data)) {
        const command = (event.data as { command?: unknown } | null)?.command;
        if (typeof command === "string") {
          postToExtension({ command: "error", error: `The viewer received a malformed ${command} message.` });
        }
        return;
      }
      const message = event.data;
      if (message.command === "saveResult") {
        this.settleSave(message);
      } else if (this.controller) {
        this.controller.enqueue(message);
      } else {
        // The extension only sends loads after `ready`, which `attach` posts.
        postToExtension({ command: "loadResult", requestId: message.requestId, success: false, error: "The viewer has not started." });
      }
    });
    window.addEventListener("error", (event) => {
      postToExtension({ command: "error", error: `Webview error: ${event.error?.message ?? event.message}` });
    });
    window.addEventListener("unhandledrejection", (event) => {
      postToExtension({ command: "error", error: `Promise rejection: ${getErrorMessage(event.reason)}` });
    });
  }

  /** Starts running load requests against a mounted viewer. */
  attach(backend: ViewerBackend): void {
    this.controller = new ViewerController(backend, postToExtension);
    postToExtension({ command: "ready" });
  }

  /** Reports a viewer error; before the viewer is attached it fails the panel's startup. */
  reportError(error: Error): void {
    if (this.controller) {
      postToExtension({ command: "error", error: error.message });
    } else {
      postToExtension({ command: "startupFailed", error: error.message });
    }
  }

  saveFile: SaveFile = async (file, filename) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const requestId = String(++this.nextSaveId);
    await new Promise<void>((resolve, reject) => {
      this.pendingSaves.set(requestId, { resolve, reject });
      postToExtension({ command: "saveFile", requestId, filename, data });
    });
  };

  private settleSave(message: SaveResultMessage): void {
    const pending = this.pendingSaves.get(message.requestId);
    if (!pending) {
      return;
    }
    this.pendingSaves.delete(message.requestId);
    if (message.success) {
      pending.resolve();
    } else {
      pending.reject(new Error(message.error));
    }
  }
}
