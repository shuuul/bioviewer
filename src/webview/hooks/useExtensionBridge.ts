import { useEffect, useMemo, useRef } from "react";
import type { MolStudio } from "@molstudio/core";
import type { SaveFile } from "@molstudio/react";
import type {
  LoadMessage,
  SaveResultMessage,
  WebviewToExtensionMessage,
} from "../../shared/webviewProtocol";
import { isExtensionToWebviewMessage } from "../../shared/webviewProtocol";
import { getErrorMessage } from "../services/errorUtils";
import { ViewerController, blobToBase64 } from "../services/viewerController";

const vscode = acquireVsCodeApi();

export function postToExtension(message: WebviewToExtensionMessage): void {
  vscode.postMessage(message);
}

interface ExtensionBridge {
  /** Starts running queued and future load requests; call once the viewer is mounted. */
  attach: (studio: MolStudio) => void;
  saveFile: SaveFile;
}

export function useExtensionBridge(): ExtensionBridge {
  const controllerRef = useRef<ViewerController | null>(null);
  const pendingLoads = useRef<LoadMessage[]>([]);
  const pendingSaves = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void }>());
  const nextSaveId = useRef(0);

  useEffect(() => {
    const settleSave = (message: SaveResultMessage): void => {
      const pending = pendingSaves.current.get(message.requestId);
      if (!pending) {
        return;
      }
      pendingSaves.current.delete(message.requestId);
      if (message.success) {
        pending.resolve();
      } else {
        pending.reject(new Error(message.error));
      }
    };

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (!isExtensionToWebviewMessage(event.data)) {
        return;
      }
      const message = event.data;
      if (message.command === "saveResult") {
        settleSave(message);
      } else if (controllerRef.current) {
        controllerRef.current.enqueue(message);
      } else {
        pendingLoads.current.push(message);
      }
    };
    const onError = (event: ErrorEvent): void => {
      postToExtension({ command: "error", error: `Webview error: ${event.error?.message ?? event.message}` });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      postToExtension({ command: "error", error: `Promise rejection: ${getErrorMessage(event.reason)}` });
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return useMemo<ExtensionBridge>(() => ({
    attach(studio) {
      const controller = new ViewerController(studio, postToExtension);
      controllerRef.current = controller;
      for (const message of pendingLoads.current) {
        controller.enqueue(message);
      }
      pendingLoads.current = [];
      postToExtension({ command: "ready" });
    },
    async saveFile(file, filename) {
      const data = await blobToBase64(file);
      const requestId = String(++nextSaveId.current);
      await new Promise<void>((resolve, reject) => {
        pendingSaves.current.set(requestId, { resolve, reject });
        postToExtension({ command: "saveFile", requestId, filename, data });
      });
    },
  }), []);
}
