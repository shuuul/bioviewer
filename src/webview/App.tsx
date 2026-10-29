import { useEffect, useState } from "react";
import { Studio } from "@molstudio/react";
import type { ViewerSettings, WebviewConfig } from "../shared/webviewProtocol";
import { useVsCodeTheme } from "./hooks/useVsCodeTheme";
import { postToExtension, type ExtensionBridge } from "./services/extensionBridge";

export function App({ config, bridge }: { config: WebviewConfig; bridge: ExtensionBridge }) {
  const theme = useVsCodeTheme();
  const [settings, setSettings] = useState(config.settings);

  useEffect(() => {
    if (settings !== config.settings) {
      postToExtension({ command: "updateSettings", settings });
    }
  }, [settings, config.settings]);

  const update = (change: Partial<ViewerSettings>): void => {
    setSettings((current) => ({ ...current, ...change }));
  };

  return (
    <Studio
      theme={theme}
      customColors={settings.customColors}
      onCustomColorsChange={(customColors) => update({ customColors })}
      locale={settings.locale ?? config.displayLanguage}
      onLocaleChange={(locale) => update({ locale })}
      onOpenFile={() => postToExtension({ command: "openFiles" })}
      onReady={(studio) => bridge.attach(studio)}
      onError={(error) => bridge.reportError(error)}
      saveFile={bridge.saveFile}
    />
  );
}
