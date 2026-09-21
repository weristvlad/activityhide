import copy
import json
import os
import shutil
import time
from pathlib import Path

# Falls back to a plain dotfile location when run outside the Decky Loader
# (e.g. local unit tests), which does not set DECKY_PLUGIN_SETTINGS_DIR.
DEFAULT_SETTINGS_DIR = Path(os.path.expanduser("~/.config/decky-activityhide"))

DEFAULT_CONFIG = {
    "version": "2.0",
    "enabled": True,
    # global    -> hide for every non-Steam app
    # blacklist -> hide only for apps in "blacklist"
    # whitelist -> hide for everything except apps in "whitelist"
    "mode": "blacklist",
    # persona state to switch to while hidden: "invisible" or "offline"
    "hide_state": "invisible",
    "blacklist": [],
    "whitelist": [],
    "logging": {
        "enabled": True,
        "max_entries": 500,
    },
}

# Keys not part of the schema; dropped on load.
LEGACY_KEYS = ("status_fallback", "check_interval_ms", "startup_delay_ms", "patterns", "advanced")


class ConfigManager:
    def __init__(self, settings_dir=None, log_dir=None):
        self.settings_dir = Path(settings_dir) if settings_dir else DEFAULT_SETTINGS_DIR
        self.log_dir = Path(log_dir) if log_dir else self.settings_dir
        self.config_path = self.settings_dir / "config.json"
        self.backup_path = self.settings_dir / "config.json.bak"
        self.log_path = self.log_dir / "activity.log"

        self.settings_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._config = self._load()

    def _load(self):
        if not self.config_path.exists():
            self._write(DEFAULT_CONFIG)
            return copy.deepcopy(DEFAULT_CONFIG)
        try:
            with open(self.config_path, "r") as f:
                config = json.load(f)
            merged = {**copy.deepcopy(DEFAULT_CONFIG), **config}
            for key in LEGACY_KEYS:
                merged.pop(key, None)
            merged["version"] = DEFAULT_CONFIG["version"]
            return merged
        except (json.JSONDecodeError, OSError):
            return self._restore_from_backup()

    def _restore_from_backup(self):
        if self.backup_path.exists():
            try:
                with open(self.backup_path, "r") as f:
                    config = json.load(f)
                self._write(config)
                return config
            except (json.JSONDecodeError, OSError):
                pass
        self._write(DEFAULT_CONFIG)
        return copy.deepcopy(DEFAULT_CONFIG)

    def _write(self, config):
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    json.load(f)
                shutil.copy(self.config_path, self.backup_path)
            except (json.JSONDecodeError, OSError):
                pass  # don't clobber a good backup with a corrupted current file
        tmp_path = self.config_path.with_suffix(".tmp")
        with open(tmp_path, "w") as f:
            json.dump(config, f, indent=2)
        os.chmod(tmp_path, 0o600)
        tmp_path.replace(self.config_path)

    def get(self):
        return self._config

    def update(self, patch: dict):
        self._config = {**self._config, **patch}
        self._write(self._config)
        return self._config

    def add_app(self, list_name: str, app: dict):
        apps = self._config.setdefault(list_name, [])
        if not any(a["appid"] == app["appid"] for a in apps):
            apps.append(app)
        self._write(self._config)
        return apps

    def remove_app(self, list_name: str, appid: int):
        apps = self._config.get(list_name, [])
        self._config[list_name] = [a for a in apps if a["appid"] != appid]
        self._write(self._config)
        return self._config[list_name]

    def log_event(self, event: dict):
        if not self._config["logging"]["enabled"]:
            return
        event = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **event}
        entries = self._read_log()
        entries.append(event)
        max_entries = self._config["logging"]["max_entries"]
        entries = entries[-max_entries:]
        self._write_log(entries)

    def get_log(self, limit: int = 100):
        entries = self._read_log()
        return entries[-limit:]

    def clear_log(self):
        self._write_log([])
        return []

    def _read_log(self):
        if not self.log_path.exists():
            return []
        try:
            with open(self.log_path, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

    def _write_log(self, entries):
        with open(self.log_path, "w") as f:
            json.dump(entries, f, indent=2)
