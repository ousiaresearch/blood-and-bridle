#!/usr/bin/env python3
"""
Regenerate assets/horses-codex/index.js from the PNGs currently in the
directory. Run after the codex generator finishes (or any time new
files appear) to keep the manifest in sync.

  python3 scripts/generate-codex-index.py

Idempotent. Safe to run repeatedly. Reads prefix_{stage}_{mood}.png
filenames and writes a JS module exporting CODEX_PORTRAITS + lookup.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
CODEX_DIR = ROOT / "assets" / "horses-codex"
INDEX_PATH = CODEX_DIR / "index.js"
TEMPLATE_PATH = CODEX_DIR / "index.template.js"

# Map: prefix (file) → breed id (horse.breed). Must match BREED_POOL.prefix.
PREFIX_TO_BREED = {
    "qh": "quarter_horse",
    "appy": "appaloosa",
    "paint": "paint_horse",
    "arab": "arabian",
    "tb": "thoroughbred",
    "andy": "andalusian",
}

# Stages and moods in canonical order. Mismatches get appended at end
# to keep the generated file readable.
STAGE_ORDER = ["foal", "yearling", "prospect", "campaigner", "retiree"]
MOOD_ORDER = ["calm", "intense", "proud"]


def parse_filename(stem: str):
    """Parse 'prefix_stage_mood' (or 'prefix_stage1_stage2_mood')."""
    # Last part is mood; second-to-last is stage; everything before is prefix.
    # Stages are from STAGE_ORDER; pick the last one that matches a tail
    # of the stem. This handles 'qh_yearling_calm' straightforwardly.
    for stage in reversed(STAGE_ORDER):
        # Look for "_<stage>_<mood>" at the tail.
        for mood in MOOD_ORDER:
            tail = f"_{stage}_{mood}"
            if stem.endswith(tail):
                prefix = stem[: -len(tail)]
                if prefix in PREFIX_TO_BREED:
                    return PREFIX_TO_BREED[prefix], stage, mood
    return None


def build_entries():
    entries = []
    for png in sorted(CODEX_DIR.glob("*.png")):
        parsed = parse_filename(png.stem)
        if not parsed:
            print(f"  WARN: skipping unparseable filename: {png.name}", file=sys.stderr)
            continue
        breed, stage, mood = parsed
        # ID format matches the pixel-art set: '<breed-prefix>_<stage>_<mood>'.
        # But here breed is the full id; we keep the file prefix for the id.
        prefix = next(k for k, v in PREFIX_TO_BREED.items() if v == breed)
        entry_id = f"{prefix}_{stage}_{mood}"
        entries.append({
            "id": entry_id,
            "breed": breed,
            "lifeStage": stage,
            "mood": mood,
            "path": f"/assets/horses-codex/{png.name}",
        })

    # Sort: breed (in BREED_POOL canonical order) → stage → mood.
    breed_order = list(PREFIX_TO_BREED.values())
    entries.sort(key=lambda e: (
        breed_order.index(e["breed"]) if e["breed"] in breed_order else 99,
        STAGE_ORDER.index(e["lifeStage"]) if e["lifeStage"] in STAGE_ORDER else 99,
        MOOD_ORDER.index(e["mood"]) if e["mood"] in MOOD_ORDER else 99,
    ))
    return entries


def entries_to_js(entries):
    """Render entries as the __ENTRIES__ substitution."""
    lines = []
    for e in entries:
        lines.append("  {")
        lines.append(f"    id: {e['id']!r},")
        lines.append(f"    breed: {e['breed']!r},")
        lines.append(f"    lifeStage: {e['lifeStage']!r},")
        lines.append(f"    mood: {e['mood']!r},")
        lines.append(f"    path: {e['path']!r},")
        lines.append("  },")
    return "\n".join(lines)


def main():
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: template missing at {TEMPLATE_PATH}", file=sys.stderr)
        sys.exit(1)

    entries = build_entries()
    print(f"Found {len(entries)} codex portraits in {CODEX_DIR.name}/")

    template = TEMPLATE_PATH.read_text()
    body = entries_to_js(entries)
    output = template.replace("__ENTRIES__", body)

    INDEX_PATH.write_text(output)
    print(f"Wrote {INDEX_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()