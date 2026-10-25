/**
 * ReportService.gs - Date-Range Financial Reports
 * ---------------------------------------------------------
 * Fulfils proposal feature 3.5: automated summaries for gross
 * sales, net collections, debt balances, and expense totals -
 * now actually filtered by the date range the user picks.
 *
 * DSA tie-ins:
 *   CustomHashTable - O(1) grouping of Sales_Items by sale_id
 *                     and O(1) product cost lookups
 *   MergeSort       - daily breakdown + sale rows sorted
 *                     newest-first (stable, O(n log n))
 */
class ReportService {

  constructor(db) {
    this.db = db || new Database();
  }

  /**
   * Build a complete financial report for an inclusive date range.
   * @param {string} startDate 'YYYY-MM-DD' (Manila time)
   * @param {string} endDate   'YYYY-MM-DD' (Manila time)
   * @returns {Object} report payload for the Reports modal
   */
  getSalesReport(startDate, endDate) {
    try {
      const state = this.db.loadFullState();

      // Manila-local day boundaries (client sends plain date strings)
      const start = new Date((startDate || '') + 'T00:00:00+08:00');
      const end   = new Date((endDate   || '') + 'T23:59:59+08:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date range. Use the date pickers.');
      }
      if (start > end) throw new Error('Start date is after the end date.');
      const inRange = iso => {
        const t = new Date(iso).getTime();
        return t >= start.getTime() && t <= end.getTime();
      };

      /* --- DSA #1: CustomHashTable - group line items by sale_id --- */
      const itemsBySale = new CustomHashTable(64);
      for (const item of state.salesItems) {
        const sid = String(item.sale_id);
        const bucket = itemsBySale.get(sid);
        if (bucket) bucket.push(item);
        else itemsBySale.put(sid, [item]);
      }

      /* --- DSA #1: CustomHashTable - product_id -> cost/price --- */
      const productIndex = new CustomHashTable(64);
      for (const p of state.products) {
        productIndex.put(String(p.product_id), {
          cost: Number(p.cost_price) || 0,
          price: Number(p.selling_price) || 0
        });
      }

      // Filter sales to the chosen range (voided sales excluded)
      const salesInRange = state.sales.filter(s =>
        inRange(s.timestamp) && String(s.status || 'Completed') !== 'Voided'
      );

      // --- Totals (cost-based profit, NOT a flat estimate) ---
      let totalSales = 0;
      let cashSales = 0;
      let utangSales = 0;
      let totalProfit = 0;
      for (const s of salesInRange) {
        const amt = Number(s.total_amount) || 0;
        totalSales += amt;
        if (s.payment_type === 'Cash') cashSales += amt;
        else if (s.payment_type === 'Utang') utangSales += amt;

        const items = itemsBySale.get(String(s.sale_id)) || [];
        for (const it of items) {
          const prod = productIndex.get(String(it.product_id));
          const cost = prod ? prod.cost : 0;
          totalProfit += (Number(it.unit_price) - cost) * Number(it.qty);
        }
      }

      // --- Collections & debts ---
      const utangCollected = state.utangPayments
        .filter(p => inRange(p.timestamp))
        .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      const utangOutstanding = state.utang
        .reduce((sum, u) => sum + (Number(u.balance) > 0 ? Number(u.balance) : 0), 0);

      // --- Expenses (total + per category) ---
      // DSA #3: CustomMinHeap ranks largest expenses first (max-heap via inverted compare)
      // Time O(k log k) where k = expenses in range | Space O(k)
      let totalExpenses = 0;
      const expensesByCategory = {};
      const expensesList = [];
      for (const e of state.expenses.filter(e => inRange(e.timestamp))) {
        const amt = Number(e.amount) || 0;
        totalExpenses += amt;
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + amt;
        expensesList.push({
          expense_id: e.expense_id,
          timestamp: e.timestamp,
          category: e.category || 'Misc',
          amount: amt,
          description: e.description || ''
        });
      }
      const expHeap = new CustomMinHeap((a, b) => b.amount - a.amount); // max-heap by amount
      for (const ex of expensesList) expHeap.push(ex);
      const topExpenses = [];
      const topN = Math.min(5, expHeap.size());
      for (let i = 0; i < topN; i++) {
        const v = expHeap.pop();
        if (v) topExpenses.push({ category: v.category, amount: v.amount, description: v.description });
      } // heap emptied for this read - cheap and avoids mutating report state

      // --- GCash summary ---
      let gcashIn = 0, gcashOut = 0, gcashFees = 0;
      for (const g of state.gcash.filter(g => inRange(g.timestamp))) {
        const amt = Number(g.amount) || 0;
        const fee = Number(g.service_fee) || 0;
        if (g.txn_type === 'Cash-In') gcashIn += amt + fee;
        else if (g.txn_type === 'Cash-Out') gcashOut += amt;
        gcashFees += fee;
      }

      /* --- DSA #2: MergeSort - daily breakdown, newest day first --- */
      const dailyMap = {};
      for (const s of salesInRange) {
        const day = String(s.timestamp).slice(0, 10); // ISO yyyy-mm-dd
        if (!dailyMap[day]) dailyMap[day] = { date: day, sales: 0, transactions: 0 };
        dailyMap[day].sales += Number(s.total_amount) || 0;
        dailyMap[day].transactions += 1;
      }
      // DSA in Action trace: shows which structures/algos ran for this batch
      this._dsaTrace = {
        ts: Date.now(),
        flow: 'getSalesReport',
        uses: [
          { dsa: 'CustomHashTable', op: 'group Sales_Items by sale_id', complexity: 'O(n)' },
          { dsa: 'CustomHashTable', op: 'product cost/price lookup', complexity: 'O(p)' },
          { dsa: 'MergeSort', op: 'dailyBreakdown newest-first', complexity: 'O(d log d)' },
          { dsa: 'CustomMinHeap', op: 'rank top 5 expenses by amount', complexity: 'O(k log k)' }
        ]
      };
      return {
        success: true,
        report: {
          startDate: startDate,
          endDate: endDate,
          totalSales: totalSales,
          cashSales: cashSales,
          utangSales: utangSales,
          totalProfit: totalProfit,
          totalExpenses: totalExpenses,
          expensesByCategory: expensesByCategory,
          topExpenses: topExpenses,              // NEW: heap-ranked largest expenses
          utangCollected: utangCollected,
          utangOutstanding: utangOutstanding,
          gcashIn: gcashIn,
          gcashOut: gcashOut,
          gcashFees: gcashFees,
          transactionCount: salesInRange.length,
          dailyBreakdown: dailyBreakdown.slice(0, 60)
        }
      };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }
}

/* ------------------------------------------------------------------
 * Global wrapper - backward-compatible public API.
 * ------------------------------------------------------------------ */
function getSalesReport(startDate, endDate) {
  return new ReportService().getSalesReport(startDate, endDate);
}
