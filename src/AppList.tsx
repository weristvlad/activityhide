import { useMemo } from "react";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";

import { PluginConfig, toggleApp } from "./api";
import { setCachedConfig } from "./hider";
import { isListed } from "./policy";
import { AppInfo, listShortcuts } from "./steam";

/**
 * Non-Steam shortcuts from Steam's own collection store, with a toggle per app.
 * The same toggle is reachable from each game's context menu ("ActivityHide: Enable").
 */
export default function AppList({ config }: { config: PluginConfig }) {
  const shortcuts = useMemo(listShortcuts, []);
  const title = config.mode === "whitelist" ? "Keep visible for" : "Hide activity for";

  const onToggle = async (app: AppInfo) => {
    setCachedConfig(await toggleApp(app));
  };

  return (
    <PanelSection title={title}>
      {shortcuts.length === 0 && <PanelSectionRow>No non-Steam apps in the library</PanelSectionRow>}
      {shortcuts.map((app) => (
        <PanelSectionRow key={app.appid}>
          <ToggleField label={app.name} checked={isListed(app.appid, config)} onChange={() => onToggle(app)} />
        </PanelSectionRow>
      ))}
    </PanelSection>
  );
}
