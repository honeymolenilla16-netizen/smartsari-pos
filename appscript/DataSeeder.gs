/**
 * DataSeeder.gs - Realistic Sample Dataset Generator
 * ---------------------------------------------------------
 * The guidelines require a benchmark/demo dataset of
 * 500-1,000+ records. seedStoreData_(500) fills every tab
 * with Filipino sari-sari store data using a deterministic
 * pseudo-random generator (same seed => same dataset, which
 * keeps benchmarks comparable between runs).
 *
 * Run once from the Apps Script editor:
 *   1. Select seedStoreData_ in the function dropdown
 *   2. Run (authorize on first execution)
 *   3. Export a copy from the spreadsheet for /data submission
 */
class DataSeeder {

  constructor(db) {
    this.db = db || new Database();
    this.rngState = 20261021; // fixed seed => reproducible dataset
  }

  /** Deterministic LCG - returns 0 (inclusive) to 1 (exclusive). */
  next_() {
    this.rngState = (this.rngState * 1103515245 + 12345) % 2147483648;
    return this.rngState / 2147483648;
  }

  /** Random integer in [min, max]. */
  int_(min, max) {
    return min + Math.floor(this.next_() * (max - min + 1));
  }

  /** Random element of an array. */
  pick_(arr) {
    return arr[this.int_(0, arr.length - 1)];
  }

  /**
   * Fill all tabs with `targetSales` synthetic transactions.
   * Consistency guarantees:
   *  - stock_qty decreases with each sale (floors at 0)
   *  - every Cash sale adds a Cash_Ledger Inflow
   *  - Utang sales add a ledger row + realistic partial payments
   *  - expenses and GCash logs produce matching cash movements
   * @param {number} targetSales - transaction count (500 recommended)
   */
  seed(targetSales) {
    const N = Number(targetSales) || 500;
    this.db.ensureInitialized();

    const prodSheet = this.db.getSheet(SHEET_NAMES.PRODUCTS);
    const products = prodSheet.getLastRow() > 1
      ? prodSheet.getRange(2, 1, prodSheet.getLastRow() - 1, 9).getValues()
      : [];
    if (products.length === 0) throw new Error('No products to seed against.');

    const now = new Date();
    const DAYS_BACK = 60;
    const customers = [
      'Aling Rosa', 'Mang Pedro', 'Aling Nena', 'Kuya Boy', 'Suki Maria',
      'Tita Lita', 'Mang Jun', 'Aling Susing', 'Kap. Delfin', 'Ate Baby',
      'Mang Ising', 'Aling Pacing', 'Kuya Dodong', 'Nanay Cora', 'Tito Mando'
    ];
    const expenseCats = ['Kuryente', 'Tubig', 'Upa', 'Plastik', 'Iba pa'];

    // ---- Pre-build rows per tab, then append in bulk ----
    const salesRows = [], itemsRows = [], cashRows = [], utangRows = [],
          payRows = [], gcashRows = [], expRows = [];

    // Live stock levels so deductions stay realistic
    const stock = products.map(r => Number(r[5]) || 0);

    for (let i = 0; i < N; i++) {
      const daysAgo = this.int_(0, DAYS_BACK - 1);
      const ts = new Date(now.getTime() - daysAgo * 86400000
                          - this.int_(0, 23) * 3600000
                          - this.int_(0, 59) * 60000);
      const stamp = Utilities.formatDate(ts, TIME_ZONE, 'yyyyMMdd-HHmmss');
      const saleId = 'SALE-' + stamp + '-' + this.int_(100, 999);

      // 1-4 line items per sale
      const lineCount = this.int_(1, 4);
      const used = new Set();
      let total = 0;
      const lines = [];
      for (let k = 0; k < lineCount; k++) {
        const p = this.int_(0, products.length - 1);
        if (used.has(p) || stock[p] <= 0) continue;
        used.add(p);
        const qty = Math.min(this.int_(1, 3), stock[p]);
        stock[p] -= qty;
        const price = Number(products[p][4]) || 0;
        total += price * qty;
        lines.push([saleId, products[p][0], products[p][1], qty, price, price * qty]);
        // keep the Products tab stock in sync
        prodSheet.getRange(p + 2, PRODUCT_COL.QTY).setValue(stock[p]);
      }
      if (lines.length === 0) continue;
      total = Math.round(total * 100) / 100;

      // ~25% of sales are utang
      const isUtang = this.next_() < 0.25;
      const cust = this.pick_(customers);
      const payType = isUtang ? 'Utang' : 'Cash';
      salesRows.push([saleId, ts, total, isUtang ? 0 : total, 0, payType, cust, 'Completed']);
      itemsRows.push(...lines);

      if (!isUtang) {
        cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Inflow', total, 'Sale ID: ' + saleId]);
      } else {
        const utangId = 'UTANG-' + stamp + '-' + this.int_(100, 999);
        const paidInFull = this.next_() < 0.4;
        const paySoFar = paidInFull ? total : Math.round(total * (this.next_() * 0.6) * 100) / 100;
        const balance = Math.round((total - paySoFar) * 100) / 100;
        utangRows.push([utangId, ts, cust, '09' + this.int_(10, 99) + this.int_(1000000, 9999999),
                        total, balance, ts, balance === 0 ? 'Paid' : (paySoFar > 0 ? 'Partial' : 'Unpaid')]);
        if (paySoFar > 0) {
          payRows.push(['PAY-' + stamp + '-' + this.int_(100, 999), utangId, ts, paySoFar, cust, 'Seeded Payment']);
          cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Inflow', paySoFar, 'Utang Payment from ' + cust]);
        }
      }
    }

    // ---- Expenses (~1 per 4 sales) ----
    const expCount = Math.floor(N / 4);
    for (let i = 0; i < expCount; i++) {
      const ts = new Date(now.getTime() - this.int_(0, DAYS_BACK - 1) * 86400000);
      const stamp = Utilities.formatDate(ts, TIME_ZONE, 'yyyyMMdd-HHmmss');
      const cat = this.pick_(expenseCats);
      const amt = this.int_(20, 600);
      expRows.push(['EXP-' + stamp + '-' + this.int_(100, 999), ts, cat, amt, 'Seeded ' + cat]);
      cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Outflow', amt, 'Expense: ' + cat]);
    }

    // ---- GCash transactions (~1 per 8 sales) ----
    const gcCount = Math.floor(N / 8);
    for (let i = 0; i < gcCount; i++) {
      const ts = new Date(now.getTime() - this.int_(0, DAYS_BACK - 1) * 86400000);
      const stamp = Utilities.formatDate(ts, TIME_ZONE, 'yyyyMMdd-HHmmss');
      const isIn = this.next_() < 0.6;
      const amt = this.int_(50, 2000);
      const fee = this.int_(5, 25);
      const cust = this.pick_(customers);
      gcashRows.push(['GCASH-' + stamp + '-' + this.int_(100, 999), ts,
                      isIn ? 'Cash-In' : 'Cash-Out', amt, fee, 'REF' + this.int_(100000, 999999), cust, fee]);
      if (isIn) {
        cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Inflow', amt + fee, 'GCash Cash-In + Fee']);
      } else {
        cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Outflow', amt, 'GCash Cash-Out Released']);
        if (fee > 0) {
          cashRows.push(['CASH-' + stamp + '-' + this.int_(100, 999), ts, 'Inflow', fee, 'GCash Service Fee']);
        }
      }
    }

    // ---- Bulk append everything ----
    this.db.appendMany(SHEET_NAMES.SALES, salesRows);
    this.db.appendMany(SHEET_NAMES.SALES_ITEMS, itemsRows);
    this.db.appendMany(SHEET_NAMES.CASH_LEDGER, cashRows);
    this.db.appendMany(SHEET_NAMES.UTANG, utangRows);
    this.db.appendMany(SHEET_NAMES.UTANG_PAYMENTS, payRows);
    this.db.appendMany(SHEET_NAMES.GCASH, gcashRows);
    this.db.appendMany(SHEET_NAMES.EXPENSES, expRows);

    return {
      sales: salesRows.length,
      saleItems: itemsRows.length,
      cashEntries: cashRows.length,
      utang: utangRows.length,
      utangPayments: payRows.length,
      gcash: gcashRows.length,
      expenses: expRows.length,
      totalRecords: salesRows.length + itemsRows.length + cashRows.length +
                    utangRows.length + payRows.length + gcashRows.length + expRows.length
    };
  }
}

/* ------------------------------------------------------------------
 * Global entry point - run from the Apps Script editor only.
 * ------------------------------------------------------------------ */
function seedStoreData_() {
  const summary = new DataSeeder().seed(500);
  Logger.log('SMARTSARI seeded: %s total records', summary.totalRecords);
  Logger.log(JSON.stringify(summary));
  return summary;
}
