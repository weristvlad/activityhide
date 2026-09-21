import os
import sys

# Mirrors the real Decky Loader's sys.path setup (sandboxed_plugin.py only
# appends "<plugin_dir>/py_modules", never the plugin root), so these tests
# exercise the same import resolution the live loader uses.
_ROOT = os.path.dirname(__file__)
sys.path.insert(0, _ROOT)
sys.path.insert(0, os.path.join(_ROOT, "py_modules"))
