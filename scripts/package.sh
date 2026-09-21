#!/usr/bin/env bash
# Builds the frontend and packs the runtime files into ActivityHide.zip
# in the layout Decky Loader expects (a single top-level ActivityHide/ folder).
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
rm -rf out && mkdir -p out/ActivityHide
cp -r plugin.json package.json main.py dist py_modules out/ActivityHide/
[ -d res ] && cp -r res out/ActivityHide/
[ -f LICENSE ] && cp LICENSE out/ActivityHide/
find out -name '__pycache__' -type d -prune -exec rm -rf {} +
rm -f out/ActivityHide/dist/*.map
(cd out && rm -f ActivityHide.zip && zip -qr ActivityHide.zip ActivityHide)
echo "built out/ActivityHide.zip"; unzip -l out/ActivityHide.zip
