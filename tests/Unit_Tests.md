# SMARTSARI — DSA Unit Test Matrix & Pass/Fail Log

Test runner: `runDsaUnitTests()` (Apps Script editor) or **Tutorials → Run DSA Tests** in the app.
Expected total: **22 server assertions** + **8 client assertions** (demo mode).

**Instructions:** run the suite, then fill the Log column with ✅ / ❌ per row.
Any ❌ → note the observed vs. expected value in the Notes section and fix before Week 3.

---

## Server Suite (`appscript/DsaTests.gs`)

### DSA #1 — CustomHashTable (5 tests)
| # | Test name | Expected | Log |
|---|-----------|----------|-----|
| 1 | put() then get() returns the value | value with `qty: 30` returned | ☐ |
| 2 | put() on existing key overwrites (no dup) | `qty: 25`, size stays 1 | ☐ |
| 3 | get() on missing key returns null | `null` | ☐ |
| 4 | 20 colliding keys survive auto-resize | all 20 found, buckets > 8 | ☐ |
| 5 | remove() deletes key and shrinks size | `get` null, `has` false | ☐ |

### DSA #2 — CustomQueue (4 tests)
| # | Test name | Expected | Log |
|---|-----------|----------|-----|
| 6 | dequeue() returns items strictly FIFO | stage-1, stage-2, stage-3 | ☐ |
| 7 | dequeue() on empty queue returns null | `null` + `isEmpty()` true | ☐ |
| 8 | peek() shows front without removing | front unchanged, size 1 | ☐ |
| 9 | 100 items drain in exact order | 0…99 in order, ends empty | ☐ |

### DSA #3 — CustomMinHeap (5 tests)
| # | Test name | Expected | Log |
|---|-----------|----------|-----|
| 10 | extractMin() yields ascending order | 1,2,4,7,8,9 | ☐ |
| 11 | parent <= children invariant holds | heap property valid | ☐ |
| 12 | build() root is the true minimum | peek = 5 | ☐ |
| 13 | custom comparator extracts most urgent first | B then C | ☐ |
| 14 | duplicate keys extract correctly | 1, 4 then 2 remain | ☐ |

### Algorithm #1 — MergeSort (4 tests)
| # | Test name | Expected | Log |
|---|-----------|----------|-----|
| 15 | sorts numbers ascending | `[0,1,2,3,4,5,8]` | ☐ |
| 16 | does not mutate the input array | input unchanged | ☐ |
| 17 | stable sort keeps equal-key order (s1 before s3) | s2,s4,s1,s3 | ☐ |
| 18 | descending comparator works | `[9,2,1]` | ☐ |

### Algorithm #2 — BinarySearch (4 tests)
| # | Test name | Expected | Log |
|---|-----------|----------|-----|
| 19 | findIndex() locates a middle key | index 2 | ☐ |
| 20 | findIndex() returns -1 for missing key | `-1` | ☐ |
| 21 | lowerBound() finds prefix start (CND → index 2) | index 2 | ☐ |
| 22 | search on empty array is safe | `-1` / `0` | ☐ |
| 23 | finds first and last boundary keys | 0 and 6 | ☐ |

> Note: labels 1–23 above; the runner reports the actual count (`passed/total`).
> If the runner total differs from this table, update the table to match the runner output.

## Client Suite (`Index.html` → `runClientSideDsaTests`, demo/offline mode only)
| # | Test | Expected | Log |
|---|------|----------|-----|
| C1 | MergeSort sorts numbers ascending | `[1,2,4,5]` | ☐ |
| C2 | MergeSort stable on equal keys | b, a, c order kept | ☐ |
| C3 | BinarySearch finds exact key | index 2 | ☐ |
| C4 | BinarySearch missing key returns -1 | `-1` | ☐ |
| C5 | BinarySearch lowerBound finds prefix start | index 1 | ☐ |
| C6 | CustomMinHeap extracts most urgent first | y then z | ☐ |
| C7 | CustomMinHeap numeric ascending | 1, 2, 3 | ☐ |

## Result Log Template

| Run date | Environment | Passed / Total | Tester | Notes |
|----------|-------------|----------------|--------|-------|
|          | Apps Script editor |   / 22 |  |  |
|          | Tutorials UI panel |   / 22 |  |  |
|          | Client demo mode  |   / 7  |  |  |

## Notes (failed runs)
<!-- e.g. "Test 4 failed after resize: buckets stayed 8 — _resize not called at load factor X" -->
