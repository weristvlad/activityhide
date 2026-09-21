# ActivityHide

A [Decky Loader](https://decky.xyz) plugin for the Steam Deck that hides the
**"In non-Steam game: Discord"** line your friends see while you run a
non-Steam app (Discord, Spotify, YouTube TV, emulators…).

> **Vibecoded.** Written with an AI assistant. The first draft was reworked
> against the real Steam client and is tested on a Steam Deck (history and the
> verified Steam internals are in `docs/REVIEW.md`). It's a personal tool, not
> a store-polished product, and it is not in the Decky plugin database.

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

Not in the Decky store. Install it from the GitHub release instead.

### Option A — Decky "Install from URL" (no keyboard, no terminal)

1. Open the Quick Access Menu (… button) → **Decky** (plug icon) → **⚙ Settings**.
2. **General** tab → turn on **Developer mode**.
3. A **Developer** tab appears. In **Install Plugin from URL** paste:

   ```
   https://github.com/weristvlad/activityhide/releases/latest/download/ActivityHide.zip
   ```

   and press **Install**. Confirm the prompt.
4. **ActivityHide** now shows up in the Decky plugin list. Developer mode can
   be switched off again.

To update, repeat step 3: Decky replaces the installed version.

### Option B — Decky "Install from ZIP"

Download `ActivityHide.zip` from the
[latest release](https://github.com/weristvlad/activityhide/releases/latest)
onto the Deck (browser in Desktop Mode, or copy it over), then in Decky's
**Developer** tab use **Install Plugin from ZIP** and pick the file.

### Option C — manual (Konsole / SSH)

`~/homebrew/plugins` is owned by root, so this needs your sudo password.

```bash
cd /tmp
curl -L -o ActivityHide.zip \
  https://github.com/weristvlad/activityhide/releases/latest/download/ActivityHide.zip
sudo rm -rf ~/homebrew/plugins/ActivityHide
sudo unzip -q ActivityHide.zip -d ~/homebrew/plugins/
sudo chown -R root:root ~/homebrew/plugins/ActivityHide
sudo systemctl restart plugin_loader.service
```

### First use

1. In the library, long-press (or press ☰ on) **Discord** → **ActivityHide: Enable**.
2. Launch Discord. Friends now see you as offline instead of
   "In non-Steam game: Discord".
3. Start a real game on top: you are back online, showing that game. Quit it
   and you are invisible again until Discord closes.

The Quick Access Menu → **ActivityHide** panel shows the current state, the
mode and a toggle per non-Steam app.

## Releasing a new version

```bash
npm run package            # builds out/ActivityHide.zip locally
git tag v2.0.1 && git push --tags
```

Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds the zip
and attaches it to a GitHub release, so the `releases/latest/download` URL
above always points at the newest build.

Config and log live in `~/homebrew/settings/ActivityHide/` and
`~/homebrew/logs/ActivityHide/`.
