# Store-listing field reference

One-stop reference for everything you'll paste into the Microsoft Edge
Add-ons and Chrome Web Store submission forms. Each value lives in its
own file in this directory for direct copy-paste; this README maps the
form fields to those files.

## Files in this directory

```
summary.txt                    Short description (≤132 chars). Both stores.
description-chrome.txt         Detailed description, plain-text. Chrome.
description-edge.md            Detailed description, Markdown. Edge.
single-purpose.txt             "Single purpose" statement. Chrome only.
permission-justifications.md   5 permission justifications. Both stores.
privacy-disclosures.md         Privacy form cascade answers. Chrome only.
urls.txt                       Homepage / privacy / support / source URLs.
search-keywords.txt            Edge search keywords (up to 7).
screenshot-popup.png           1280×800 fabricated screenshot. Both stores.
promo-1280x800.png             Edge promotional tile. Edge required.
promo-440x280.png              Chrome small promotional tile. Chrome recommended.
marquee-1400x560.png           Chrome marquee tile. Chrome optional.
build_promo.py                 Regenerator for the 3 promo tiles.
screenshot-popup.html          Source HTML for the screenshot; re-render
                               via headless Chromium (see PUBLISH.md §0.3).
```

## Form-field mapping

| Form field (both stores unless noted) | Paste from |
|---|---|
| Display name / title | `Teams Transcript to Markdown` |
| Short description / summary | `summary.txt` |
| Detailed description (Chrome) | `description-chrome.txt` |
| Detailed description (Edge) | `description-edge.md` |
| Category (primary) | `Productivity` |
| Category (secondary, if offered) | `Developer Tools` |
| Language | `English (United States)` |
| Search keywords (Edge only) | `search-keywords.txt` |
| Single purpose (Chrome only) | `single-purpose.txt` |
| Permission justifications | `permission-justifications.md` |
| Privacy practices (Chrome only) | `privacy-disclosures.md` |
| Privacy policy URL | line 2 of `urls.txt` |
| Support URL | line 5 of `urls.txt` |
| Homepage URL | line 1 of `urls.txt` |
| Markets / regions | All markets |
| Pricing | Free |
| Visibility | Public |
| Age rating | Everyone / Ages 3+ |
| Package (zip) | `../dist/teams-transcript-md-v<latest>.zip` |
| Store icon | (auto from manifest's `icons/icon-128.png`) |
| Screenshot | `screenshot-popup.png` |
| Promotional tile (Edge) | `promo-1280x800.png` |
| Small promo tile (Chrome) | `promo-440x280.png` |
| Marquee tile (Chrome, optional) | `marquee-1400x560.png` |

## Submission workflow (recap)

For step-by-step submission instructions including the click-through
order in each store's developer dashboard, see `../PUBLISH.md`.

Edge Add-ons: free, ~30–45 min, ~1–3 day review.
Chrome Web Store: $5 one-time, ~45–60 min, ~3–7 day review for new items.

Both stores accept the same `dist/teams-transcript-md-v<latest>.zip` —
no separate builds needed.
