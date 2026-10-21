/**
 * DSA COMPONENT #3 - CustomMinHeap / Priority Queue (student-implemented)
 * ---------------------------------------------------------
 * Purpose: dynamic restocking priority ranking - the most
 *          urgent low-stock item is always at the root
 *          without sorting the whole catalog (proposal Section 4).
 * Used by: AlertService.checkLowStockAlerts() (email ranking)
 *          + client-side Restock Priority panel (Index.html)
 *
 * Technique : implicit binary heap stored in a zero-indexed array
 *             parent(i) = (i-1)/2   children(i) = 2i+1, 2i+2
 * Complexity: insert / extractMin   O(log n)
 *             peek / size           O(1)
 *             build (heapify)       O(n)
 * Space     : O(n)
 */
class CustomMinHeap {

  /**
   * @param {function(*,*):number} [comparator] returns <0 if a
   *        should be extracted before b. Defaults to numeric min.
   */
  constructor(comparator) {
    this._items = [];
    this._compare = comparator || ((a, b) => a - b);
  }

  /** @returns {boolean} true when empty. Time O(1). */
  isEmpty() {
    return this._items.length === 0;
  }

  /** @returns {number} element count. Time O(1). */
  size() {
    return this._items.length;
  }

  /**
   * Insert an item and sift it up to restore the heap property.
   * Time O(log n) | Space O(1)
   * @param {*} item
   * @returns {CustomMinHeap} this (chainable)
   */
  insert(item) {
    this._items.push(item);
    this._siftUp(this._items.length - 1);
    return this;
  }

  /**
   * Remove and return the smallest (most urgent) item.
   * Time O(log n) | Space O(1)
   * @returns {*} item, or null when empty
   */
  extractMin() {
    if (this.isEmpty()) return null;
    const items = this._items;
    const min = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this._siftDown(0);
    }
    return min;
  }

  /**
   * View the smallest item without removing it.
   * Time O(1) | Space O(1)
   * @returns {*} item, or null when empty
   */
  peek() {
    return this.isEmpty() ? null : this._items[0];
  }

  /**
   * Build a heap from an unsorted array in one pass.
   * Time O(n) - faster than n inserts (O(n log n))
   * Space O(n)
   * @param {Array<*>} items
   * @returns {CustomMinHeap} this
   */
  build(items) {
    this._items = items.slice();
    for (let i = (this._items.length >> 1) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
    return this;
  }

  /**
   * Heap-ordered snapshot without mutating (most-urgent first).
   * Time O(n log n) via repeated extract on a clone | Space O(n)
   * @returns {Array<*>}
   */
  toRankedList() {
    const clone = new CustomMinHeap(this._compare);
    clone.build(this._items);
    const out = [];
    while (!clone.isEmpty()) out.push(clone.extractMin());
    return out;
  }

  /** Restore heap property moving toward the root. Time O(log n). */
  _siftUp(i) {
    const items = this._items;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._compare(items[i], items[parent]) < 0) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else break;
    }
  }

  /** Restore heap property moving toward the leaves. Time O(log n). */
  _siftDown(i) {
    const items = this._items;
    const n = items.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this._compare(items[left], items[smallest]) < 0) smallest = left;
      if (right < n && this._compare(items[right], items[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
