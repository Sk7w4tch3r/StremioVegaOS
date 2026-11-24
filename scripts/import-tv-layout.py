"""Compile Stremio Android TV 1.10.4 resource values for the Vega view bindings.
Usage: python3 scripts/import-tv-layout.py <apktool-decoded directory>
"""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

res = Path(sys.argv[1]) / "res"
dimens = {e.get("name"): e.text for e in ET.parse(res/"values/dimens.xml").getroot()}
strings = {e.get("name"): e.text for e in ET.parse(res/"values/strings.xml").getroot()}
layouts = {}
def convert(e):
    attrs = {}
    for key, value in e.attrib.items():
        key = key.split("}")[-1]
        if value.startswith("@dimen/"):
            value = dimens[value.split("/")[1]]
        if value.startswith("@string/"):
            value = strings.get(value.split("/")[1], value)
        if isinstance(value,str) and value.endswith(("dp","sp")):
            value = float(value[:-2])
        attrs[key] = value
    return dict(tag=e.tag.split(".")[-1], attrs=attrs, children=[convert(c) for c in e])
for name in ["card_addon_item","card_stream_item_large_layout","fragment_meta_preview","card_video_item"]:
    layouts[name] = convert(ET.parse(res/f"layout/{name}.xml").getroot())
out=Path(__file__).resolve().parents[1]/"src/assets/android-tv/layouts.json"
out.write_text(json.dumps(layouts,indent=2)+"\n")
