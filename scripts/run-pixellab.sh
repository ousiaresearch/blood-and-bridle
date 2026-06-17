#!/bin/bash
# Run the PixelLab portrait generator with the API key extracted from
# ~/.zshrc. Avoids the full-source path because the rc file has heavy
# interactive completions (zsh-specific, opens interactive shells) that
# hang when sourced from bash.
set -e

# Extract the single line and eval it. The line is in the form:
#   export PIXELLAB_API_KEY="..."
KEY_LINE=$(grep '^export PIXELLAB_API_KEY=' ~/.zshrc | tail -1)
if [ -z "$KEY_LINE" ]; then
  echo "ERROR: PIXELLAB_API_KEY not found in ~/.zshrc" >&2
  exit 1
fi
eval "$KEY_LINE"

if [ -z "${PIXELLAB_API_KEY:-}" ]; then
  echo "ERROR: PIXELLAB_API_KEY not set after eval" >&2
  exit 1
fi

export PIXELLAB_API_KEY
cd "$(dirname "$0")/.."
exec node scripts/generate-pixel-portraits.mjs "$@"
