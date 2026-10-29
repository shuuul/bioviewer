import { createRoot } from "react-dom/client";
import "@molstudio/react/styles.css";
import type { WebviewConfig } from "../shared/webviewProtocol";
import { App } from "./App";
import { ExtensionBridge } from "./services/extensionBridge";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement?.dataset.config) {
  throw new Error("Webview root element or its config is missing.");
}
const config = JSON.parse(rootElement.dataset.config) as WebviewConfig;

const bridge = new ExtensionBridge();

createRoot(rootElement).render(<App config={config} bridge={bridge} />);
