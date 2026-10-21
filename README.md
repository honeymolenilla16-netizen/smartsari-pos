# SMARTSARI — Sari-Sari Store Management System

Google Apps Script + Google Sheets POS with student-implemented DSA components,
for the DSA course semestral project.

**Stack:** Google Apps Script (V8 runtime, 100% OOP server) · Google Sheets (database) · HTML Service frontend (Tailwind, PWA-lite)

---

## Repository Layout

```
SmartSari Sari Store/
├── appscript/          ← SOURCE OF TRUTH: paste these into the Apps Script editor
│   ├── Config.gs           sheet names, schemas, constants
│   ├── Database.gs         spreadsheet access layer + getStoreData()
│   ├── DSA_HashTable.gs    DSA #1  CustomHashTable
│   ├── DSA_Queue.gs        DSA #2  CustomQueue (FIFO)
│   ├── DSA_MinHeap.gs      DSA #3  CustomMinHeap (priority queue)
│   ├── DSA_Algorithms.gs   Alg #1  MergeSort · Alg #2  BinarySearch
│   ├── TransactionService.gs   POS checkout (hash + queue)
│   ├── LedgerService.gs    cash/utang/expense/gcash/profile ledgers
│   ├── ReportService.gs    date-range reports (merge sort + hash)
│   ├── AlertService.gs     low-stock email alerts (min-heap + trigger)
│   ├── DsaTests.gs         unit test runner (runDsaUnitTests)
│   ├── DataSeeder.gs       500-record sample dataset (seedStoreData_)
│   ├── Code.gs             doGet entry point
│   └── Index.html          frontend (client DSA classes + POS UI)
├── tests/              test matrix + pass/fail log
├── data/               exported sample datasets
├── docs/               deliverable drafts
└── _archive/           previous version (delete after verified deployment)
```

## First-Time Setup

> **Status: already deployed and verified (2026-10-21).**
> The live project is bound to the "Smart Sari Sari Store" spreadsheet
> (script ID `1BASskaeTUEGbtrg5j7kJCpyyax_sN3JxwrhLA1yP7pYISUj7nu8yee2_`)
> and the suite passes **23/23**. Steps below are for a *fresh* rebuild or a
> second environment (e.g. the professor's demo account).

1. **Create the project**
   - Go to your Google Sheet → **Extensions → Apps Script** (this binds the
     project to the spreadsheet automatically — required, since the code
     calls `SpreadsheetApp.getActiveSpreadsheet()`).
   - **Runtime:** nothing to enable — every current Apps Script project uses
     the **V8 runtime** automatically. (The old "Use the V8 runtime" checkbox
     only existed in the legacy editor and has been removed.)

2. **Get the files in — use `clasp`, do NOT paste**

   Pasting into the editor corrupted UTF-8 on this project (emoji and `₱`
   became mojibake — see `tests/Unit_Tests.md` → Notes). The reliable way:

   ```powershell
   npm.cmd install -g @google/clasp      # npm.ps1 is blocked by policy
   clasp login                           # authorize in the browser
   # enable https://script.google.com/home/usersettings  (Apps Script API) once

   cd "Desktop\SmartSari Sari Store"
   clasp push -f                         # uses .clasp.json + appscript/appsscript.json
   clasp redeploy <deploymentId> -d "msg"
   ```

   `.clasp.json` in the repo already points at `appscript/` and the correct
   script ID, so `clasp push -f` syncs all 14 files plus the manifest.

   *(Manual fallback: for each file in `appscript/`, **＋ → Script**, name it
   exactly like the file — e.g. `DSA_HashTable`, not `DSA_HashTable.gs` — and
   paste contents; for the frontend **＋ → HTML**, name it `Index`. Verify the
   emoji render correctly afterwards.)*


3. **Initialize the database**
   - In the editor’s function dropdown pick `initializeDatabase` → **Run**
     (authorize on first run). Creates all 12 sheets, seeds settings + 12 starter products.

4. **Seed realistic data (demo/benchmarks)**
   - Pick `seedStoreData_` → **Run** → generates ~500 transactions (~4,500 rows)
     with cash ledger, utang, payments, expenses, GCash — all internally consistent.
   - Export a copy of the spreadsheet to `data/` for submission.

5. **Deploy the web app**
   - **Deploy → New deployment → Web app**
   - Execute as: *Me* · Who has access: *Anyone* (or *Anyone with Google account*)
   - Open the `/exec` URL (use “New URL” after every code change).

6. **Turn on email alerts**
   - In the app: **Tindahan → Low-Stock Email Alert** → enter email →
     *I-save* then *Buksan ang Alerts* (creates a daily 7:00 AM trigger).
   - Or from the editor: `setupLowStockTrigger()`.

7. **Run the unit tests**
   - In the app: **Tutorials → Run DSA Tests**, or in the editor: `runDsaUnitTests()`.
   - Expected: **23/23 pass**. Record results in `tests/Unit_Tests.md`.

## Public API (unchanged global function names)

`getStoreData` · `processTransaction` · `saveCashEntry` · `recordUtangPayment` ·
`saveExpense` · `recordGCashTxn` · `updateStartingFloat` · `closeDailyRemittance` ·
`updateStoreProfile` · `addInventoryProduct` · `verifyAuthCode` ·
`getSalesReport` · `checkLowStockAlerts` · `setupLowStockTrigger` ·
`removeLowStockTrigger` · `setAlertEmail` · `runDsaUnitTests` · `seedStoreData_`

> `google.script.run` can only call global functions, so every public function is a
> one-line wrapper delegating to a class method (server stays 100% OOP).

## DSA Inventory (proposal Section 4)

| # | Component | Wired Into | Complexity (time / space) |
|---|-----------|-----------|---------------------------|
| 1 | CustomHashTable (chaining + resize) | stock validation, report lookups | O(1) avg, O(n) worst / O(n) |
| 2 | CustomQueue (FIFO) | checkout write buffer, ordered retry | O(1) amortized / O(n) |
| 3 | CustomMinHeap (priority queue) | low-stock email ranking, Restock Priority panel | O(log n) insert/extract / O(n) |
| 4 | MergeSort (stable) | reports, POS sorting, index building | O(n log n) / O(n) |
| 5 | BinarySearch (+ lowerBound) | POS product search (prefix) | O(log n) / O(1) |

Every method carries Big-O time **and** space comments. Client keeps its own
adapted copies (MergeSort, BinarySearch, CustomMinHeap) inside `Index.html`
because the HTML sandbox cannot see `.gs` classes.

## Known Deferred Items (Week 3)

- Home-screen cash summary double-count + cost-based tubo display
- Product edit/delete + reorder-level editing
- Void Last Sale + Orders history screen
- Batched writes everywhere, ID collision hardening, locks on all writes
- 500-record benchmarks (MergeSort/BinarySearch/heap timing table)
- Responsive desktop pass + full PWA-lite metas/icons
- Client suite (7 assertions) run in demo/offline mode — still unchecked in
  `tests/Unit_Tests.md`
- README/docs final drafts → Week 4 (video, slides, declaration w/ AI disclosure)

## Deployment Log

| Version | Date | Contents |
|---------|------|----------|
| v1 | 2026-10-21 08:55 | First web-app deployment (anyone / execute as me) |
| v2 | 2026-10-21 09:30 | Pre-fix snapshot (characters still mojibake) |
| v3 | 2026-10-21 18:45 | UTF-8 fix via `clasp push` — emoji/₱ restored |
| v4 | 2026-10-21 | Bug fixes B1–B4 + V8 comment correction |
| v5 | 2026-10-21 | Week 2 close-out; suite verified **23/23** |

Live URL: `https://script.google.com/macros/s/AKfycbyuDl2VZGFzNv2Ehc9mAJrJDTmJE-G5W-lT0ZGXumocST205Mw-5kv95Hyh_QLEabZH0Q/exec`
