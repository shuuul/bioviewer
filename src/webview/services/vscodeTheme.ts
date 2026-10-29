export type EditorTheme = "light" | "dark";

/** VS Code marks the webview body with `vscode-light`, `vscode-dark` or a high-contrast class. */
export function editorTheme(): EditorTheme {
  const classes = document.body.classList;
  return classes.contains("vscode-light") || classes.contains("vscode-high-contrast-light") ? "light" : "dark";
}

/** Calls `listener` whenever the VS Code color theme changes; returns the unsubscribe function. */
export function onEditorThemeChange(listener: (theme: EditorTheme) => void): () => void {
  const observer = new MutationObserver(() => listener(editorTheme()));
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
