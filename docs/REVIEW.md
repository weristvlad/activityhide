# ActivityHide — project review

Written 2026-09-21 after pulling the original code off the Steam Deck and
checking every assumption against the running Steam client (SteamOS, Decky
Loader v3.2.9, Steam client with the Oct-2025 context menu layout).

## 1. What the plugin is for

Hide the **"In non-Steam game: Discord"** status line friends see in the
friends list and on the profile while a non-Steam shortcut runs on the Deck.
Playtime tracking and library visibility must stay untouched.

## 2. State of the original (v1, "vibecoded") code

The v1 code read well, had 17 green unit tests and a confident README. It could
never have worked. Every unit test passed because each one mocked exactly the
part that was wrong.

### 2.1 Non-Steam apps were looked up in the wrong file

`app_detector.py` scanned `steamapps/appmanifest_*.acf` for AppIDs above
1 000 000 000. Those manifests only exist for *installed Steam games*.
Non-Steam shortcuts live in a **binary** VDF at
`userdata/<id>/config/shortcuts.vdf` (and, for shortcuts, the 32-bit appid is
`crc32(exe + name) | 0x80000000`, which is > 2³¹, so the threshold was
accidentally right).

Verified on the Deck: library size 32, `get_non_steam_apps()` → `[]`, while
`shortcuts.vdf` holds 5 shortcuts (Discord, Spotify, Hytale Launcher, YouTube
TV ×2). Consequence: the app list in the UI was always empty and nothing could
ever be matched.

### 2.2 The "Steam local API" does not exist

`steam_api.py` POSTed JSON to `http://localhost:27060/ISteamUser/SetPersonaState`.
Nothing listens on 27060 (`curl` → connection refused; `ss -ltnp` shows Steam
on 27036 (Remote Play) plus ephemeral ports, and steamwebhelper's CEF debugger
on 8080). Every suppression attempt would have logged
`Steam local API unavailable` and done nothing.

### 2.3 Even if it had worked, "Away" doesn't hide the game

The chosen fallback persona state was Away. Away still shows the game line.
Only Invisible (7) or Offline (0) remove it.

### 2.4 Smaller problems

- Blocking I/O (`urllib.request.urlopen`, full `/proc` scan every 500 ms) on
  Decky's asyncio event loop.
- Process matching by regex of the *shortcut name* against every process
  cmdline — for a flatpak app the cmdline is `bwrap … com.discordapp.Discord`,
  the name "Discord" would also match unrelated processes.
- `pattern` mode, `status_fallback`, `check_interval_ms`, `startup_delay_ms`
  and the whole `advanced` block had no UI or no reader at all.
- `RichPresenceSuppressor` was a stub. `utils.py` duplicated
  `AppDetector._read_cmdline`. `plugin.json` pointed at a `res/icon.png` that
  doesn't exist and had `author: "Your Name"`.
- The QAM panel was a search box over an always-empty list.

## 3. Verified Steam internals (what v2 is built on)

All of this was checked live via the CEF remote debugger on port 8080,
evaluating JS in the `SharedJSContext` target (the context Decky plugins run in).

| Need                        | What works                                                                                                                                                   |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Know when an app starts/stops | `SteamClient.GameSessions.RegisterForAppLifetimeNotifications(({unAppID, bRunning}) => …)` — used by DiscordStatus, PowerTools, alarme plugins            |
| Know if an appid is a shortcut | `appStore.GetAppOverviewByAppID(appid).app_type === 1073741824`                                                                                            |
| List non-Steam apps         | `collectionStore.deckDesktopApps.allApps` filtered by that `app_type`; appids match the ones the context menu hands over                                     |
| Change own persona state    | friends-chat `FriendStore.SetUserPersonaState(state, userSet=true)`; also `BIsInvisibleMode()`, `BIsOfflineMode()`, `m_eUserPersonaState`                     |
| Where that store is         | **Not** `window.friendStore` (library cache, read-only). It is `<chat app>.FriendStore` on a module-private export; found with `findModuleByExport(e => e?.FriendStore?.SetUserPersonaState)` |
| Alternative                 | `SteamClient.URL.ExecuteSteamURL("steam://friends/status/invisible")` (same path the friends menu uses)                                                        |
| Persona enum                | Offline 0, Online 1, Busy 2, Away 3, Snooze 4, Invisible 7 (Steam `EPersonaState`)                                                                           |
| Game context menu           | Patch `LibraryContextMenu.prototype.render` exactly like decky-steamgriddb; insert a `MenuItem` before the entry whose `onSelected` mentions `AppProperties`  |

Live test of the setter: state 1 → `SetUserPersonaState(7)` → state 7,
`BIsInvisibleMode() === true` → `SetUserPersonaState(1)` → state 1.

Things that do **not** exist in the client JS: any `SteamClient.*.SetPersonaState`,
`SteamClient.Friends.*` status setters, a local HTTP status API.

## 4. v2 architecture

```
Steam client (SharedJSContext)                      Decky backend (python)
──────────────────────────────                      ──────────────────────
app lifetime event ──► hider.ts                     main.py
                       │ shouldHide(app, config)    ├─ get/update config
                       │ (policy.ts)                ├─ toggle_app(app)   ◄── context menu / QAM toggles
                       ├─ setPersonaState(7|0)      ├─ report_event      ◄── hider.ts (log + status)
                       └─ on exit: restore previous └─ config_manager.py (JSON + .bak + v1 migration)
contextMenu.tsx: "ActivityHide: Enable/Disable" entry in every game's menu
```

Frontend owns detection and hiding because both need in-client JS objects.
Backend owns persistence only. `policy.ts` is the single definition of the
modes; the backend no longer has a copy.

Config schema v2 (`~/homebrew/settings/ActivityHide/config.json`):

```json
{ "version": "2.0", "enabled": true, "mode": "blacklist",
  "hide_state": "invisible", "blacklist": [], "whitelist": [],
  "logging": { "enabled": true, "max_entries": 500 } }
```

A v1 file is migrated on load: user values kept, dead keys dropped.

## 5. Known limitations / open questions

- **Invisible means offline to friends.** The only way to stay Online with no
  game line is to launch the app *outside* Steam (plugin spawns the exe itself,
  Steam never learns about it). That loses Steam Input and the overlay in Game
  Mode. Not implemented; would be a separate "launch detached" mode.
- Manual status changes while hidden are overwritten on restore.
- The context-menu patch mirrors decky-steamgriddb's, including its
  "Oct 2025 client" branch; it will need the same upkeep when Valve changes
  the menu again.
- `plugin.json` still lacks a real author and icon (`res/icon.png`); needed
  before a Decky store submission.

## 6. Test matrix

- `tests/` — backend: config defaults, persistence, backup restore, log
  rotation, v1 migration, toggle_app per mode, report_event/status. Run with
  `.venv/bin/python -m pytest`.
- Frontend: `npx tsc --noEmit` (strict). No JS unit tests; the behaviour that
  matters (persona flip, menu injection) can only be exercised in the client.
- Manual on the Deck: long-press Discord → "ActivityHide: Enable" → launch
  Discord → friend sees you offline → quit Discord → status back.

## 7. Dev workflow used here

The Deck is reached as `ssh deck` through a reverse tunnel (the local Wi-Fi
isolates clients). Deploy = rsync sources to `~/activityhide`, `sudo cp` the
runtime files into `~/homebrew/plugins/ActivityHide`, restart
`plugin_loader.service`. Live inspection of the Steam client is possible with
a tiny CEF websocket client against `http://localhost:8080/json` on the Deck.
