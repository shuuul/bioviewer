import { useEffect, useState } from "react";
import { editorTheme, onEditorThemeChange } from "../services/vscodeTheme";

export function useVsCodeTheme() {
  const [theme, setTheme] = useState(editorTheme);
  useEffect(() => onEditorThemeChange(setTheme), []);
  return theme;
}
