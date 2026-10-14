"""Derive a board's dark variant: python3 -I dark.py <tokens.json> <board.dc.html> <out.html>.

Every colour token's light value becomes its dark value (case-insensitive, whole 6-digit
hex, as #rrggbb or %23rrggbb in a data URI) — first token in color.tokens order wins
where light values collide, so #ffffff is ui-bg. Only markup and <style> are rewritten:
a hex in text content is a label (the Themes board prints its swatch values), and a
colour that must survive is written as rgb(). Any hex left that is no light token value
is printed, so nothing silently stays light."""
import json, re, sys

tokens, board, out = sys.argv[1:4]
dark = {}
for t in json.load(open(tokens))["color"]["tokens"]:
    v = t["value"]
    if isinstance(v, dict) and re.fullmatch(r"#[0-9a-fA-F]{6}", v["light"]):
        dark.setdefault(v["light"][1:].lower(), v["dark"])

HEX = re.compile(r"(#|%23)([0-9a-fA-F]{6})(?![0-9a-fA-F])")
unmapped = set()

def swap(m):
    d = dark.get(m.group(2).lower())
    if d is None:
        unmapped.add("#" + m.group(2).lower())
        return m.group(0)
    return d.replace("#", "%23").replace(" ", "%20") if m.group(1) == "%23" else d

src = open(board).read()
res = re.sub(r"<style\b[^>]*>.*?</style>|<[^>]+>", lambda m: HEX.sub(swap, m.group(0)), src, flags=re.S)
open(out, "w").write(res)
print("unmapped:", " ".join(sorted(unmapped)) or "none")
