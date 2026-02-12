import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Webview root element not found.");
}

const root = createRoot(rootElement);
root.render(<App />);
