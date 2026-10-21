/**
 * DSA COMPONENT #2 - CustomQueue, First-In-First-Out (student-implemented)
 * ---------------------------------------------------------
 * Purpose: sequential checkout transaction buffer - write
 *          operations are processed in the exact order they
 *          were scheduled, so a sale can never be half-saved
 *          out of order (proposal Section 4).
 * Used by: TransactionService._drainWriteQueue()
 *
 * Technique : circular-buffer style head-pointer queue
 * Complexity: enqueue / dequeue / peek  O(1) amortized
 *             size / isEmpty             O(1)
 *             toArray                    O(n)
 * Space     : O(n)
 */
class CustomQueue {

  constructor() {
    this._items = [];  // backing store
    this._head = 0;    // index of next item to dequeue (avoids O(n) shift)
  }

  /**
   * Add an item to the back of the queue.
   * Time O(1) amortized | Space O(1)
   * @param {*} item
   * @returns {CustomQueue} this (chainable)
   */
  enqueue(item) {
    this._items.push(item);
    return this;
  }

  /**
   * Remove and return the front item.
   * Time O(1) amortized | Space O(1)
   * @returns {*} front item, or null when empty
   */
  dequeue() {
    if (this.isEmpty()) return null;
    const item = this._items[this._head];
    this._items[this._head] = null;  // release reference for GC
    this._head++;
    // Compact backing array once half is consumed
    if (this._head > 32 && this._head * 2 > this._items.length) {
      this._items = this._items.slice(this._head);
      this._head = 0;
    }
    return item;
  }

  /**
   * Peek at the front item without removing it.
   * Time O(1) | Space O(1)
   * @returns {*} front item, or null when empty
   */
  peek() {
    return this.isEmpty() ? null : this._items[this._head];
  }

  /** @returns {boolean} true when empty. Time O(1). */
  isEmpty() {
    return this._head >= this._items.length;
  }

  /** @returns {number} number of items. Time O(1). */
  size() {
    return this._items.length - this._head;
  }

  /**
   * Snapshot of items front-to-back (for logging/tests).
   * Time O(n) | Space O(n)
   * @returns {Array<*>}
   */
  toArray() {
    return this._items.slice(this._head).filter(x => x !== null);
  }
}
