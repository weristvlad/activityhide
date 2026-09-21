import logging
import sys
import types


def install_fake_decky(tmp_path):
    fake = types.ModuleType("decky")
    fake.logger = logging.getLogger("decky-test")
    fake.DECKY_PLUGIN_SETTINGS_DIR = str(tmp_path / "settings")
    fake.DECKY_PLUGIN_LOG_DIR = str(tmp_path / "logs")
    sys.modules["decky"] = fake
    return fake
