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

const bridge = new ExtensionBridge();

async function start(): Promise<void> {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("The webview root element is missing.");
  }
  const config = readConfig(rootElement);
  const surfaceEngine = await loadSurfaceEngineAssets(config.surfaceEngine);
  createRoot(rootElement).render(<App config={config} bridge={bridge} surfaceEngine={surfaceEngine} />);
}

start().catch((error: unknown) => {
  bridge.reportError(new Error(`Failed to start the studio viewer: ${getErrorMessage(error)}`));
});
