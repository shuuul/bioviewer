import { useState } from "react";
import { Studio } from "@molstudio/react";
import type { ViewerSettings, WebviewConfig } from "../shared/webviewProtocol";
import { postToExtension, useExtensionBridge } from "./hooks/useExtensionBridge";
import { useVsCodeTheme } from "./hooks/useVsCodeTheme";

export function App({ config }: { config: WebviewConfig }) {
  const theme = useVsCodeTheme();
  const bridge = useExtensionBridge();
  const [settings, setSettings] = useState(config.settings);

  const update = (change: Partial<ViewerSettings>): void => {
    const next = { ...settings, ...change };
    setSettings(next);
    postToExtension({ command: "updateSettings", settings: next });
  };

  return (
    <Studio
      theme={theme}
      customColors={settings.customColors}
      onCustomColorsChange={(customColors) => update({ customColors })}
      locale={settings.locale ?? config.displayLanguage}
      onLocaleChange={(locale) => update({ locale })}
      onOpenFile={() => postToExtension({ command: "openFiles" })}
      onReady={bridge.attach}
      onError={(error) => postToExtension({ command: "error", error: error.message })}
      saveFile={bridge.saveFile}
    />
  );
}
