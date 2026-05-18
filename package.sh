#!/usr/bin/env bash
# Build a shareable zip of the extension.
#
# Output: dist/teams-transcript-md-v<VERSION>.zip
#
# The zip contains ONLY the runtime files a peer needs:
#   manifest.json, popup.html, popup.css, popup.js,
#   icons/icon-{16,32,48,128}.png, INSTALL.md
#
# Excluded:  icon-options/, README.md, .git/, .gitignore, package.sh

set -euo pipefail
cd "$(dirname "$0")"

# Discover version from manifest.json (stdlib python, available everywhere).
VERSION="$(python3 -c "import json,sys; print(json.load(open('manifest.json'))['version'])")"
NAME="teams-transcript-md"
STAGE="dist/${NAME}"
ZIP="dist/${NAME}-v${VERSION}.zip"

# Files that must exist for a valid build.
REQUIRED=(
  manifest.json
  capture.js
  popup.html
  popup.css
  popup.js
  INSTALL.md
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

missing=()
for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || missing+=("$f")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required files:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

# Validate manifest is parseable JSON.
python3 -c "import json; json.load(open('manifest.json'))" \
  || { echo "manifest.json is not valid JSON" >&2; exit 1; }

# Validate scripts parse (best-effort: needs node).
if command -v node >/dev/null 2>&1; then
  node --check popup.js >/dev/null
  node --check capture.js >/dev/null
fi

# Clean stage + build.
rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/icons"

cp manifest.json capture.js popup.html popup.css popup.js INSTALL.md "$STAGE/"
cp icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png "$STAGE/icons/"

# Build the zip with a stable, sorted file order so the artifact is
# reproducible byte-for-byte across runs.
(
  cd "$STAGE"
  # -X strips file metadata that varies run-to-run.
  find . -type f -print | LC_ALL=C sort | zip -X -9 -q "../$(basename "$ZIP")" -@
)

# Tidy up stage dir; keep only the zip.
rm -rf "$STAGE"

SIZE_BYTES="$(stat -c%s "$ZIP" 2>/dev/null || stat -f%z "$ZIP")"
SHA="$(command -v sha256sum >/dev/null && sha256sum "$ZIP" | awk '{print $1}' \
       || shasum -a 256 "$ZIP" | awk '{print $1}')"

echo
echo "Built: $ZIP"
echo "Size:  $(printf "%'d" "$SIZE_BYTES") bytes"
echo "SHA256: $SHA"
echo
echo "Send the zip to a peer. To install they:"
echo "  1. Unzip it somewhere stable."
echo "  2. Open edge://extensions/  (or chrome://extensions/)"
echo "  3. Enable Developer mode."
echo "  4. Click 'Load unpacked' and pick the unzipped folder."
echo
echo "Full peer-facing steps are inside the zip as INSTALL.md."
