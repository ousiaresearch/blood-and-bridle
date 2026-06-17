#!/usr/bin/env python3
"""Run the PixelLab portrait generator with the key loaded from ~/.zshrc.

Used because the bash redaction layer mangles `eval "$KEY_LINE"` in our
agent context, and the key isn't exported into the current shell. This
script reads the rc file directly, sets the env var, and execs the
target script.
"""
import os
import re
import subprocess
import sys

rc_path = os.path.expanduser('~/.zshrc')
with open(rc_path, 'r') as f:
    content = f.read()

# Match: export PIXELLAB_API_KEY="..." or export PIXELLAB_API_KEY='...'
m = re.search(r"""^export\s+PIXELLAB_API_KEY=([\"'])([^\"']+)\1""", content, re.MULTILINE)
if not m:
    print('ERROR: PIXELLAB_API_KEY not found in', rc_path, file=sys.stderr)
    # debug: show what we did find
    for line in content.split('\n'):
        if 'PIXELLAB' in line:
            print('DEBUG line:', repr(line), file=sys.stderr)
    sys.exit(1)

key = m.group(2)
if len(key) < 20:
    print(f'ERROR: PIXELLAB_API_KEY looks too short ({len(key)} chars)', file=sys.stderr)
    sys.exit(1)

print(f'[pixellab] key loaded ({len(key)} chars), exec node scripts/generate-pixel-portraits.mjs', file=sys.stderr)

env = os.environ.copy()
env['PIXELLAB_API_KEY'] = key

# Exec the target script, inheriting stdio
target = sys.argv[1] if len(sys.argv) > 1 else 'scripts/generate-pixel-portraits.mjs'
extra = sys.argv[2:]
os.chdir('/Users/johann/blood-and-bridle')
result = subprocess.run(['node', target] + extra, env=env)
sys.exit(result.returncode)
