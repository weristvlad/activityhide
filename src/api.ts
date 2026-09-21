import { callable } from "@decky/api";

import type { AppInfo } from "./steam";

export type HideMode = "global" | "blacklist" | "whitelist";
export type HideState = "invisible" | "offline";

export interface AppEntry {
  appid: number;
  name: string;
}

export interface ActivityLogEntry {
  timestamp: string;
  event_type: "activity_hidden" | "activity_restored" | string;
  app_name: string;
  app_id: number;
  [key: string]: unknown;
}

export interface PluginConfig {
  version: string;
  enabled: boolean;
  mode: HideMode;
  hide_state: HideState;
  blacklist: AppEntry[];
  whitelist: AppEntry[];
  logging: { enabled: boolean; max_entries: number };
  [key: string]: unknown;
}

export interface BackendStatus {
  hidden_apps: AppEntry[];
}

export const getConfig = callable<[], PluginConfig>("get_config");
export const updateConfig = callable<[Partial<PluginConfig>], PluginConfig>("update_config");
export const setMode = callable<[HideMode], PluginConfig>("set_mode");
export const setEnabled = callable<[boolean], PluginConfig>("set_enabled");
export const addApp = callable<[string, AppEntry], PluginConfig>("add_app");
export const removeApp = callable<[string, number], PluginConfig>("remove_app");
/** Flips the app in whichever list the current mode uses. Returns the new config. */
export const toggleApp = callable<[AppInfo], PluginConfig>("toggle_app");
export const reportEvent = callable<[Record<string, unknown>], void>("report_event");
export const getStatus = callable<[], BackendStatus>("get_status");
export const getActivityLog = callable<[number?], ActivityLogEntry[]>("get_activity_log");
export const clearActivityLog = callable<[], []>("clear_activity_log");
