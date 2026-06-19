#!/usr/bin/env python3
"""
Generate the remaining 70+ Codex horse portraits for Blood & Bridle.

This script bypasses the subagent layer and calls the Codex image API
directly using the same auth flow as the openai-codex plugin.

Resume-friendly: it reads assets/horses-codex/.state.json to skip already-
done horses and recover from interruptions.

Usage:
    python3 scripts/codex-horse-generator.py
    python3 scripts/codex-horse-generator.py --stagger 8  # tighter stagger
    python3 scripts/codex-horse-generator.py --breed tb  # just one breed
"""

import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

# Add Hermes agent to path so we can import its auth helpers
HERMES_HOME = os.path.expanduser("~/.hermes/hermes-agent")
sys.path.insert(0, HERMES_HOME)

import httpx  # noqa: E402

# Reuse the Codex auth helpers from Hermes itself
from agent.auxiliary_client import (  # noqa: E402
    _codex_cloudflare_headers,
    _read_codex_access_token,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
CODEX_CHAT_MODEL = "gpt-5.5"
API_MODEL = "gpt-image-2"
QUALITY = "medium"
SIZE = "1024x1536"  # portrait

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "horses-codex"
STATE_FILE = OUTPUT_DIR / ".state.json"

# ---------------------------------------------------------------------------
# Breed / stage / mood descriptors — used to build prompts
# ---------------------------------------------------------------------------

BREEDS = {
    "qh": "American Quarter Horse, stocky muscular build, common colors bay sorrel chestnut roan",
    "appy": "Appaloosa, distinctive spotted coat, mottled skin around muzzle, white with dark spots",
    "paint": "Paint Horse, distinctive pinto pattern, large patches of white combined with another color",
    "arab": "Arabian, refined dished face, high tail carriage, often grey chestnut or bay",
    "tb": "Thoroughbred, tall lean athletic, often bay dark bay or chestnut",
    "andy": "Andalusian, grey or bay, long flowing mane, baroque build, Spanish",
}

STAGES = {
    "foal": "very young foal, long legs, soft uncertain eye, soft muzzle",
    "yearling": "young yearling, growing, gangly, curious, in between",
    "prospect": "2-3 year old prospect, training age, alert, learning, athletic",
    "campaigner": "4-10 year old campaigner, mature, in work, full of muscle",
    "retiree": "11+ year old retiree, older, calm, kind eye, grey around muzzle",
}

MOODS = {
    "calm": "calm mood, relaxed ears, soft eye, peaceful",
    "intense": "intense mood, ears forward, focused eye, alert, energetic",
    "proud": "proud mood, arched neck, bright eye, lifted head, presence",
}

# Color variations per stage (subtle, helps model pick a specific look)
COLORS = {
    "qh":    {"foal": "bay",      "yearling": "sorrel",     "prospect": "chestnut",   "campaigner": "dark bay", "retiree": "blue roan"},
    "appy":  {"foal": "leopard spotted", "yearling": "snowflake spotted", "prospect": "blanket spotted", "campaigner": "leopard spotted", "retiree": "few-spot white"},
    "paint": {"foal": "bay tobiano", "yearling": "black overo", "prospect": "sorrel overo", "campaigner": "bay tobiano", "retiree": "dark chestnut with white blaze"},
    "arab":  {"foal": "grey",     "yearling": "chestnut",   "prospect": "bay",        "campaigner": "flea-bitten grey", "retiree": "white grey"},
    "tb":    {"foal": "bay",      "yearling": "dark bay",   "prospect": "chestnut",   "campaigner": "dark bay with white sock", "retiree": "grey bay"},
    "andy":  {"foal": "grey",     "yearling": "dappled grey", "prospect": "light grey", "campaigner": "white grey", "retiree": "flea-bitten grey"},
}


def build_prompt(breed, stage, mood):
    color = COLORS.get(breed, {}).get(stage, "")
    color_clause = f"{color}, " if color else ""
    return (
        f"A {color_clause}{BREEDS[breed]}, {STAGES[stage]}, {MOODS[mood]}, "
        "head and shoulder portrait, western ranch setting, weathered wood corral behind, "
        "photorealistic, painterly, neo-Western, 4:5 aspect ratio. "
        "The horse is the subject. The light is the mood. The look in the eye is the story."
    )


# ---------------------------------------------------------------------------
# Codex Responses image_generation call
# ---------------------------------------------------------------------------

def generate_one(token, prompt, timeout=180):
    """Stream a Codex Responses image_generation call and return the b64 image."""
    headers = _codex_cloudflare_headers(token)
    headers.update({
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    payload = {
        "model": CODEX_CHAT_MODEL,
        "store": False,
        "instructions": (
            "You are an assistant that must fulfill image generation requests by "
            "using the image_generation tool when provided."
        ),
        "input": [{
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}],
        }],
        "tools": [{
            "type": "image_generation",
            "model": API_MODEL,
            "size": SIZE,
            "quality": QUALITY,
            "output_format": "png",
            "background": "opaque",
            "partial_images": 1,
        }],
        "tool_choice": {
            "type": "allowed_tools",
            "mode": "required",
            "tools": [{"type": "image_generation"}],
        },
        "stream": True,
    }

    http_timeout = httpx.Timeout(timeout, connect=30.0, read=timeout, write=30.0, pool=30.0)

    image_b64 = None
    with httpx.Client(timeout=http_timeout, headers=headers) as http:
        with http.stream("POST", f"{CODEX_BASE_URL}/responses", json=payload) as response:
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                body = exc.response.read().decode("utf-8", errors="replace")[:500]
                raise RuntimeError(f"HTTP {exc.response.status_code}: {body}") from exc

            event_name = None
            data_lines = []
            for raw_line in response.iter_lines():
                line = raw_line.decode("utf-8", errors="replace") if isinstance(raw_line, bytes) else str(raw_line)
                if line == "":
                    if data_lines:
                        raw = "\n".join(data_lines).strip()
                        data_lines = []
                        if raw and raw != "[DONE]":
                            try:
                                event = json.loads(raw)
                            except json.JSONDecodeError:
                                continue
                            if isinstance(event, dict):
                                if event.get("type") == "image_generation_call":
                                    result = event.get("result")
                                    if isinstance(result, str) and result:
                                        image_b64 = result
                                if "partial_image_b64" in event and isinstance(event["partial_image_b64"], str):
                                    image_b64 = event["partial_image_b64"]
                    event_name = None
                    continue
                if line.startswith(":"):
                    continue
                if line.startswith("event:"):
                    event_name = line[len("event:"):].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[len("data:"):].lstrip())

    return image_b64


# ---------------------------------------------------------------------------
# State management
# ---------------------------------------------------------------------------

def load_state():
    if not STATE_FILE.exists():
        return {"done": [], "failed": []}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"done": [], "failed": []}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def manifest(breeds_filter=None):
    out = []
    for breed in BREEDS:
        if breeds_filter and breed not in breeds_filter:
            continue
        for stage in STAGES:
            for mood in MOODS:
                out.append((breed, stage, mood))
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--stagger", type=float, default=10.0,
                   help="Seconds between successful calls (default 10)")
    p.add_argument("--stagger-fail", type=float, default=30.0,
                   help="Seconds to wait after a failed call (default 30)")
    p.add_argument("--timeout", type=float, default=180.0,
                   help="Per-call HTTP timeout (default 180s)")
    p.add_argument("--max-retries", type=int, default=2,
                   help="Max retries per horse (default 2)")
    p.add_argument("--breed", action="append", default=None,
                   help="Limit to specific breed(s), repeatable")
    p.add_argument("--limit", type=int, default=None,
                   help="Stop after this many horses (default: all remaining)")
    args = p.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get token
    token = _read_codex_access_token()
    if not token:
        print("ERROR: Could not get Codex access token. Re-auth with `codex`.", file=sys.stderr)
        sys.exit(1)

    # Load state and build todo
    state = load_state()
    done = set(tuple(x) for x in state.get("done", []))
    failed = set(tuple(x) for x in state.get("failed", []))

    todo = []
    for breed, stage, mood in manifest(args.breed):
        key = (breed, stage, mood)
        filename = OUTPUT_DIR / f"{breed}_{stage}_{mood}.png"
        if filename.exists() and filename.stat().st_size > 0:
            done.add(key)
            continue
        if key in done:
            continue
        todo.append(key)

    if args.limit:
        todo = todo[:args.limit]

    total_remaining = len(todo)
    print(f"[startup] Already done: {len(done)}, remaining: {total_remaining}")
    print(f"[startup] Stagger: {args.stagger}s fresh, {args.stagger_fail}s after fail")

    start_time = time.time()
    new_done = 0
    new_failed = 0

    for i, (breed, stage, mood) in enumerate(todo, 1):
        filename = OUTPUT_DIR / f"{breed}_{stage}_{mood}.png"
        prompt = build_prompt(breed, stage, mood)

        attempt = 0
        success = False
        last_err = None
        while attempt <= args.max_retries and not success:
            attempt += 1
            try:
                t0 = time.time()
                image_b64 = generate_one(token, prompt, timeout=args.timeout)
                if not image_b64:
                    raise RuntimeError("No image data in response")
                image_bytes = base64.b64decode(image_b64)
                filename.write_bytes(image_bytes)
                elapsed = time.time() - t0
                print(f"[{i}/{total_remaining}] OK {breed}_{stage}_{mood} ({elapsed:.1f}s)")
                done.add((breed, stage, mood))
                new_done += 1
                success = True
            except Exception as e:
                last_err = e
                if attempt <= args.max_retries:
                    print(f"[{i}/{total_remaining}] retry {attempt}/{args.max_retries} {breed}_{stage}_{mood}: {e}", file=sys.stderr)
                    time.sleep(args.stagger_fail)

        if not success:
            print(f"[{i}/{total_remaining}] FAIL {breed}_{stage}_{mood}: {last_err}", file=sys.stderr)
            failed.add((breed, stage, mood))
            new_failed += 1

        # Save state every iteration so we can resume
        save_state({"done": [list(x) for x in done], "failed": [list(x) for x in failed]})

        # Stagger before next call (unless we're done)
        if i < total_remaining:
            time.sleep(args.stagger)

    elapsed_total = time.time() - start_time
    print(f"\n[done] Saved {new_done}, failed {new_failed}, elapsed {elapsed_total:.1f}s")
    print(f"[done] Total done: {len(done)} / 90")
    if failed:
        print(f"[done] Failed: {sorted(failed)}")


if __name__ == "__main__":
    main()