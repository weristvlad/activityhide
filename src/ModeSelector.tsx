import { PanelSection, PanelSectionRow, Dropdown, DropdownOption } from "@decky/ui";

import { HideMode, PluginConfig, setMode } from "./api";
import { setCachedConfig } from "./hider";

const MODES: DropdownOption[] = [
  { data: "blacklist", label: "Selected apps only" },
  { data: "whitelist", label: "All except selected apps" },
  { data: "global", label: "All non-Steam apps" },
];

export default function ModeSelector({ config }: { config: PluginConfig }) {
  const onChange = async (option: DropdownOption) => {
    setCachedConfig(await setMode(option.data as HideMode));
  };

  return (
    <PanelSection title="Hide Mode">
      <PanelSectionRow>
        <Dropdown rgOptions={MODES} selectedOption={config.mode} onChange={onChange} />
      </PanelSectionRow>
    </PanelSection>
  );
}
