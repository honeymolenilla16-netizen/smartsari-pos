/**
 * ALGORITHM #1 - Merge Sort (student-implemented, stable)
 * ---------------------------------------------------------
 * Purpose: multi-field sorting for catalog items, sales rows,
 *          and financial report records (proposal Section 4).
 * Used by: ReportService (daily breakdown + sale rows),
 *          Index.html sort dropdown + search index building.
 *
 * Technique : top-down divide-and-conquer with stable merge
 * Complexity: Best / Average / Worst all O(n log n)
 *             (guaranteed - unlike quicksort's O(n^2) worst case)
 * Space     : O(n) auxiliary merge buffer
 * Stability : EQUAL keys keep their original relative order -
 *             critical when sorting by one field then another.
 */
class MergeSort {

  /**
   * Sort a copy of the array. Original is never mutated.
   * Time O(n log n) | Space O(n)
   * @param {Array<*>} items
   * @param {function(*,*):number} comparator <0 when a before b
   * @returns {Array<*>} new sorted array
   */
  static sort(items, comparator) {
    const cmp = comparator || ((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    if (!items || items.length <= 1) return (items || []).slice();

    // --- DIVIDE ---
    const mid = items.length >> 1;
    const left = MergeSort.sort(items.slice(0, mid), cmp);
    const right = MergeSort.sort(items.slice(mid), cmp);

    // --- CONQUER (stable merge: takes from LEFT on ties) ---
    const out = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (cmp(right[j], left[i]) < 0) {
        out.push(right[j++]);      // right is strictly smaller -> take right
      } else {
        out.push(left[i++]);       // tie or left smaller -> take LEFT FIRST (stability)
      }
    }
    while (i < left.length) out.push(left[i++]);
    while (j < right.length) out.push(right[j++]);
    return out;
  }

  /**
   * Build a comparator from an ordered field list.
   * Example: byFields([{field:'stock_qty'}, {field:'name', desc:true}])
   * Time O(k) per comparison (k = number of fields) | Space O(1)
   * @param {Array<{field:string, desc?:boolean}>} fields
   * @returns {function(*,*):number}
   */
  static byFields(fields) {
    return (a, b) => {
      for (const f of fields) {
        let av = a[f.field], bv = b[f.field];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        let c = 0;
        if (av < bv) c = -1;
        else if (av > bv) c = 1;
        if (c !== 0) return f.desc ? -c : c;
      }
      return 0;
    };
  }
}

/**
 * ALGORITHM #2 - Binary Search (student-implemented)
 * ---------------------------------------------------------
 * Purpose: logarithmic lookup over the record arrays that
 *          Merge Sort keeps ordered (proposal Section 4).
 * Used by: Index.html POS search (prefix mode over the
 *          sorted product index) - replaces O(n) scanning.
 *
 * Technique : iterative lower-bound search (no recursion)
 * Complexity: O(log n) time - the search space halves every step
 *             O(1) space - only three index variables
 */
class BinarySearch {

  /**
   * Index of the FIRST element whose key equals targetKey.
   * Array MUST already be sorted ascending by keyGetter.
   * Time O(log n) | Space O(1)
   * @param {Array<*>} sortedItems
   * @param {*} targetKey
   * @param {function(*):*} [keyGetter] defaults to identity
   * @returns {number} index, or -1 when not found
   */
  static findIndex(sortedItems, targetKey, keyGetter) {
    const key = keyGetter || (x => x);
    let lo = 0, hi = (sortedItems || []).length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;             // floor((lo+hi)/2)
      const cmp = compareKeys(key(sortedItems[mid]), targetKey);
      if (cmp === 0) { found = mid; hi = mid - 1; } // keep scanning left for FIRST match
      else if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return found;
  }

  /**
   * Lower-bound index: first position where key >= targetKey.
   * Powers prefix search: scan forward only while items still
   * start with the query => O(log n + k) instead of O(n).
   * Time O(log n) | Space O(1)
   * @param {Array<*>} sortedItems
   * @param {*} targetKey
   * @param {function(*):*} [keyGetter]
   * @returns {number} insertion index (in [0, length])
   */
  static lowerBound(sortedItems, targetKey, keyGetter) {
    const key = keyGetter || (x => x);
    let lo = 0, hi = (sortedItems || []).length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareKeys(key(sortedItems[mid]), targetKey) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Natural ordering for strings (case-insensitive) and numbers. */
  static compare(a, b) {
    return compareKeys(a, b);
  }
}

/** Shared natural-order comparator (string case-insensitive / numeric). */
function compareKeys(a, b) {
  if (typeof a === 'string' || typeof b === 'string') {
    const as = String(a).toLowerCase();
    const bs = String(b).toLowerCase();
    return as < bs ? -1 : as > bs ? 1 : 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
