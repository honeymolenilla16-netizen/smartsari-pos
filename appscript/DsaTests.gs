/**
 * DsaTests.gs - Self-Contained Unit Test Runner
 * ---------------------------------------------------------
 * The guidelines require "3-5 unit tests for each structure"
 * covering critical paths. GAS has no native test framework,
 * so this runner executes every assertion and returns a
 * pass/fail table the Tutorials screen renders live.
 *
 * Run from: Tutorials screen -> "Run DSA Tests" button
 * or the Apps Script editor via runDsaUnitTests().
 */
class DsaTestRunner {

  constructor() {
    this.results = [];
    this.passed = 0;
    this.total = 0;
  }

  /**
   * Execute every suite.
   * @returns {Object} {success, passed, total, results:[{suite, name, pass, detail}]}
   */
  run() {
    this.results = [];
    this.testHashTable();
    this.testQueue();
    this.testMinHeap();
    this.testMergeSort();
    this.testBinarySearch();
    return {
      success: true,
      passed: this.passed,
      total: this.total,
      results: this.results
    };
  }

  /** Record one assertion outcome. */
  assert_(suite, name, condition, detail) {
    this.total++;
    const pass = !!condition;
    if (pass) this.passed++;
    this.results.push({
      suite: suite,
      name: name,
      pass: pass,
      detail: detail === undefined ? '' : String(detail)
    });
  }

  /* ---------------- DSA #1: CustomHashTable ---------------- */
  testHashTable() {
    const S = 'CustomHashTable';
    const t = new CustomHashTable(8);

    // 1. basic put + get
    t.put('BIS-001', { qty: 30 });
    this.assert_(S, 'put() then get() returns the value',
      t.get('BIS-001') && t.get('BIS-001').qty === 30);

    // 2. overwrite existing key
    t.put('BIS-001', { qty: 25 });
    this.assert_(S, 'put() on existing key overwrites (no dup)',
      t.get('BIS-001').qty === 25 && t.size === 1);

    // 3. missing key returns null
    this.assert_(S, 'get() on missing key returns null',
      t.get('XXX-999') === null);

    // 4. collision + auto-resize: 20 keys into an 8-bucket table
    for (let i = 0; i < 20; i++) t.put('SKU-' + i, i * 10);
    let allFound = true;
    for (let i = 0; i < 20; i++) {
      if (t.get('SKU-' + i) !== i * 10) allFound = false;
    }
    this.assert_(S, '20 colliding keys survive auto-resize',
      allFound && t.buckets.length > 8);

    // 5. remove()
    t.remove('SKU-5');
    this.assert_(S, 'remove() deletes key and shrinks size',
      t.get('SKU-5') === null && !t.has('SKU-5'));
  }

  /* ---------------- DSA #2: CustomQueue ---------------- */
  testQueue() {
    const S = 'CustomQueue';
    const q = new CustomQueue();

    // 1. FIFO ordering
    q.enqueue('stage-1').enqueue('stage-2').enqueue('stage-3');
    this.assert_(S, 'dequeue() returns items strictly FIFO',
      q.dequeue() === 'stage-1' && q.dequeue() === 'stage-2' && q.dequeue() === 'stage-3');

    // 2. empty behavior
    const empty = new CustomQueue();
    this.assert_(S, 'dequeue() on empty queue returns null',
      empty.dequeue() === null && empty.isEmpty());

    // 3. peek does not remove
    const q2 = new CustomQueue();
    q2.enqueue('only');
    this.assert_(S, 'peek() shows front without removing',
      q2.peek() === 'only' && q2.size() === 1);

    // 4. 100-item ordering stress
    const q3 = new CustomQueue();
    for (let i = 0; i < 100; i++) q3.enqueue(i);
    let ordered = true;
    for (let i = 0; i < 100; i++) {
      if (q3.dequeue() !== i) ordered = false;
    }
    this.assert_(S, '100 items drain in exact order', ordered && q3.isEmpty());
  }

  /* ---------------- DSA #3: CustomMinHeap ---------------- */
  testMinHeap() {
    const S = 'CustomMinHeap';

    // 1. extractMin returns ascending order
    const h = new CustomMinHeap();
    [7, 2, 9, 4, 1, 8].forEach(v => h.insert(v));
    let ascending = true;
    let prev = -Infinity;
    while (!h.isEmpty()) {
      const v = h.extractMin();
      if (v < prev) ascending = false;
      prev = v;
    }
    this.assert_(S, 'extractMin() yields ascending order',
      ascending);

    // 2. heap property: every parent <= its children after inserts
    const h2 = new CustomMinHeap();
    [15, 3, 8, 1, 12, 6, 9].forEach(v => h2.insert(v));
    let heapOk = true;
    for (let i = 0; 2 * i + 1 < h2.size(); i++) {
      const left = h2._items[2 * i + 1];
      const right = h2._items[2 * i + 2];
      if (h2._items[i] > left) heapOk = false;
      if (right !== undefined && h2._items[i] > right) heapOk = false;
    }
    this.assert_(S, 'parent <= children invariant holds', heapOk);

    // 3. build() heapifies in O(n)
    const h3 = new CustomMinHeap().build([30, 12, 25, 5, 9, 18]);
    this.assert_(S, 'build() root is the true minimum',
      h3.peek() === 5);

    // 4. object comparator: lowest urgency extracted first
    const urg = new CustomMinHeap((a, b) => a.urgency - b.urgency);
    urg.insert({ name: 'A', urgency: 0.8 });
    urg.insert({ name: 'B', urgency: 0.1 });
    urg.insert({ name: 'C', urgency: 0.5 });
    this.assert_(S, 'custom comparator extracts most urgent first',
      urg.extractMin().name === 'B' && urg.extractMin().name === 'C');

    // 5. duplicates handled
    const h4 = new CustomMinHeap();
    [4, 4, 4, 1].forEach(v => h4.insert(v));
    this.assert_(S, 'duplicate keys extract correctly',
      h4.extractMin() === 1 && h4.extractMin() === 4 && h4.size() === 2);
  }

  /* ---------------- Algorithm #1: MergeSort ---------------- */
  testMergeSort() {
    const S = 'MergeSort';

    // 1. numeric sorting
    const sorted = MergeSort.sort([5, 1, 4, 2, 8, 0, 3]);
    this.assert_(S, 'sorts numbers ascending',
      JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4, 5, 8]));

    // 2. original array is never mutated
    const original = [3, 1, 2];
    MergeSort.sort(original);
    this.assert_(S, 'does not mutate the input array',
      JSON.stringify(original) === JSON.stringify([3, 1, 2]));

    // 3. STABILITY: equal keys keep original order
    const rows = [
      { id: 's1', total: 100 }, { id: 's2', total: 50 },
      { id: 's3', total: 100 }, { id: 's4', total: 50 }
    ];
    const stable = MergeSort.sort(rows, MergeSort.byFields([{ field: 'total' }]));
    this.assert_(S, 'stable sort keeps equal-key order (s1 before s3)',
      stable[0].id === 's2' && stable[1].id === 's4' &&
      stable[2].id === 's1' && stable[3].id === 's3');

    // 4. descending comparator
    const desc = MergeSort.sort([2, 9, 1], (a, b) => b - a);
    this.assert_(S, 'descending comparator works',
      JSON.stringify(desc) === JSON.stringify([9, 2, 1]));
  }

  /* ---------------- Algorithm #2: BinarySearch ---------------- */
  testBinarySearch() {
    const S = 'BinarySearch';
    const arr = [
      { code: 'BEV-001' }, { code: 'BIS-001' }, { code: 'CND-001' },
      { code: 'CND-002' }, { code: 'CIG-001' }, { code: 'RCE-001' }, { code: 'SNK-001' }
    ];
    const keyOf = x => x.code;

    // 1. finds middle element
    this.assert_(S, 'findIndex() locates a middle key',
      BinarySearch.findIndex(arr, 'CND-001', keyOf) === 2);

    // 2. missing key -> -1
    this.assert_(S, 'findIndex() returns -1 for missing key',
      BinarySearch.findIndex(arr, 'XXX-999', keyOf) === -1);

    // 3. lowerBound insertion point
    this.assert_(S, 'lowerBound() finds prefix start (CND -> index 2)',
      BinarySearch.lowerBound(arr, 'CND', keyOf) === 2);

    // 4. empty array safety
    this.assert_(S, 'search on empty array is safe',
      BinarySearch.findIndex([], 'X') === -1 && BinarySearch.lowerBound([], 'X') === 0);

    // 5. first/last boundary elements
    this.assert_(S, 'finds first and last boundary keys',
      BinarySearch.findIndex(arr, 'BEV-001', keyOf) === 0 &&
      BinarySearch.findIndex(arr, 'SNK-001', keyOf) === 6);
  }
}

/* ------------------------------------------------------------------
 * Global wrapper - callable from the UI and the script editor.
 * ------------------------------------------------------------------ */
function runDsaUnitTests() {
  return new DsaTestRunner().run();
}
