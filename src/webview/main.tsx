import { createRoot } from "react-dom/client";
import "@molstudio/react/styles.css";
import { getErrorMessage } from "../shared/errors";
import { isWebviewConfig, type WebviewConfig } from "../shared/webviewProtocol";
import { App } from "./App";
import { ExtensionBridge } from "./services/extensionBridge";
import { loadSurfaceEngineAssets } from "./services/studioSurfaceEngine";
import "./styles.css";

function readConfig(root: HTMLElement): WebviewConfig {
  const rawConfig = root.dataset.config;
  if (!rawConfig) {
    throw new Error("The webview config is missing.");
  }
  const value: unknown = JSON.parse(rawConfig);
  if (!isWebviewConfig(value)) {
    throw new Error("The webview config is missing its settings or surface engine assets.");
  }
  return value;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("The webview root element is missing.");
}
const config = readConfig(rootElement);
const bridge = new ExtensionBridge();

loadSurfaceEngineAssets(config.surfaceEngine)
  .then((surfaceEngine) => {
    createRoot(rootElement).render(<App config={config} bridge={bridge} surfaceEngine={surfaceEngine} />);
  })
  .catch((error: unknown) => {
    bridge.reportError(new Error(`Failed to start the studio viewer: ${getErrorMessage(error)}`));
  });
