import { useEffect, useState } from "react";
import type { StudioTheme } from "@molstudio/react";

/** VS Code marks the webview body with `vscode-light`, `vscode-dark` or a high-contrast class. */
function currentTheme(): StudioTheme {
  const classes = document.body.classList;
  return classes.contains("vscode-light") || classes.contains("vscode-high-contrast-light") ? "light" : "dark";
}

export function useVsCodeTheme(): StudioTheme {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
