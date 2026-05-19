# Permission justifications

Use these for the per-permission "why does your extension need this?" prompt
on both stores. Chrome rejects short answers; the long forms below pass.

## activeTab

Required to inject the transcript-capture script into the current Teams or
SharePoint Stream tab the user is viewing. We use activeTab specifically
(rather than broad host permissions) so the extension has zero background
access to any site; it only touches the active tab in response to the user
clicking the toolbar icon.

## scripting

Required by Manifest V3 to call `chrome.scripting.executeScript` when the
user clicks Capture. We do not register any content scripts — injection
happens on demand only.

## storage

Used to save the user's selected output format (Markdown or WebVTT) and
rendering options (include timestamps, merge consecutive same-speaker
entries, unknown-speaker label) to `chrome.storage.local`. This persists
their preferences between popup opens and never leaves the local browser
profile.

## downloads

Used by the popup to save the captured transcript via
`chrome.downloads.download` (giving the user a normal browser download),
and to power the "Show in folder" button via `chrome.downloads.show`.

## downloads.open

Used by the result panel's "Open" button to launch the just-saved
transcript file in its default application via `chrome.downloads.open`.
Only acts on the file the extension itself just downloaded.
