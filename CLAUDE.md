# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A standalone PWA (Progressive Web App) for filling out and exporting monthly work inspection timesheets. No build tools, no frameworks, no external dependencies — open `index.html` directly in a browser.

## Running the App

```bash
# Serve locally (required for the Service Worker to register)
python3 -m http.server 8080
# Then open http://localhost:8080 in a browser
```

Opening `index.html` as a local `file://` URL also works; the Service Worker will silently fail to register (caught and ignored in `registerServiceWorker()`), but all other functionality is intact.

There are no build, lint, or test commands — the project has no package.json or tooling configuration.

## Architecture

All application logic lives in `app.js` (~380 lines of vanilla JS). The entry point is `init()`, called immediately on load.

### State

A single `state` object is the source of truth and is persisted to `localStorage` under the key `timesheet-web-v2`.

```js
state = {
  profile: { name, employeeId, position, department, costCenter, division },
  selectedMonth: "YYYY-MM",
  months: {
    "YYYY-MM": [
      { day, timeIn, timeOut, site, description, employeeSign, customerName, signature, remark },
      // one entry per calendar day in that month
    ]
  }
}
```

The `fields` object (top of `app.js`) holds all DOM references; avoid re-querying the DOM elsewhere.

### Two-Panel UI

`index.html` has two top-level sections:

- **`.workspace`** — the interactive editor (visible during normal use): a day list sidebar (`#dayList`) and a day editor form (`#dayForm`).
- **`#printPage`** — a hidden print/export table, populated dynamically by `preparePrint()` just before PDF print or Excel export. It uses `data-print="*"` attributes to receive header values.

### Signature Storage

Signatures are stored as an array of strokes: `signature: [ [{x, y}, ...], ... ]`. Coordinates are normalized floats (0–1) relative to the canvas dimensions, making them resolution-independent. `drawSignature()` scales back to pixels at render time. `signatureDataUrl()` renders to a fixed 360×90 off-screen canvas for export.

### Excel Export

`exportExcel()` wraps `#printPage`'s outer HTML in a minimal HTML document and downloads it with MIME type `application/vnd.ms-excel`. The resulting `.xls` file is actually HTML, not a true XLSX binary — Excel opens it via its HTML import path.

### Service Worker

`sw.js` implements a cache-first strategy for all static assets listed in `ASSETS`. The cache version is `timesheet-inspection-report-v2`. Bump the cache name when adding new assets so old caches are evicted on `activate`.

## Key Conventions

- All user data inserted into `innerHTML` must go through `escapeHTML()`.
- Signature coordinates are always stored as normalized 0–1 floats, never raw pixel values.
- `saveDay()` snapshots the current form into `state` and calls `saveState()` (which writes to `localStorage`). Always call `saveDay()` before any operation that reads all month entries (export, month switch).
- Day entries are 1-indexed (`selectedDay` starts at 1; array access uses `selectedDay - 1`).
