import asyncio
import importlib
import sys

from tests.conftest import install_fake_decky


def load_plugin(tmp_path):
    install_fake_decky(tmp_path)
    sys.modules.pop("main", None)
    return importlib.import_module("main").Plugin()


def test_plugin_lifecycle_and_toggle(tmp_path):
    plugin = load_plugin(tmp_path)

    async def scenario():
        await plugin._main()
        try:
            config = await plugin.get_config()
            assert config["mode"] == "blacklist"
            assert config["enabled"] is True
            assert config["hide_state"] == "invisible"

            discord = {"appid": 3761249292, "name": "Discord", "is_shortcut": True}

            config = await plugin.toggle_app(discord)
            assert config["blacklist"] == [{"appid": 3761249292, "name": "Discord"}]

            config = await plugin.toggle_app(discord)
            assert config["blacklist"] == []

            # whitelist mode toggles the whitelist instead
            await plugin.set_mode("whitelist")
            config = await plugin.toggle_app(discord)
            assert config["whitelist"] == [{"appid": 3761249292, "name": "Discord"}]
            assert config["blacklist"] == []

            # global mode has nothing to toggle
            await plugin.set_mode("global")
            before = await plugin.get_config()
            assert await plugin.toggle_app(discord) == before
        finally:
            await plugin._unload()

    asyncio.run(scenario())


def test_report_event_tracks_hidden_apps_and_logs(tmp_path):
    plugin = load_plugin(tmp_path)

    async def scenario():
        await plugin._main()
        await plugin.report_event({"event_type": "activity_hidden", "app_name": "Discord", "app_id": 42})
        assert (await plugin.get_status())["hidden_apps"] == [{"appid": 42, "name": "Discord"}]

        await plugin.report_event({"event_type": "activity_restored", "app_name": "Discord", "app_id": 42})
        assert (await plugin.get_status())["hidden_apps"] == []

        log = await plugin.get_activity_log()
        assert [e["event_type"] for e in log] == ["activity_hidden", "activity_restored"]
        assert all("timestamp" in e for e in log)

        assert await plugin.clear_activity_log() == []
        assert await plugin.get_activity_log() == []

    asyncio.run(scenario())
