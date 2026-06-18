#!/usr/bin/env python3
"""
Generic Codex image generator for Blood & Bridle Phase 11-14 assets.

Reads a manifest JSON like scripts/phase11-manifest.json. Each entry has
{id, category, subject, description, mood, style, outPath}. For every
entry, builds a Codex prompt, calls gpt-image-2 via the Codex Responses
API directly, saves the result to outPath, and tracks progress in a
state.json so the run is resume-friendly across Codex Plus rate-limit
pauses.

Auth and endpoint match scripts/codex-horse-generator.py: the Codex
Responses API via chatgpt.com/backend-api/codex with the Cloudflare
headers Hermes generates for the openai-codex plugin.

Usage:
    python3 scripts/codex-asset-generator.py --manifest scripts/phase11-manifest.json
    python3 scripts/codex-asset-generator.py --manifest scripts/phase11-manifest.json --stagger 5
    python3 scripts/codex-asset-generator.py --manifest scripts/phase11-manifest.json --id mae_neutral
"""

import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERMES_HOME = os.path.expanduser("~/.hermes/hermes-agent")
sys.path.insert(0, HERMES_HOME)

import httpx  # noqa: E402

from agent.auxiliary_client import (  # noqa: E402
    _codex_cloudflare_headers,
    _read_codex_access_token,
)

# Same endpoint the horse generator uses — chatgpt Codex Responses API.
CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
CODEX_CHAT_MODEL = "gpt-5.5"


def build_prompt(entry):
    parts = [entry["subject"]]
    if entry.get("description"):
        parts.append(entry["description"])
    if entry.get("style"):
        parts.append(entry["style"])
    if entry.get("mood") and entry["category"] == "hand-portrait":
        parts.append(f"The expression is {entry['mood']}.")
    if entry.get("mood") and entry["category"] == "rival-portrait":
        parts.append(f"The expression is {entry['mood']}.")
    if entry.get("mood") and entry["category"] == "heir-portrait":
        parts.append(f"The expression is {entry['mood']}.")
    return " ".join(parts)


def aspect_for(category):
    if category in ("hand-portrait", "rival-portrait", "heir-portrait", "brand-surface", "banner-sprite"):
        return "1024x1536"
    if category == "scene-composition":
        return "1536x1024"
    return "1024x1024"


def call_codex(token, prompt, size, *, max_retries=3):
    """Stream a Codex Responses image_generation call and return PNG bytes."""
    headers = _codex_cloudflare_headers(token)
    headers.update({
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    payload = {
        "model": CODEX_CHAT_MODEL,
        "store": False,
        "instructions": "You are an assistant that must fulfill image generation requests by using the image_generation tool when provided.",
        "input": [{
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": prompt}],
        }],
        "tools": [{
            "type": "image_generation",
            "model": "gpt-image-2",
            "size": size,
            "quality": "medium",
            "output_format": "png",
            "background": "opaque",
            "partial_images": 1,
        }],
        "tool_choice": "auto",
        "stream": True,
    }
    last_err = None
    for attempt in range(max_retries):
        try:
            with httpx.stream("POST", f"{CODEX_BASE_URL}/responses", json=payload, headers=headers, timeout=240) as resp:
                if resp.status_code == 200:
                    # Stream the SSE chunks and look for the image_generation
                    # tool call result containing the base64 image.
                    buffer = ""
                    for chunk in resp.iter_text():
                        buffer += chunk
                        # The image is delivered in a
                        # response.image_generation_call.completed event
                        # with an `image` field (base64). Older format
                        # uses response.done with output[].result.b64.
                        # We pull both shapes for robustness.
                    # Pull any base64-looking string from any field. The
                    # Codex Responses API has delivered images under
                    # various keys (image, b64_json, result) depending on
                    # the model + tool version, so we match on shape.
                    m = re.search(r'"(?:b64_json|image|result)"\s*:\s*"([A-Za-z0-9+/=]{1000,})"', buffer)
                    if m:
                        return base64.b64decode(m.group(1))
                    # No image in stream — likely an error event.
                    if "usage_limit_reached" in buffer or '"429"' in buffer:
                        reset_in = 60 * 60  # default an hour
                        m = re.search(r'"resets_in_seconds"\s*:\s*(\d+)', buffer)
                        if m:
                            reset_in = int(m.group(1))
                        print(f"  [429] usage limit, sleeping {reset_in}s + 30s buffer", flush=True)
                        time.sleep(reset_in + 30)
                        continue
                    last_err = f"image not found in stream (len={len(buffer)}, head={buffer[:400]})"
                    time.sleep(15)
                    continue
                if resp.status_code == 429:
                    detail = resp.read().decode()
                    reset_in = 60 * 60
                    m = re.search(r'"resets_in_seconds"\s*:\s*(\d+)', detail)
                    if m:
                        reset_in = int(m.group(1))
                    print(f"  [429] usage limit, sleeping {reset_in}s + 30s", flush=True)
                    time.sleep(reset_in + 30)
                    continue
                last_err = f"HTTP {resp.status_code}: {resp.read().decode()[:300]}"
        except Exception as e:
            last_err = f"exception: {e}"
        time.sleep(20)
    raise RuntimeError(f"Codex call failed after {max_retries} attempts: {last_err}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--stagger", type=float, default=6.0)
    ap.add_argument("--fail-stagger", type=float, default=30.0)
    ap.add_argument("--id", help="Generate a single entry by id")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        sys.exit(f"ERROR: manifest not found: {manifest_path}")

    state_path = manifest_path.with_suffix(".state.json")
    entries = json.loads(manifest_path.read_text())
    if args.id:
        entries = [e for e in entries if e["id"] == args.id]
        if not entries:
            sys.exit(f"ERROR: id {args.id} not in manifest")

    if state_path.exists():
        state = json.loads(state_path.read_text())
        done_ids = set(state.get("done", []))
    else:
        state = {"manifest": str(manifest_path), "done": [], "failed": []}
        done_ids = set()
    # Persist immediately so a SIGTERM at second 0 leaves a usable file
    # for resume.
    state_path.write_text(json.dumps(state, indent=2))

    todo = [e for e in entries if e["id"] not in done_ids]
    print(f"[startup] Total: {len(entries)}, done: {len(done_ids)}, todo: {len(todo)}", flush=True)

    if args.dry_run:
        for e in todo:
            print(f"\n--- {e['id']} ---  size={aspect_for(e['category'])}  out={e['outPath']}")
            print(f"  prompt: {build_prompt(e)[:200]}...")
        return

    token = _read_codex_access_token()
    out_root = ROOT
    started = time.time()
    for i, entry in enumerate(todo, 1):
        out_path = out_root / entry["outPath"]
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if out_path.exists() and out_path.stat().st_size > 1000:
            print(f"[{i}/{len(todo)}] SKIP {entry['id']} ({out_path.stat().st_size} bytes on disk)", flush=True)
            state["done"].append(entry["id"])
            done_ids.add(entry["id"])
            state_path.write_text(json.dumps(state, indent=2))
            continue

        prompt = build_prompt(entry)
        size = aspect_for(entry["category"])
        print(f"[{i}/{len(todo)}] {entry['id']} ({entry['category']}, {size})...", flush=True)

        try:
            png = call_codex(token, prompt, size)
            out_path.write_bytes(png)
            elapsed = time.time() - started
            print(f"  OK {entry['id']} ({len(png)} bytes, {elapsed:.0f}s elapsed)", flush=True)
            state["done"].append(entry["id"])
            state_path.write_text(json.dumps(state, indent=2))
            time.sleep(args.stagger)
        except Exception as e:
            print(f"  FAIL {entry['id']}: {e}", flush=True)
            state["failed"] = state.get("failed", []) + [{"id": entry["id"], "error": str(e)}]
            state_path.write_text(json.dumps(state, indent=2))
            time.sleep(args.fail_stagger)

    print(f"\n[done] {len(state['done'])}/{len(entries)} saved, {len(state.get('failed', []))} failed", flush=True)


if __name__ == "__main__":
    main()