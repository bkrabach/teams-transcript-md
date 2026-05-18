# icons/

These are the PNGs the extension manifest points at. They currently hold
the **monogram** option from `../icon-options/`. The four sizes are required
by Manifest V3:

| File           | Size      | Used at                              |
| -------------- | --------- | ------------------------------------ |
| `icon-16.png`  | 16×16     | Toolbar action (small density)       |
| `icon-32.png`  | 32×32     | Toolbar action (high-DPI / Windows)  |
| `icon-48.png`  | 48×48     | `edge://extensions/` management page |
| `icon-128.png` | 128×128   | Store listing / install dialog       |

## Swap to a different option

Four hand-rendered options live in `../icon-options/`. To change the active
icon set:

```bash
# interactive list
../icon-options/pick.sh

# or pick by name (short or full)
../icon-options/pick.sh bubble
../icon-options/pick.sh 02-doc
```

Then go to `edge://extensions/` and click the extension's reload (↻) button
to pick up the new files.

## Use your own icon

Drop your own `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
in this directory. They overwrite what `pick.sh` placed here.

## Regenerate from source

Each option in `../icon-options/<name>/` ships with its `source.svg`.
Edit the SVG (or `../icon-options/build_icons.py` if you want to change
all of them) and rerun:

```bash
python3 ../icon-options/build_icons.py
../icon-options/pick.sh <your-option>
```
