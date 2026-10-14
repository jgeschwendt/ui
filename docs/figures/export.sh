#!/bin/sh
# Render every Claude Design board under docs/figures/project/ to docs/figures/<name>.png at 2×,
# the same pixels the canvas exports — agent-browser, headless, in its own session so a
# concurrent agent-browser user cannot steer the tab. support.js is the canvas runtime
# (the Design type's dc-runtime.js), which a file:// board needs to render. Run: mise run figures.
set -e
P=$(cd "$(dirname "$0")" && pwd)
S=$P/project
export AGENT_BROWSER_SESSION=ui-figures
h() { python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["boards"][sys.argv[2]]["h"])' "$S/canvas.json" "$1"; }
shoot() { # <board .dc.html> <out.png>
  agent-browser set viewport 1600 "$(h "$1")" 2 >/dev/null
  agent-browser open "file://$S/$1" >/dev/null
  agent-browser wait 1500 >/dev/null
  agent-browser screenshot "$P/$2" >/dev/null
  printf '%s %s\n' "$2" "$(file "$P/$2" | sed 's/.*PNG image data, //; s/,.*//')"
}
shoot Layers.dc.html layers.png
shoot Themes.dc.html themes.png
agent-browser close >/dev/null
