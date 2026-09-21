import { findModuleByExport } from "@decky/ui";

/** Steam's EPersonaState. Verified against the Steam client on 2026-09-21. */
export enum PersonaState {
  Offline = 0,
  Online = 1,
  Busy = 2,
  Away = 3,
  Snooze = 4,
  Invisible = 7,
}

/** app_type value Steam assigns to non-Steam shortcuts in appStore overviews. */
export const SHORTCUT_APP_TYPE = 1073741824;

export interface AppInfo {
  appid: number;
  name: string;
  is_shortcut: boolean;
}

interface FriendStore {
  m_eUserPersonaState: number;
  SetUserPersonaState(state: number, userSet?: boolean): void;
  BIsInvisibleMode(): boolean;
  BIsOfflineMode(): boolean;
}

let cachedFriendStore: FriendStore | null = null;

/**
 * The friends-chat FriendStore (the one behind the Online/Away/Invisible/Offline
 * menu in the friends list). It is NOT window.friendStore, which is the library's
 * read-only friend cache. It lives on a module-private "chat app" object, so we
 * look it up through the webpack module cache the same way Decky itself does.
 */
export function getFriendStore(): FriendStore | null {
  if (cachedFriendStore) return cachedFriendStore;
  const mod = findModuleByExport((e: any) => {
    try {
      return !!e && typeof e === "object" && !!e.FriendStore && typeof e.FriendStore.SetUserPersonaState === "function";
    } catch {
      return false;
    }
  });
  if (!mod) return null;
  for (const key of Object.keys(mod)) {
    try {
      const store = mod[key]?.FriendStore;
      if (store && typeof store.SetUserPersonaState === "function") {
        cachedFriendStore = store;
        return store;
      }
    } catch {
      /* some exports are throwing getters */
    }
  }
  return null;
}

export function getPersonaState(): number | null {
  const store = getFriendStore();
  return store ? store.m_eUserPersonaState : null;
}

export function setPersonaState(state: number): boolean {
  const store = getFriendStore();
  if (!store) return false;
  try {
    store.SetUserPersonaState(state);
    return true;
  } catch (err) {
    console.error("[ActivityHide] SetUserPersonaState failed", err);
    return false;
  }
}

export function getAppInfo(appid: number): AppInfo {
  let overview: any = null;
  try {
    overview = window.appStore?.GetAppOverviewByAppID?.(appid);
  } catch {
    /* ignore */
  }
  return {
    appid,
    name: overview?.display_name ?? `App ${appid}`,
    is_shortcut: overview?.app_type === SHORTCUT_APP_TYPE,
  };
}

/** All non-Steam shortcuts in the library, straight from Steam's collection store. */
export function listShortcuts(): AppInfo[] {
  try {
    const apps: any[] = window.collectionStore?.deckDesktopApps?.allApps ?? [];
    return apps
      .filter((a) => a?.app_type === SHORTCUT_APP_TYPE)
      .map((a) => ({ appid: a.appid, name: a.display_name, is_shortcut: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
