# Install — Teams Transcript to Markdown

A small Microsoft Edge / Chrome extension that captures the transcript from
a Teams meeting or recording and downloads it as an LLM-friendly Markdown
file. ~30 s to install, no account or sign-in needed.

## Microsoft Edge

1. **Unzip** this archive somewhere stable on your machine
   (e.g. `~/Extensions/teams-transcript-md/`). The folder must stay where
   it is — Edge loads the extension from this location every time.
2. Open Edge and go to `edge://extensions/`.
3. Toggle **Developer mode** on (bottom-left).
4. Click **Load unpacked** and select the folder you unzipped.
5. (Optional) Click the puzzle-piece icon in the toolbar and **pin** the
   extension so its button stays visible.

That's it. The extension is now installed.

## Google Chrome / Brave / other Chromium

Same steps, just at `chrome://extensions/` (or `brave://extensions/`).

## Use

1. Open a Teams meeting or a Teams meeting **recording**. Recordings
   typically open inside SharePoint or OneDrive's Stream player — those
   work too. So does `teams.microsoft.com`, `web.microsoftstream.com`,
   and the new `*.cloud.microsoft` surfaces.
2. Reveal the **Transcript** pane (the side panel with the time-stamped
   lines). Wait a beat for it to render.
3. Click the extension's toolbar button.
4. Click **Capture & Download .md**.

A long meeting takes ~30 s — the extension has to scroll the transcript
top-to-bottom to render every entry. When it finishes, your browser saves
`<meeting title>.md` to your default download location.

## What you get

A token-efficient Markdown file optimized for handing to an LLM. Header
plus one block per turn:

```markdown
# Transcript: <meeting title>

Source: <full meeting URL>
Duration: 1:02:18
Speakers: Alice, Bob, ...

---

[00:27] Alice: Long paragraph of merged consecutive cues...

[01:13] Bob: Reply...
```

## Permissions

- `activeTab` — temporary access to the current tab when you click the
  toolbar button. No background access to any site.
- `scripting` — required by Manifest V3 to inject the capture script when
  you press the button.

The extension declares **no host permissions**, runs **no background
service worker**, and never sends data anywhere. Everything happens
in-page; the resulting `.md` is a normal browser download.

## Updating

When a new version arrives:

1. Unzip it over the existing folder (or to a fresh folder).
2. In `edge://extensions/`, click the reload (↻) icon under the extension.

## Uninstalling

In `edge://extensions/`, click **Remove** on the extension. Optionally
delete the unzipped folder afterward.

## Trouble?

- "Capture script returned no result" or "Couldn't locate the transcript
  pane" — make sure the Transcript tab is actually open (the panel with
  the time-stamped lines visible) before clicking Capture.
- The file saves with a generic name like `Teams Transcript.md` — the
  page didn't expose a usable meeting title. Edit the name in your
  browser's "Save as" dialog, or rename after the fact.
- Nothing downloads — check the browser's download manager; the file may
  have been blocked or saved silently to the default folder.
