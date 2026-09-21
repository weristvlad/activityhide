from config_manager import ConfigManager, DEFAULT_CONFIG


def make_cm(tmp_path):
    return ConfigManager(settings_dir=tmp_path / "settings", log_dir=tmp_path / "logs")


def test_creates_default_config_on_first_run(tmp_path):
    cm = make_cm(tmp_path)
    config = cm.get()
    assert config["mode"] == DEFAULT_CONFIG["mode"]
    assert (tmp_path / "settings" / "config.json").exists()


def test_update_persists_across_instances(tmp_path):
    make_cm(tmp_path).update({"enabled": False})
    assert make_cm(tmp_path).get()["enabled"] is False


def test_add_app_dedupes_and_remove_app_removes(tmp_path):
    cm = make_cm(tmp_path)
    app = {"appid": 123, "name": "Discord", "executable": "Discord"}

    cm.add_app("blacklist", app)
    cm.add_app("blacklist", app)
    assert cm.get()["blacklist"] == [app]

    cm.remove_app("blacklist", 123)
    assert cm.get()["blacklist"] == []


def test_corrupted_config_restores_from_backup(tmp_path):
    cm = make_cm(tmp_path)
    cm.update({"enabled": False})  # backup now holds the last-good (default) config

    cm.config_path.write_text("{not valid json")

    restored = make_cm(tmp_path)
    assert restored.get()["enabled"] == DEFAULT_CONFIG["enabled"]


def test_log_event_and_clear(tmp_path):
    cm = make_cm(tmp_path)
    cm.log_event({"event_type": "activity_hidden", "app_name": "Discord", "app_id": 1})
    entries = cm.get_log()
    assert len(entries) == 1
    assert entries[0]["event_type"] == "activity_hidden"

    cm.clear_log()
    assert cm.get_log() == []


def test_log_respects_max_entries(tmp_path):
    cm = make_cm(tmp_path)
    cm.update({"logging": {**cm.get()["logging"], "max_entries": 3}})
    for i in range(5):
        cm.log_event({"event_type": "activity_hidden", "app_name": f"App{i}", "app_id": i})
    entries = cm.get_log()
    assert len(entries) == 3
    assert entries[-1]["app_name"] == "App4"


def test_legacy_v1_config_is_migrated(tmp_path):
    import json

    settings = tmp_path / "settings"
    settings.mkdir()
    (settings / "config.json").write_text(json.dumps({
        "version": "1.0",
        "enabled": False,
        "mode": "pattern",
        "status_fallback": "away",
        "check_interval_ms": 500,
        "patterns": ["discord"],
        "advanced": {"debug_mode": True},
        "blacklist": [{"appid": 1, "name": "X", "executable": "x"}],
    }))

    config = make_cm(tmp_path).get()
    assert config["version"] == "2.0"
    assert config["enabled"] is False              # user values survive
    assert config["blacklist"][0]["appid"] == 1
    assert config["hide_state"] == "invisible"     # new defaults filled in
    for key in ("status_fallback", "check_interval_ms", "patterns", "advanced"):
        assert key not in config
