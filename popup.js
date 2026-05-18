// =============================================================================
// popup.js — interactive UI shown when the toolbar icon is clicked.
//
// On open: load saved options from chrome.storage.local and populate the
// controls. Edits are persisted automatically (debounced) so a future popup
// open starts in the same state.
//
// On Capture click: save the current options + run the shared capture
// orchestrator in capture.js, then auto-close on success so the browser's
// download notification isn't covered by our window.
// =============================================================================

import { loadOptions, saveOptions, runCapture } from "./capture.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const btn = $("capture");
const savedHintEl = $("saved-hint");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
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
    btn.disabled = true;
    const options = await saveOptions(readUI()); // persist + use immediately
    setStatus(`Capturing transcript… (.${options.format})`);
    const t0 = performance.now();
    try {
      const result = await runCapture(tab.id, tab.url || "", options);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      if (result.ok) {
        const kb = (result.bytes / 1024).toFixed(1);
        const detail =
          result.mode === "api"
            ? `via API · ${secs}s · ${kb} KB`
            : `via DOM · ${secs}s · ${result.entries} entries · ${result.speakers} speakers · ${kb} KB`;
        setStatus(`✓ Downloaded "${result.filename}" — ${detail}`, "good");
        // Close so the browser's download notification isn't covered up.
        setTimeout(() => window.close(), 150);
      } else {
        setStatus(`Failed: ${result.error || "unknown error"}`, "bad");
      }
    } catch (err) {
      setStatus(`Error: ${err?.message || err}`, "bad");
    } finally {
      btn.disabled = false;
    }
  });
})();
