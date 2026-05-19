# PUBLISH.md — Step-by-step for the Edge + Chrome stores

Concrete, ordered checklist to ship this extension. Local paths in this
guide assume the repo lives at `~/dev/vtt-clean/teams-transcript-md/`
(adjust as needed).

## Files this guide references

```
manifest.json                         the extension manifest (v0.5.1)
dist/teams-transcript-md-v0.5.1.zip   the artifact uploaded to both stores
privacy.md                            paste-and-publish privacy policy
store-assets/promo-1280x800.png       Edge promotional tile + Chrome large tile
store-assets/promo-440x280.png        Chrome small promotional tile
store-assets/marquee-1400x560.png     Chrome marquee tile (optional)
store-assets/build_promo.py           regenerator for the three tiles above
```

Build / refresh:
```bash
./package.sh                          # rebuild the zip
python3 store-assets/build_promo.py   # regenerate the promo tiles
```

---

## Phase 0 — one-time prep (reusable for both stores)

### 0.1 Pick a permanent home and contact channel

Push this repo to GitHub (private is fine; visibility doesn't matter for
the store submission). The repo's **Issues** URL becomes the support
contact you'll paste into both stores. Pick the GitHub user/org name
now — both privacy URL and support URL depend on it.

### 0.2 Host the privacy policy

Both stores require a public URL. The committed `privacy.md` is ready
to publish. Easiest free hosting is GitHub Pages:

```
1. Push this repo to GitHub.
2. In repo Settings → Pages, source: "Deploy from a branch",
   branch: main, folder: / (root). Save.
3. Wait ~30 s for the first deploy.
4. Your privacy URL is:  https://<user>.github.io/<repo>/privacy
   (verify it loads in a browser before continuing).
```

Alternative free hosts that work the same way: Cloudflare Pages,
Netlify, Vercel. Any HTTPS URL that renders the page is fine.

### 0.3 Take screenshots (1280×800)

Need 1–5 PNGs for the listing. Recommended set, all on a real
SharePoint Stream recording page:

| # | What | How |
| -- | ---- | --- |
| 1 | Popup just opened, default settings | Click the toolbar icon on the recording page. Screenshot the whole popup. |
| 2 | Popup mid-capture | Click Capture; screenshot while the status reads `Capturing transcript… (.md)`. |
| 3 | Popup showing the result panel (filename + Open + Show in folder) | Wait for capture to finish; screenshot the steady state. |
| 4 | The resulting `.md` open in VS Code or any text editor | Open the file; screenshot the editor window. |
| 5 | Optional: side-by-side raw `.vtt` vs the produced `.md` | Tile two editor windows side by side. |

Crop / pad each to **1280×800** in any image editor. Save them next to
this file (e.g. `store-assets/screenshot-1.png` ... `-5.png`) so a
peer can find them later if needed.

### 0.4 Verify the package is current

```bash
cd ~/dev/vtt-clean/teams-transcript-md
./package.sh
```

You should see `dist/teams-transcript-md-v0.5.1.zip` (~23–24 KB).
The SHA256 printed at the end is reproducible — if you rerun the
script with no source changes you'll get the same hash. Useful when
verifying you uploaded the right file.

---

## Phase 1 — Microsoft Edge Add-ons

**Cost:** free. **Review time:** typically 1–3 business days.

### 1.1 Create the developer account

1. Go to <https://partner.microsoft.com/dashboard/microsoftedge>.
2. Sign in with a Microsoft account (personal or work).
3. Accept the developer agreement.
4. Verify the email on the account.

### 1.2 Submit a new extension

1. Dashboard → **Microsoft Edge Add-ons** → **New extension**.
2. **Packages tab:** upload `dist/teams-transcript-md-v0.5.1.zip`.
   Edge unpacks it, reads the manifest, shows the permissions it
   parsed. Verify it lists exactly:
   `activeTab, scripting, storage, downloads, downloads.open`.
3. **Properties tab:**
   - Category: **Productivity** (also tick *Developer tools* if Edge
     allows multi-select).
   - Languages: **English** (add others if you localise later).
   - Age rating: Everyone.
4. **Store listing tab** (English):
   - **Display name:** `Teams Transcript to Markdown`
   - **Short description (≤200 chars):**
     ```
     Capture Microsoft Teams meeting recording transcripts as
     LLM-friendly Markdown or raw WebVTT. Fast API path on
     SharePoint recordings (~2s); DOM-scrape fallback for others.
     ```
   - **Detailed description:** paste from `INSTALL.md` starting at the
     "Use" section through "Permissions". Edge supports Markdown.
   - **Search terms (up to 7):**
     `teams, transcript, markdown, vtt, recording, sharepoint, meeting`
   - **Store logos:** Edge uses `icons/icon-128.png` from inside the
     uploaded zip automatically. If the form asks for one separately,
     upload that same file.
   - **Screenshots (1–10, recommended 4–5):** upload your 1280×800
     PNGs from §0.3.
   - **Promotional images (optional but recommended):** upload
     `store-assets/promo-1280x800.png`.
5. **Privacy tab:**
   - "Does the extension collect any user data?" → **No**.
   - "Does the extension transfer data to third parties?" → **No**.
   - "Privacy policy URL:" the URL from §0.2.
6. **Properties → Permissions justification** (Edge calls this
   "Why does your extension need…"):
   ```
   activeTab      — Access the current tab only when the user
                    explicitly clicks the extension's toolbar icon.
                    Required to inject the transcript-capture script.

   scripting      — Required by Manifest V3 to inject the capture
                    script on demand. No persistent content scripts.

   storage        — Save the user's preferred output format and
                    rendering options locally so the popup remembers
                    them between uses.

   downloads      — Save the captured transcript via the browser's
                    download manager and reveal it in the OS file
                    manager from the popup.

   downloads.open — Power the "Open" button in the result panel —
                    opens the just-saved file in the user's default
                    application.
   ```
7. **Availability tab:**
   - Markets: all markets.
   - Pricing: Free.
   - Visibility: Public.
8. Click **Publish**.

You'll get an email when review is done.

---

## Phase 2 — Chrome Web Store

**Cost:** $5 one-time. **Review time:** 3–7 days for the first
submission of a new extension; usually <48 h for subsequent updates.

### 2.1 Pay the developer fee

1. <https://chrome.google.com/webstore/devconsole>.
2. Sign in with a Google account.
3. Accept the Developer Agreement.
4. Pay the **one-time $5** registration fee (credit card).

### 2.2 Create the listing

Click **New item**, drag-drop **the same zip** you sent to Edge:
`dist/teams-transcript-md-v0.5.1.zip`.

### 2.3 Store listing tab

| Field | Source |
| ----- | ------ |
| **Item title** (≤45 chars) | `Teams Transcript to Markdown` |
| **Summary** (≤132 chars) | `Capture Microsoft Teams meeting recording transcripts as LLM-friendly Markdown or raw WebVTT.` |
| **Description** (≤16,384 chars, **plain text**) | Reuse Edge's detailed description, but strip Markdown syntax (no `**bold**`, no tables — use plain "key: value" lines or short paragraphs). Edge wraps long lines reasonably; Chrome preserves them, so keep paragraphs short. |
| **Category** | Productivity |
| **Language** | English (United States) |

### 2.4 Graphic assets tab

| Asset | Size | Required? | File |
| ----- | ---- | --------- | ---- |
| Store icon | 128×128 | yes | already in the zip (`icons/icon-128.png`) |
| Screenshots | 1280×800 (preferred) | ≥1 | `store-assets/screenshot-{1..5}.png` from §0.3 |
| Small promo tile | 440×280 | yes (for any chance of being surfaced beyond search) | `store-assets/promo-440x280.png` |
| Marquee promo tile | 1400×560 | optional | `store-assets/marquee-1400x560.png` |

### 2.5 Additional fields tab

**Single purpose:**
```
Captures Microsoft Teams meeting recording transcripts and saves them as
Markdown or WebVTT files for offline reading and LLM processing.
```

**Permission justifications** (Chrome often rejects short answers — use
these expanded versions):

- `activeTab`:
  ```
  Required to inject the transcript-capture script into the current
  Teams or SharePoint Stream tab the user is viewing. We use activeTab
  specifically (rather than broad host permissions) so the extension
  has zero background access to any site; it only touches the active
  tab in response to the user clicking the toolbar icon.
  ```

- `scripting`:
  ```
  Required by Manifest V3 to call chrome.scripting.executeScript when
  the user clicks Capture. We do not register any content scripts —
  injection happens on demand only.
  ```

- `storage`:
  ```
  Used to save the user's selected output format (Markdown or WebVTT)
  and rendering options (include timestamps, merge consecutive
  same-speaker entries, unknown-speaker label) to chrome.storage.local.
  This persists their preferences between popup opens and never leaves
  the local browser profile.
  ```

- `downloads`:
  ```
  Used by the popup to save the captured transcript via
  chrome.downloads.download (giving the user a normal browser download),
  and to power the "Show in folder" button via chrome.downloads.show.
  ```

- `downloads.open`:
  ```
  Used by the result panel's "Open" button to launch the just-saved
  transcript file in its default application via chrome.downloads.open.
  Only acts on the file the extension itself just downloaded.
  ```

### 2.6 Privacy tab

- "Are you collecting or using user data?" → **Yes**, then on the next
  screen:
  - Personally identifiable information → No
  - Health information → No
  - Financial and payment information → No
  - Authentication information → No
  - Personal communications → No
  - Location → No
  - Web history → No
  - User activity → No
  - **Website content → Yes** (justification: "Reads the current tab's
    transcript pane or Stream API response only when the user clicks
    Capture. The content is processed locally and delivered to the user
    as a download. No copy is sent anywhere else.")
- Certifications (tick all three):
  - "I do not sell or transfer user data to third parties, apart from
    the approved use cases" ✓
  - "I do not use or transfer user data for purposes that are unrelated
    to my item's single purpose" ✓
  - "I do not use or transfer user data to determine creditworthiness
    or for lending purposes" ✓
- **Privacy policy URL:** the URL from §0.2.

### 2.7 Distribution tab

- Visibility: Public.
- Distribution: All regions.

### 2.8 Submit

Click **Submit for review**.

---

## What to do while waiting for review

- **Don't sweat slowness.** Both stores routinely take longer than
  their stated SLAs. Edge in particular sometimes sits idle 3–5 days
  with no movement, then publishes overnight.

- **Watch for clarification emails.** Reviewers occasionally ask for
  a one-line clarification (e.g. "explain how 'downloads.open' is used
  beyond what's in your justification"). Replying quickly often
  shortens the cycle by days.

- **Don't resubmit a new version while review is pending.** It
  resets the queue. Wait for the verdict on the current submission
  before pushing changes.

---

## Updating later

For any subsequent version (v0.6.0 etc.):

1. Bump `manifest.json` version.
2. `./package.sh` produces the new zip.
3. In the relevant store dashboard, open the existing listing.
4. **Packages tab** → upload the new zip.
5. If the description, screenshots, or permissions changed, update
   those tabs too.
6. Submit. Most updates publish in <48 h on both stores.

Update reviews are much faster than first submissions because the
listing and developer account already passed initial vetting.

---

## Quick reference — what reviewers care about

We pass all the gotchas, but they're worth knowing:

- ✓ Manifest V3 (`manifest_version: 3`)
- ✓ No remote code execution (no `eval`, no remote scripts loaded)
- ✓ No code obfuscation — all JS in the zip is human-readable
- ✓ No host permissions
- ✓ Permissions are minimal and each is justifiable
- ✓ Single, clear purpose stated and matched by behavior
- ✓ All declared functionality works (they test the extension)
- ✓ No external network calls outside the user's current SharePoint
  origin
- ✓ Icon present at all four required sizes
