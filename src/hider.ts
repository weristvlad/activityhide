import { getConfig, reportEvent, PluginConfig } from "./api";
import { shouldHide } from "./policy";
import { AppInfo, PersonaState, getAppInfo, getPersonaState, setPersonaState } from "./steam";

// ---- config cache (shared by the panel and the context menu) ----

let config: PluginConfig | null = null;
const listeners = new Set<() => void>();

export function getCachedConfig(): PluginConfig | null {
  return config;
}

export function setCachedConfig(next: PluginConfig): void {
  config = next;
  listeners.forEach((l) => l());
  void evaluate();
}

export async function refreshConfig(): Promise<PluginConfig> {
  const next = await getConfig();
  setCachedConfig(next);
  return next;
}

export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- hide / restore state machine ----
//
// Steam tells friends about the most recently launched app that is still
// running. So with Discord open in the background and a game on top, friends
// see the game; quit the game and they see "In non-Steam game: Discord" again.
// We mirror that: keep every running app in launch order, and hide exactly
// while the *reported* app (last in the list) is one the user marked.

const running: AppInfo[] = []; // launch order, oldest first
let hiddenFor: AppInfo | null = null; // app we are currently hidden for
let previousState: number | null = null; // persona state to restore
let lifetimeHook: { unregister(): void } | null = null;

export interface HiderStatus {
  hidden: boolean;
  hiddenFor: AppInfo | null;
  running: AppInfo[];
  previousState: number | null;
  personaState: number | null;
}

export function getHiderStatus(): HiderStatus {
  return { hidden: hiddenFor !== null, hiddenFor, running: [...running], previousState, personaState: getPersonaState() };
}

function targetState(cfg: PluginConfig): number {
  return cfg.hide_state === "offline" ? PersonaState.Offline : PersonaState.Invisible;
}

function reportedApp(): AppInfo | null {
  return running.length ? running[running.length - 1] : null;
}

function hide(app: AppInfo, cfg: PluginConfig): void {
  previousState = getPersonaState();
  const ok = setPersonaState(targetState(cfg));
  hiddenFor = app;
  console.log(`[ActivityHide] hidden for ${app.name} (${app.appid}); ok=${ok}`);
  void reportEvent({
    event_type: "activity_hidden",
    app_name: app.name,
    app_id: app.appid,
    reason: `${cfg.mode}_match`,
    previous_status: previousState,
    new_status: targetState(cfg),
    method_used: ok ? "friend_store" : "friend_store_unavailable",
  });
}

function restore(): void {
  const app = hiddenFor;
  if (!app) return;
  if (previousState !== null) setPersonaState(previousState);
  previousState = null;
  hiddenFor = null;
  console.log(`[ActivityHide] restored after ${app.name} (${app.appid})`);
  void reportEvent({ event_type: "activity_restored", app_name: app.name, app_id: app.appid });
}

/** Bring the persona state in line with what Steam currently reports. */
async function evaluate(): Promise<void> {
  const cfg = config ?? (await refreshConfig());
  const app = reportedApp();
  const wantHidden = app !== null && shouldHide(app, cfg);

  if (wantHidden && hiddenFor?.appid === app!.appid) return; // already right
  if (wantHidden && hiddenFor) {
    // reported app changed but still one to hide: keep the state, update the label
    hiddenFor = app;
    return;
  }
  if (wantHidden) hide(app!, cfg);
  else if (hiddenFor) restore();
}

function onAppStarted(appid: number): void {
  const idx = running.findIndex((a) => a.appid === appid);
  if (idx !== -1) running.splice(idx, 1);
  running.push(getAppInfo(appid));
  void evaluate();
}

function onAppStopped(appid: number): void {
  const idx = running.findIndex((a) => a.appid === appid);
  if (idx !== -1) running.splice(idx, 1);
  void evaluate();
}

/** Used when the plugin is switched off or unloaded. */
export function restoreIfNeeded(): void {
  restore();
}

export function startHider(): void {
  if (lifetimeHook) return;
  void refreshConfig();
  lifetimeHook = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((update) => {
    if (update.bRunning) onAppStarted(update.unAppID);
    else onAppStopped(update.unAppID);
  });
}

export function stopHider(): void {
  lifetimeHook?.unregister();
  lifetimeHook = null;
  running.length = 0;
  restore();
}
