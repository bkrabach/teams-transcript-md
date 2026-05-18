// =============================================================================
// popup.js — interactive UI shown when the toolbar icon is clicked.
//
// On open: load saved options from chrome.storage.local and populate the
// controls. Edits are persisted automatically (debounced) so a future popup
// open starts in the same state.
//
// On Capture click: save the current options + run the shared capture
// orchestrator in capture.js. The orchestrator returns the file content
// (it no longer triggers the download itself), and we hand that content
// to chrome.downloads.download() so we get a downloadId we can use for
// the "Open" / "Show in folder" buttons in the result panel.
//
// The popup does NOT auto-close.
// =============================================================================

import { loadOptions, saveOptions, runCapture } from "./capture.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const btn = $("capture");
const savedHintEl = $("saved-hint");

const resultEl = $("result");
const resultFilenameEl = $("result-filename");
const resultMetaEl = $("result-meta");
const openBtn = $("open-file");
const showBtn = $("show-folder");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function hideResult() {
  resultEl.classList.add("hidden");
  openBtn.onclick = null;
  showBtn.onclick = null;
  resultFilenameEl.textContent = "";
  resultFilenameEl.title = "";
  resultMetaEl.textContent = "";
}

async function showResult(downloadId, result, elapsedSecs) {
  // Filename + tooltip with full path (queried after the download exists).
  resultFilenameEl.textContent = result.filename;
  const kb = (result.bytes / 1024).toFixed(1);
  const parts = [];
  if (result.mode === "api") parts.push("via API");
  else if (result.mode === "dom") parts.push("via DOM");
  parts.push(`${elapsedSecs}s`);
  parts.push(`${kb} KB`);
  if (result.mode === "dom" && result.entries) {
    parts.push(`${result.entries} entries`);
    parts.push(`${result.speakers} speakers`);
  }
  resultMetaEl.textContent = parts.join(" · ");

  try {
    const items = await chrome.downloads.search({ id: downloadId });
    if (items && items[0] && items[0].filename) {
      resultFilenameEl.title = items[0].filename;
    }
  } catch (_) {}

  resultEl.classList.remove("hidden");

  openBtn.onclick = async () => {
    try {
      await chrome.downloads.open(downloadId);
    } catch (e) {
      setStatus(
        `Couldn't open the file directly (${e.message || e}). Use "Show in folder" instead.`,
        "bad",
      );
    }
  };
  showBtn.onclick = async () => {
    try {
      await chrome.downloads.show(downloadId);
    } catch (e) {
      setStatus(`Couldn't reveal the file (${e.message || e}).`, "bad");
    }
  };
}

// -----------------------------------------------------------------------------
// UI <-> options
// -----------------------------------------------------------------------------

function readUI() {
  const fmtEl = document.querySelector('input[name="fmt"]:checked');
  return {
    format: fmtEl && fmtEl.value === "vtt" ? "vtt" : "md",
    includeTimestamps: $("opt-timestamps").checked,
    merge: $("opt-merge").checked,
    unknownLabel: ($("opt-unknown").value || "Unknown").trim() || "Unknown",
  };
}

function writeUI(opts) {
  document.querySelector(
    `input[name="fmt"][value="${opts.format === "vtt" ? "vtt" : "md"}"]`,
  ).checked = true;
  $("opt-timestamps").checked = opts.includeTimestamps !== false;
  $("opt-merge").checked = opts.merge !== false;
  $("opt-unknown").value = opts.unknownLabel || "Unknown";
}

let persistTimer = null;
function persistSoon() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    await saveOptions(readUI());
    if (savedHintEl) {
      savedHintEl.textContent = "Settings saved.";
      savedHintEl.classList.remove("fade");
      void savedHintEl.offsetWidth; // re-trigger CSS transition
      savedHintEl.classList.add("fade");
    }
  }, 120);
}

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

(async () => {
  const opts = await loadOptions();
  writeUI(opts);
  hideResult();

  for (const el of document.querySelectorAll(
    'input[name="fmt"], #opt-timestamps, #opt-merge',
  )) {
    el.addEventListener("change", persistSoon);
  }
  $("opt-unknown").addEventListener("input", persistSoon);

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab || !tab.id) {
    setStatus("No active tab.", "bad");
    btn.disabled = true;
    return;
  }

  const targetEl = $("target-url");
  if (targetEl) {
    const url = tab.url || "";
    try {
      const u = new URL(url);
      targetEl.textContent = u.host + (u.pathname || "");
    } catch (_) {
      targetEl.textContent = url || "(unknown tab)";
    }
    targetEl.title = url;
  }

  btn.addEventListener("click", async () => {
    setStatus("");
    hideResult();
    btn.disabled = true;
    const options = await saveOptions(readUI()); // persist + use immediately
    setStatus(`Capturing transcript… (.${options.format})`);
    const t0 = performance.now();
    let result;
    try {
      result = await runCapture(tab.id, tab.url || "", options);
    } catch (err) {
      setStatus(`Error: ${err?.message || err}`, "bad");
      btn.disabled = false;
      return;
    }
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (!result || !result.ok) {
      setStatus(`Failed: ${(result && result.error) || "unknown error"}`, "bad");
      btn.disabled = false;
      return;
    }

    // Trigger the actual save via chrome.downloads.download so we get a
    // downloadId for the "Open" / "Show in folder" buttons.
    const blob = new Blob([result.content], { type: result.mime });
    const blobUrl = URL.createObjectURL(blob);
    let downloadId;
    try {
      downloadId = await chrome.downloads.download({
        url: blobUrl,
        filename: result.filename,
        saveAs: false,
      });
    } catch (err) {
      setStatus(`Download API failed: ${err?.message || err}`, "bad");
      URL.revokeObjectURL(blobUrl);
      btn.disabled = false;
      return;
    }
    // The browser's download manager reads the blob during the download —
    // a generous revoke window keeps things safe even for large captures.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    setStatus("");
    await showResult(downloadId, result, secs);
    btn.disabled = false;
  });
})();
