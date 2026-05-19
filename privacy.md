# Privacy Policy — Teams Transcript to Markdown

**Last updated: 2026-05-18**

This extension does not collect, store, or transmit any personal data
or telemetry. There are no analytics, no remote endpoints owned by the
author, and no third-party services involved in its operation.

## What the extension does with data

- **Page content (only when you click Capture).** Reads the current
  tab's DOM (transcript pane) or, on SharePoint-hosted recording
  pages, fetches the WebVTT transcript file from the same SharePoint
  origin using your existing browser session credentials. The fetched
  content is processed entirely in your browser and delivered to you
  as a download. No copy of the data is sent anywhere else.

- **Preferences (`chrome.storage.local`).** Stores your selected
  output format (Markdown or WebVTT) and rendering options
  (timestamps, speaker merge, unknown-speaker label) in your local
  browser profile so the popup remembers them between uses. This data
  never leaves your machine.

- **Downloads (`chrome.downloads`).** Saves the captured transcript
  through the browser's standard download manager. The popup's
  "Open" and "Show in folder" buttons act only on the file the
  extension itself just created; the extension does not enumerate
  or access any other downloads.

## Permissions

The extension requests:

| Permission        | Why |
| ----------------- | --- |
| `activeTab`       | Access to the current tab when the user clicks the extension's toolbar icon. |
| `scripting`       | Required by Manifest V3 to inject the capture script on demand. |
| `storage`         | Save the user's preferred output format and rendering options locally. |
| `downloads`       | Save the captured transcript via the browser's download manager and reveal it in the OS file manager from the popup. |
| `downloads.open`  | Power the "Open" button in the result panel — opens the just-saved file in the user's default application. |

It declares **no host permissions** and runs **no background service
worker**. It makes no network requests except those described above
to the SharePoint origin the user is already visiting.

## Contact

Issues and questions: please file an issue on the project's GitHub
repository, or contact the maintainer via the support link in the
store listing.
