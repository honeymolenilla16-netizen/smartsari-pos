/**
 * DSA COMPONENT #1 - CustomHashTable (student-implemented)
 * ---------------------------------------------------------
 * Purpose: high-speed product retrieval by unique Product ID.
 * Used by: TransactionService stock validation, ReportService
 *          cost lookups (proposal Section 4).
 *
 * Technique : separate chaining (array of bucket arrays)
 * Complexity: put / get / remove / has
 *             Average O(1) | Worst O(n) when every key lands
 *             in one bucket (mitigated by auto-resize)
 *             resize() O(n) - rehash every entry
 * Space     : O(n + b) where n = entries, b = buckets
 */
class CustomHashTable {

  /**
   * @param {number} initialBuckets - power of two keeps hashes even.
   */
  constructor(initialBuckets = 32) {
    this.buckets = new Array(Math.max(4, initialBuckets)).fill(null).map(() => []);
    this.size = 0;
    this.loadFactorLimit = 0.75; // resize threshold
  }

  /**
   * Polynomial rolling hash (base 31) folded to a bucket index.
   * Time O(length of key) - keys are short product codes.
   * @param {string} key
   * @returns {number} bucket index
   */
  _hash(key) {
    const s = String(key);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h * 31) + s.charCodeAt(i)) >>> 0; // force non-negative
    }
    return h % this.buckets.length;
  }

  /**
   * Insert or overwrite a key/value pair.
   * Time Average O(1) | Worst O(n) | amortized with resize O(1)
   * Space O(1) extra
   * @param {string} key
   * @param {*} value
   * @returns {CustomHashTable} this (chainable)
   */
  put(key, value) {
    const idx = this._hash(key);
    const bucket = this.buckets[idx];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {   // update existing entry
        bucket[i].value = value;
        return this;
      }
    }
    bucket.push({ key, value });      // new entry appended to chain
    this.size++;
    if (this.size / this.buckets.length > this.loadFactorLimit) {
      this._resize();                 // keep chains short => stays O(1)
    }
    return this;
  }

  /**
   * Retrieve a value, or null if absent.
   * Time Average O(1) | Worst O(n)
   * Space O(1)
   * @param {string} key
   */
  get(key) {
    const bucket = this.buckets[this._hash(key)];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) return bucket[i].value;
    }
    return null;
  }

  /** @returns {boolean} whether key exists. Time O(1) avg / O(n) worst. */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Remove a key.
   * Time Average O(1) | Worst O(n)
   * @param {string} key
   * @returns {boolean} true if something was removed
   */
  remove(key) {
    const bucket = this.buckets[this._hash(key)];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }
    return false;
  }

  /** @returns {Array<string>} all keys. Time O(n + b). */
  keys() {
    const out = [];
    for (const bucket of this.buckets) {
      for (const entry of bucket) out.push(entry.key);
    }
    return out;
  }

  /**
   * Grow the bucket array to the next power of two and rehash.
   * Time O(n) | Space O(new buckets)
   */
  _resize() {
    const old = this.buckets;
    this.buckets = new Array(this.buckets.length * 2).fill(null).map(() => []);
    this.size = 0;
    for (const bucket of old) {
      for (const entry of bucket) {
        this.put(entry.key, entry.value); // re-buckets, no recursion (size resets below threshold)
      }
    }
  }
}
