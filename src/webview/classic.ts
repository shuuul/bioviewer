import type { Viewer } from "molstar/lib/apps/viewer/app";
import type { Color } from "molstar/lib/mol-util/color";
import { ClassicBackend } from "./services/classicBackend";
import { getErrorMessage } from "../shared/errors";
import { ExtensionBridge } from "./services/extensionBridge";
import { editorTheme, onEditorThemeChange, type EditorTheme } from "./services/vscodeTheme";
import "./styles.css";

declare global {
  interface Window {
    /** Mol*'s prebuilt viewer bundle, loaded by a script tag before this one. */
    molstar?: { Viewer: typeof Viewer };
  }
}

/** Mol*'s own canvas colors: its default light background and its dark skin's viewport color. */
const CANVAS_BACKGROUND: Record<EditorTheme, Color> = {
  light: 0xfcfbf9 as Color,
  dark: 0x111318 as Color,
};

const bridge = new ExtensionBridge();

/** Switches the Mol* skin stylesheet; its `data-light`/`data-dark` attributes hold the skin URLs. */
function applySkin(theme: EditorTheme): void {
  const link = document.getElementById("molstar-skin");
  const href = link?.dataset[theme];
  if (!(link instanceof HTMLLinkElement) || !href) {
    throw new Error("The classic viewer page has no Mol* skin stylesheet.");
  }
  link.href = href;
}

function applyTheme(viewer: Viewer, theme: EditorTheme): void {
  applySkin(theme);
  viewer.plugin.canvas3d?.setProps({ renderer: { backgroundColor: CANVAS_BACKGROUND[theme] } });
}

async function start(): Promise<void> {
  if (!window.molstar) {
    throw new Error("Mol* runtime is not available in the webview.");
  }
  applySkin(editorTheme());
  const viewer = await window.molstar.Viewer.create("root", {
    layoutShowControls: true,
    viewportShowExpand: false,
    pdbProvider: "pdbe",
    emdbProvider: "pdbe",
  });
  applyTheme(viewer, editorTheme());
  onEditorThemeChange((theme) => applyTheme(viewer, theme));
  bridge.attach(new ClassicBackend(viewer));
}

start().catch((error: unknown) => {
  bridge.reportError(new Error(`Failed to start the classic Mol* viewer: ${getErrorMessage(error)}`));
});
