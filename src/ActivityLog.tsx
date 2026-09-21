import { useEffect, useState } from "react";
import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";

import { ActivityLogEntry, clearActivityLog, getActivityLog } from "./api";
import { HiderStatus, getHiderStatus } from "./hider";
import { PersonaState } from "./steam";

const STATE_NAMES: Record<number, string> = {
  [PersonaState.Offline]: "Offline",
  [PersonaState.Online]: "Online",
  [PersonaState.Busy]: "Busy",
  [PersonaState.Away]: "Away",
  [PersonaState.Snooze]: "Snooze",
  [PersonaState.Invisible]: "Invisible",
};

const stateName = (s: number | null) => (s === null ? "unknown" : STATE_NAMES[s] ?? String(s));

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [status, setStatus] = useState<HiderStatus>(getHiderStatus());

  useEffect(() => {
    const refresh = () => {
      getActivityLog(10).then(setEntries).catch(() => undefined);
      setStatus(getHiderStatus());
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const onClear = async () => {
    await clearActivityLog();
    setEntries([]);
  };

  return (
    <PanelSection title="Status">
      <PanelSectionRow>
        {status.hidden && status.hiddenFor
          ? `Hidden for ${status.hiddenFor.name} (will restore ${stateName(status.previousState)})`
          : `Nothing hidden. Steam status: ${stateName(status.personaState)}`}
      </PanelSectionRow>
      <PanelSectionRow>
        {status.running.length
          ? `Running: ${status.running.map((a) => a.name).join(", ")}`
          : "No apps running"}
      </PanelSectionRow>
      {entries
        .slice()
        .reverse()
        .map((entry, i) => (
          <PanelSectionRow key={i}>
            {`${entry.timestamp.replace("T", " ").replace("Z", "")} ${entry.event_type === "activity_hidden" ? "hid" : "restored"} · ${entry.app_name}`}
          </PanelSectionRow>
        ))}
      {entries.length > 0 && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onClear}>
            Clear log
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
