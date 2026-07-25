declare module "*.css";

interface VsCodeWebviewApi {
  postMessage: (message: unknown) => void;
  getState: <T = unknown>() => T | undefined;
  setState: (state: unknown) => void;
}

declare function acquireVsCodeApi(): VsCodeWebviewApi;
