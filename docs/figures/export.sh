#!/bin/sh
# Render every Claude Design board under docs/figures/project/ to docs/figures/<name>.png at 2×,
# the same pixels the canvas exports — agent-browser, headless, in its own session so a
# concurrent agent-browser user cannot steer the tab. support.js is the canvas runtime
# (the Design type's dc-runtime.js), which a file:// board needs to render. Each board renders
# twice: <name>.png as drawn (the light tokens), then <name>-dark.png from a temporary copy in
# which dark.py swaps every colour token's light value for its dark one (project/ds/gigantic/
# tokens.json, read back from the canvas). Run: mise run figures.
set -e
P=$(cd "$(dirname "$0")" && pwd)
S=$P/project
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
cp "$S/support.js" "$T/"
export AGENT_BROWSER_SESSION=ui-figures
h() { python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["boards"][sys.argv[2]]["h"])' "$S/canvas.json" "$1"; }
render() { # <board file> <out.png> <height>
  agent-browser set viewport 1600 "$3" 2 >/dev/null
  agent-browser open "file://$1" >/dev/null
  agent-browser wait 1500 >/dev/null
  agent-browser screenshot "$P/$2" >/dev/null
  printf '%s %s\n' "$2" "$(file "$P/$2" | sed 's/.*PNG image data, //; s/,.*//')"
}
shoot() { # <board .dc.html> <out.png> <out-dark.png>
  render "$S/$1" "$2" "$(h "$1")"
  printf '%s ' "$1"
  python3 -I "$P/dark.py" "$S/ds/gigantic/tokens.json" "$S/$1" "$T/$1"
  render "$T/$1" "$3" "$(h "$1")"
}
shoot Layers.dc.html layers.png layers-dark.png
shoot Themes.dc.html themes.png themes-dark.png
agent-browser close >/dev/null
