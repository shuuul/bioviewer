import type { Viewer } from "molstar/lib/apps/viewer/app";
import { ClassicBackend } from "./services/classicBackend";
import { getErrorMessage } from "../shared/errors";
import { ExtensionBridge } from "./services/extensionBridge";
import "./styles.css";

declare global {
  interface Window {
    /** Mol*'s prebuilt viewer bundle, loaded by a script tag before this one. */
    molstar?: { Viewer: typeof Viewer };
  }
}

const bridge = new ExtensionBridge();

async function start(): Promise<void> {
  if (!window.molstar) {
    throw new Error("Mol* runtime is not available in the webview.");
  }
  const viewer = await window.molstar.Viewer.create("root", {
    layoutShowControls: true,
    viewportShowExpand: false,
    pdbProvider: "pdbe",
    emdbProvider: "pdbe",
  });
  bridge.attach(new ClassicBackend(viewer));
}

start().catch((error: unknown) => {
  bridge.reportError(new Error(`Failed to start the classic Mol* viewer: ${getErrorMessage(error)}`));
});
