import { useEffect, useRef, useState } from "react";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "../shared/webviewProtocol";
import { isExtensionToWebviewMessage } from "../shared/webviewProtocol";
import { MolstarController } from "./molstarController";

type ViewerStatus = "initializing" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function App() {
  const [status, setStatus] = useState<ViewerStatus>("initializing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MolstarController | null>(null);
  const pendingMessagesRef = useRef<ExtensionToWebviewMessage[]>([]);

  useEffect(() => {
    const vscode = acquireVsCodeApi();

    const postToExtension = (message: WebviewToExtensionMessage): void => {
      vscode.postMessage(message);
    };

    const handleCommand = (message: ExtensionToWebviewMessage): void => {
      const controller = controllerRef.current;
      if (!controller) {
        pendingMessagesRef.current.push(message);
        return;
      }

      void controller.handleCommand(message);
    };

    const handleMessageEvent = (event: MessageEvent<unknown>): void => {
      if (!isExtensionToWebviewMessage(event.data)) {
        return;
      }

      handleCommand(event.data);
    };

    const handleWindowError = (event: ErrorEvent): void => {
      postToExtension({
        command: "error",
        error: `Webview error: ${event.error?.message ?? event.message ?? "Unknown error"}`
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      postToExtension({
        command: "error",
        error: `Promise rejection: ${getErrorMessage(event.reason)}`
      });
    };

    const initializeViewer = async (): Promise<void> => {
      try {
        if (!containerRef.current) {
          throw new Error("Viewer container was not found.");
        }

        const controller = await MolstarController.create("molstar-container", postToExtension);
        controllerRef.current = controller;

        for (const queuedMessage of pendingMessagesRef.current) {
          await controller.handleCommand(queuedMessage);
        }
        pendingMessagesRef.current = [];

        setStatus("ready");
        postToExtension({ command: "ready" });
      } catch (error) {
        const message = `Failed to initialize viewer: ${getErrorMessage(error)}`;
        setStatus("error");
        setErrorMessage(message);
        postToExtension({ command: "error", error: message });
      }
    };

    window.addEventListener("message", handleMessageEvent);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    void initializeViewer();

    return () => {
      window.removeEventListener("message", handleMessageEvent);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      controllerRef.current?.dispose();
      controllerRef.current = null;
      pendingMessagesRef.current = [];
    };
  }, []);

  const loadingLabel =
    status === "error" ? errorMessage : "Initializing BioViewer with Mol*...";

  return (
    <div className="bioviewer-root">
      <div id="molstar-container" ref={containerRef} className="molstar-container" />
      {status !== "ready" && (
        <div className="viewer-overlay" role="status" aria-live="polite">
          <div className="loading-panel">
            {status === "initializing" && <div className="loading-spinner" />}
            <p className="loading-label">{loadingLabel}</p>
          </div>
        </div>
      )}
    </div>
  );
}
