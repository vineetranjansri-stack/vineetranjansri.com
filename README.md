# Solar Panel Inventory & Reconciliation

A browser-based tool for bulk-counting solar panels on arrival, logging damaged units,
and reconciling the count against the supplier's dispatch sheet — with Excel exports at
every step. Runs entirely in the browser: no backend, no database, no install beyond a
one-time `npm install`.

## Workflow

1. **Start a session** — name the batch/consignment (e.g. `PO-4821 – Container 2`).
2. **Scan panels** (Scan tab) — scan each panel's serial number barcode/QR code, then
   mark it **Intact** or **Damaged**. Damaged panels require a defect type (crack, glass
   breakage, frame damage, hot spot, junction box damage, backsheet damage, scratch,
   delamination, other) and optional notes. Re-scanning a serial already logged shows a
   warning so you can update or ignore it, instead of silently double-counting.
3. **Review the inventory** (Inventory tab) — search/filter all scanned panels, edit or
   delete a bad entry, and export the **Intact** or **Damaged** panels as standalone
   `.xlsx` sheets (with serial numbers, status, defect details, and timestamps).
4. **Upload the supplier dispatch sheet** (Dispatch & Reconciliation tab) — upload the
   supplier's `.xlsx`/`.csv`, pick which column holds the serial number (auto-guessed
   from the header), and the app reconciles it against what was scanned:
   - **Matched Intact** / **Matched Damaged** — dispatched and accounted for
   - **Missing** — dispatched per the supplier sheet but never scanned (lost/short-shipped)
   - **Extra** — scanned but not on the dispatch sheet (miscount or wrong consignment)
5. **Summary report** (Summary tab) — totals, damage rate, defect-type breakdown, and a
   one-click **Export Full Report (.xlsx)** with Summary / Intact / Damaged /
   Extra / Missing as separate sheets in one workbook.

The session (scanned panels + loaded dispatch sheet) is auto-saved to the browser's
local storage as you go, so an accidental page refresh doesn't lose the count. Use
**End Session** to clear it and start a fresh one (export your reports first).

## How counting is carried out

Two scanning methods are supported side by side in the Scan tab — pick whichever fits
the floor:

- **Bluetooth / USB scanner gun** — pair the handheld scanner in the device's Bluetooth
  settings first (it connects as a wireless keyboard, not through the app itself), then
  tap the "Scan gun input" box once so it's focused. Each trigger pull types the code
  and submits it automatically — no "Add" click needed. This is the recommended method
  for continuous high-volume counting: faster and more reliable than camera scanning,
  and it's what the app auto-focuses and re-focuses after every scan is classified so
  the gun keeps working hands-free. The same box also accepts hand-typed serials or a
  paste. Browsers have no API to report Bluetooth HID pairing/connection status, so
  there's intentionally no "connected" indicator — if scans stop registering, it almost
  always means the box lost focus (re-tap it).
- **Phone/tablet camera** — tap "Start Camera Scan" to scan a panel's barcode or QR
  code directly with the device camera (supports Code128, EAN-13/8, Code39, UPC-A/E,
  ITF, Codabar, and QR). No extra hardware needed; a fallback when no scanner gun is on
  hand.

Both methods feed the same duplicate-check and classify (Intact/Damaged) flow.

## Getting started

```bash
npm install
npm run dev       # local dev server
npm run build      # production build (dist/)
```

Open the dev server URL on the phone/tablet that will do the scanning (camera access
requires HTTPS or `localhost` in most browsers).

## Notes

- Data storage is Excel-only by design — there is no server or database. Everything
  lives in the browser session and is exported as `.xlsx` for handoff/archival.
- The `xlsx` (SheetJS) npm package has known advisories (prototype pollution, ReDoS)
  with no fix currently published to the npm registry; SheetJS's own patched builds are
  distributed from `cdn.sheetjs.com` instead of npm. This environment's network policy
  blocks that host, so the app ships with the npm-registry build. Since the app only
  ever parses files the user selects themselves in their own browser (no server, no
  untrusted network input), real-world exposure is low — but if you want the patched
  build, run `npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`
  from a network that allows it.
