import { PanelSection, PanelSectionRow, Dropdown, DropdownOption } from "@decky/ui";

import { HideState, PluginConfig, updateConfig } from "./api";
import { setCachedConfig } from "./hider";

const HIDE_STATES: DropdownOption[] = [
  { data: "invisible", label: "Invisible (friends see you offline, chat still works)" },
  { data: "offline", label: "Offline (friends list signed out)" },
];

export default function Settings({ config }: { config: PluginConfig }) {
  const onChange = async (option: DropdownOption) => {
    setCachedConfig(await updateConfig({ hide_state: option.data as HideState }));
  };

  return (
    <PanelSection title="While hidden, set status to">
      <PanelSectionRow>
        <Dropdown rgOptions={HIDE_STATES} selectedOption={config.hide_state} onChange={onChange} />
      </PanelSectionRow>
    </PanelSection>
  );
}
