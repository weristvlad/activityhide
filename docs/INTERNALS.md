# ActivityHide — internals

How the plugin works and which Steam client internals it relies on. Everything
here was checked live against the Steam client on a Steam Deck (SteamOS, Decky
Loader 3.2.9) via the CEF debugger on port 8080, `SharedJSContext` target.

## Architecture

```
Steam client (SharedJSContext)                      Decky backend (python)
──────────────────────────────                      ──────────────────────
app lifetime event ──► hider.ts                     main.py
                       │ shouldHide(app, config)    ├─ get/update config
                       │ (policy.ts)                ├─ toggle_app(app)   ◄── context menu / QAM toggles
                       ├─ setPersonaState(7|0)      ├─ report_event      ◄── hider.ts (log + status)
                       └─ restore previous state    └─ config_manager.py (JSON + .bak)
contextMenu.tsx: "ActivityHide: Enable/Disable" entry in every game's menu
```

The frontend owns detection and hiding because both need in-client JS objects.
The backend owns persistence only. `policy.ts` is the single definition of the
modes.

## Hide rule

Steam tells friends about the most recently launched app that is still
running. `hider.ts` keeps every running app in launch order and hides exactly
while that *reported* app (last in the list) matches the policy:

- Discord starts → previous status remembered, status set to Invisible.
- A game starts on top → the game is now reported → status restored.
- The game exits, Discord still running → Invisible again.
- Discord exits → status restored.

Disabling the plugin or unloading it restores the status immediately.

## Steam internals used

| Need                          | Mechanism                                                                                                                                                   |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| App start / stop              | `SteamClient.GameSessions.RegisterForAppLifetimeNotifications(({unAppID, bRunning}) => …)`                                                                  |
| Is this appid a shortcut?     | `appStore.GetAppOverviewByAppID(appid).app_type === 1073741824`                                                                                             |
| List non-Steam apps           | `collectionStore.deckDesktopApps.allApps` filtered by that `app_type`; appids match what the context menu hands over                                         |
| Change own status             | friends-chat `FriendStore.SetUserPersonaState(state, userSet = true)`; also `BIsInvisibleMode()`, `BIsOfflineMode()`, `m_eUserPersonaState`                  |
| Where that store lives        | **Not** `window.friendStore` (library cache, read-only). It sits on a module-private chat-app export; located with `findModuleByExport(e => e?.FriendStore?.SetUserPersonaState)` |
| Persona enum                  | Offline 0, Online 1, Busy 2, Away 3, Snooze 4, Invisible 7 (`EPersonaState`)                                                                                 |
| Game context menu             | `afterPatch(LibraryContextMenu.prototype, "render", …)`, same technique as decky-steamgriddb; the item is spliced in before the entry whose `onSelected` mentions `AppProperties` |

Away does **not** remove the game line; only Invisible or Offline do. There is
no `SteamClient.*` persona setter and no local HTTP status API.

## Config

`~/homebrew/settings/ActivityHide/config.json` (backup in `config.json.bak`,
atomic writes):

```json
{ "version": "2.0", "enabled": true, "mode": "blacklist",
  "hide_state": "invisible", "blacklist": [], "whitelist": [],
  "logging": { "enabled": true, "max_entries": 500 } }
```

`mode`: `blacklist` (hide for listed apps), `whitelist` (hide for all except
listed), `global` (hide for every shortcut). `hide_state`: `invisible` or
`offline`. Activity log: `~/homebrew/logs/ActivityHide/activity.log` (JSON).

## Limitations

- Invisible means offline to friends. Staying Online with only the game line
  hidden is impossible from inside the client; the only route would be launching
  the app outside Steam (no Steam Input, no overlay). Not implemented.
- A status changed by hand while hidden is overwritten on restore.
- The context-menu patch tracks Valve's menu layout (incl. the Oct-2025 client
  variant) and needs upkeep when Valve changes it again.

## Testing

- Backend: `.venv/bin/python -m pytest` (config defaults, persistence, backup
  restore, log rotation, toggle_app per mode, report_event/status).
- Frontend: `npx tsc --noEmit`. Persona flip and menu injection can only be
  exercised in the client.
- Manual: long-press Discord → "ActivityHide: Enable" → launch Discord → a
  friend sees you offline → quit → status back.

## Dev loop on the Deck

`main.py`, `dist/` and `py_modules/` inside `~/homebrew/plugins/ActivityHide`
can be replaced without root; then reload with
`DeckyBackend.call("loader/reload_plugin", "ActivityHide")` from the CEF
console (`http://localhost:8080/json`, target `SharedJSContext`). `plugin.json`
and the folder itself are root-owned.
