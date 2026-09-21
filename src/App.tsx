import { useEffect, useState } from "react";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";

import { PluginConfig, setEnabled } from "./api";
import { getCachedConfig, refreshConfig, restoreIfNeeded, setCachedConfig, subscribeConfig } from "./hider";
import ModeSelector from "./ModeSelector";
import AppList from "./AppList";
import ActivityLog from "./ActivityLog";
import Settings from "./Settings";

export default function App() {
  const [config, setConfig] = useState<PluginConfig | null>(getCachedConfig());

  useEffect(() => {
    void refreshConfig();
    return subscribeConfig(() => setConfig(getCachedConfig()));
  }, []);

  if (!config) {
    return (
      <PanelSection title="ActivityHide">
        <PanelSectionRow>Loading...</PanelSectionRow>
      </PanelSection>
    );
  }

  const onToggleEnabled = async (value: boolean) => {
    const next = await setEnabled(value);
    setCachedConfig(next);
    if (!value) restoreIfNeeded();
  };

  return (
    <>
      <PanelSection title="ActivityHide">
        <PanelSectionRow>
          <ToggleField
            label="Hide activity"
            description="Go invisible to friends while a selected app runs. Tip: long-press a game → ActivityHide: Enable"
            checked={config.enabled}
            onChange={onToggleEnabled}
          />
        </PanelSectionRow>
      </PanelSection>

      <ModeSelector config={config} />
      {config.mode !== "global" && <AppList config={config} />}
      <ActivityLog />
      <Settings config={config} />
    </>
  );
}
