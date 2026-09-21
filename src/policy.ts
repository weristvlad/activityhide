import type { PluginConfig } from "./api";
import type { AppInfo } from "./steam";

/** Single source of truth for "should this app's activity be hidden?". */
export function shouldHide(app: AppInfo, config: PluginConfig): boolean {
  if (!config.enabled) return false;
  switch (config.mode) {
    case "global":
      return app.is_shortcut;
    case "blacklist":
      return config.blacklist.some((a) => a.appid === app.appid);
    case "whitelist":
      return !config.whitelist.some((a) => a.appid === app.appid);
    default:
      return false;
  }
}

export function isListed(appid: number, config: PluginConfig): boolean {
  const list = config.mode === "whitelist" ? config.whitelist : config.blacklist;
  return list.some((a) => a.appid === appid);
}

export interface ToggleDescription {
  label: string;
  disabled: boolean;
  /** true when selecting the item will make the app hidden */
  willHide: boolean;
}

/** What the context-menu entry should say for this app right now. */
export function describeToggle(app: AppInfo, config: PluginConfig | null): ToggleDescription {
  if (!config) return { label: "ActivityHide: loading…", disabled: true, willHide: false };
  if (config.mode === "global") {
    return { label: "ActivityHide: hiding all non-Steam apps", disabled: true, willHide: false };
  }
  const hiddenNow = shouldHide(app, { ...config, enabled: true });
  return hiddenNow
    ? { label: "ActivityHide: Disable", disabled: false, willHide: false }
    : { label: "ActivityHide: Enable", disabled: false, willHide: true };
}
