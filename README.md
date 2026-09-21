# ActivityHide

A [Decky Loader](https://decky.xyz) plugin for the Steam Deck that hides the
**"In non-Steam game: Discord"** line your friends see while you run a
non-Steam app (Discord, Spotify, YouTube TV, emulators…).

> **Vibecoded.** The first version of this plugin was generated end-to-end by an
> AI assistant and never worked on real hardware (see `docs/REVIEW.md`). It was
> then reworked against the actual Steam client on a Steam Deck. Treat it as a
> personal tool, not a polished product. Not yet submitted to the Decky store.

## How it works

Steam has no switch for "don't tell my friends about this app". The Steam
client binary itself reports the running game to Valve's servers, and nothing
running inside the client can retract that. What *can* be changed from a
plugin is your **persona state**: going **Invisible** makes friends see you as
offline, which also removes the game line, while you still see your friends
list and can chat.

So the plugin does this:

1. Listens to Steam's own app lifetime events
   (`SteamClient.GameSessions.RegisterForAppLifetimeNotifications`).
2. When an app you marked starts, it remembers your current status and switches
   you to **Invisible** (or **Offline**, configurable) through Steam's
   friends-chat `FriendStore.SetUserPersonaState`, the same call the
   Online/Away/Invisible menu in the friends list uses.
3. When the app exits, it restores the status it remembered.

Everything Steam-facing runs in the frontend (Steam's JS context). The Python
backend only stores the config, the app lists and an activity log.

### Marking an app

- **Game context menu** (long-press / ☰ on a game in the library):
  **ActivityHide: Enable** / **ActivityHide: Disable**. This is injected the
  same way SteamGridDB injects "Change Artwork…".
- **Quick Access Menu → ActivityHide**: master toggle, mode, a toggle per
  non-Steam app, status and log.

### Modes

| Mode                       | Behaviour                                              |
|----------------------------|--------------------------------------------------------|
| Selected apps only         | Hide only for apps in the list (default)               |
| All except selected apps   | Hide for every app except those in the list            |
| All non-Steam apps         | Hide for every non-Steam shortcut, list ignored        |

### Limitations

- While hidden you *are* offline to your friends. There is no way to stay
  "Online" and hide only the game from inside the client. The only route to
  that would be launching the app outside Steam (no Steam Input, no overlay);
  it is not implemented.
- If you change your status by hand while an app is hidden, the plugin still
  restores the status it remembered when the app exits.
- Steam's auto-away on idle may change the state underneath; harmless.

## Project layout

```
activityhide/
├── main.py                 # Decky backend: config / lists / log RPCs
├── py_modules/
│   └── config_manager.py   # JSON config with backup + v1 migration, activity log
├── src/
│   ├── index.tsx           # definePlugin: starts the hider, patches the menu
│   ├── hider.ts            # lifetime hook, hide/restore state machine, config cache
│   ├── steam.ts            # FriendStore lookup, persona state, appStore helpers
│   ├── policy.ts           # shouldHide() – the one place the modes are defined
│   ├── contextMenu.tsx     # "ActivityHide: Enable/Disable" in the game menu
│   ├── api.ts              # typed callable() wrappers for the backend
│   ├── App.tsx, ModeSelector.tsx, AppList.tsx, ActivityLog.tsx, Settings.tsx
│   └── globals.d.ts        # SteamClient / appStore / collectionStore typings
├── tests/                  # pytest for the backend (fake `decky` module)
├── docs/REVIEW.md          # project review, verified Steam internals, history
├── plugin.json             # Decky manifest
└── package.json
```

## Development

```bash
npm install
npm run build            # -> dist/index.js
npx tsc --noEmit         # strict type-check

python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -v
```

## Installing on the Deck

`~/homebrew/plugins` is owned by root (the loader runs as root):

```bash
P=~/homebrew/plugins/ActivityHide
sudo rm -rf $P && sudo mkdir -p $P
sudo cp -r main.py plugin.json package.json dist py_modules $P/
sudo chown -R root:root $P
sudo systemctl restart plugin_loader.service
```

Or enable Decky's Developer Mode and point it at the source folder for live
rebuilds with `npm run watch`.

Config and log live in `~/homebrew/settings/ActivityHide/` and
`~/homebrew/logs/ActivityHide/`.
