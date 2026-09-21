import logging

import decky

from config_manager import ConfigManager

logger = decky.logger
logger.setLevel(logging.INFO)

LIST_FOR_MODE = {"blacklist": "blacklist", "whitelist": "whitelist"}


class Plugin:
    """
    Backend for ActivityHide. All the Steam-facing work (detecting a launched
    app, flipping the persona state) happens in the frontend, because it needs
    Steam's in-client JS stores. The backend only owns persistent state:
    config, the app lists and the activity log.
    """

    async def _main(self):
        self.config_manager = ConfigManager(
            settings_dir=decky.DECKY_PLUGIN_SETTINGS_DIR,
            log_dir=decky.DECKY_PLUGIN_LOG_DIR,
        )
        self._hidden_apps = {}
        logger.info("ActivityHide backend started")

    async def _unload(self):
        logger.info("ActivityHide backend unloaded")

    # ---- Config ----
    async def get_config(self):
        return self.config_manager.get()

    async def update_config(self, patch: dict):
        return self.config_manager.update(patch)

    async def set_mode(self, mode: str):
        return self.config_manager.update({"mode": mode})

    async def set_enabled(self, enabled: bool):
        return self.config_manager.update({"enabled": enabled})

    # ---- App lists ----
    async def add_app(self, list_name: str, app: dict):
        self.config_manager.add_app(list_name, app)
        return self.config_manager.get()

    async def remove_app(self, list_name: str, appid: int):
        self.config_manager.remove_app(list_name, appid)
        return self.config_manager.get()

    async def toggle_app(self, app: dict):
        """Flip the app's membership in the list the current mode uses."""
        config = self.config_manager.get()
        list_name = LIST_FOR_MODE.get(config["mode"])
        if list_name is None:
            return config
        entry = {"appid": int(app["appid"]), "name": app.get("name", "")}
        if any(a["appid"] == entry["appid"] for a in config.get(list_name, [])):
            self.config_manager.remove_app(list_name, entry["appid"])
        else:
            self.config_manager.add_app(list_name, entry)
        return self.config_manager.get()

    # ---- Events reported by the frontend ----
    async def report_event(self, event: dict):
        event_type = event.get("event_type")
        app_id = event.get("app_id")
        if event_type == "activity_hidden":
            self._hidden_apps[app_id] = {"appid": app_id, "name": event.get("app_name", "")}
        elif event_type == "activity_restored":
            self._hidden_apps.pop(app_id, None)
        logger.info("%s: %s (%s)", event_type, event.get("app_name"), app_id)
        self.config_manager.log_event(event)

    async def get_status(self):
        return {"hidden_apps": list(self._hidden_apps.values())}

    async def get_activity_log(self, limit: int = 100):
        return self.config_manager.get_log(limit)

    async def clear_activity_log(self):
        return self.config_manager.clear_log()
