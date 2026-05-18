#!/usr/bin/env bash
# Swap the active toolbar icon by copying one option's PNGs into ../icons/.
#
# Usage:
#   ./pick.sh                 # interactive list
#   ./pick.sh monogram        # by short name
#   ./pick.sh 03-monogram     # by directory name

set -euo pipefail
cd "$(dirname "$0")"

shopt -s nullglob
options=( */ )
shopt -u nullglob

if [ ${#options[@]} -eq 0 ]; then
  echo "No options found in $(pwd)." >&2
  exit 1
fi

list() {
  echo "Available icon options:"
  for dir in "${options[@]}"; do
    name="${dir%/}"
    short="${name#*-}"
    echo "  - $short   ($name)"
  done
}

if [ $# -eq 0 ]; then
  list
  echo
  read -rp "Pick one (short or full name): " choice
else
  choice="$1"
fi

match=""
for dir in "${options[@]}"; do
  name="${dir%/}"
  short="${name#*-}"
  if [ "$choice" = "$name" ] || [ "$choice" = "$short" ]; then
    match="$name"
    break
  fi
done

if [ -z "$match" ]; then
  echo "No option matches '$choice'." >&2
  list >&2
  exit 2
fi

dest="../icons"
mkdir -p "$dest"
for sz in 16 32 48 128; do
  cp "$match/icon-$sz.png" "$dest/icon-$sz.png"
done
echo "Active icon set to: $match"
echo "Reload the extension at edge://extensions/ to see the new icon."
