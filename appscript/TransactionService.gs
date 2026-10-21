/**
 * TransactionService.gs - Point-of-Sale Checkout Engine
 * ---------------------------------------------------------
 * The sale-critical path of SMARTSARI. Three DSA components
 * are ACTIVE here (not decorative):
 *
 *   CustomHashTable - instant product_id -> row lookup when
 *                    validating stock (no O(n) sheet scan)
 *   CustomQueue    - write-operation buffer: every mutation of
 *                    a sale is enqueued then drained strictly
 *                    FIFO, so writes can never execute out of
 *                    order; a failed stage is retried once and
 *                    reported precisely.
 */
class TransactionService {

  constructor(db) {
    this.db = db || new Database();
    this.writeQueue = new CustomQueue(); // DSA #2 - FIFO write buffer
  }

  /**
   * Process one checkout (Cash or Utang).
   * @param {Object} salePayload {totalAmount, amountPaid, changeDue,
   *        paymentType, customerName, phoneNumber, items:[{productId,name,unitPrice,qty}]}
   * @returns {Object} {success, saleId} | {success:false, error}
   */
  process(salePayload) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(25000);

      const prodSheet = this.db.getSheet(SHEET_NAMES.PRODUCTS);
      const prodLastRow = prodSheet.getLastRow();
      if (prodLastRow <= 1) throw new Error('No products found in database.');

      // --- DSA #1: CustomHashTable for O(1) average product lookup ---
      const prodValues = prodSheet.getRange(2, 1, prodLastRow - 1, 9).getValues();
      const productIndex = new CustomHashTable(Math.max(32, prodValues.length));
      prodValues.forEach((row, idx) => {
        productIndex.put(String(row[PRODUCT_COL.ID - 1]), {
          rowIndex: idx + 2,
          stock: Number(row[PRODUCT_COL.QTY - 1]) || 0
        });
      });

      // --- Validate stock BEFORE writing anything ---
      for (const item of salePayload.items) {
        if (String(item.productId).startsWith('NON-INV-')) continue;
        const match = productIndex.get(String(item.productId));
        if (!match) continue;
        if (match.stock < Number(item.qty)) {
          throw new Error(
            'Kulang ang stock para sa: ' + item.name + '. Mayroon na lang ' + match.stock + ' piraso.'
          );
        }
      }

      const saleId = 'SALE-' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyyMMdd-HHmmss');
      const timestamp = new Date();

      // --- Build all write operations, then enqueue them FIFO ---
      const self = this;

      // Stage 1: sale header + line items (bulk row arrays)
      this.writeQueue.enqueue({
        label: 'sale-records',
        run: function () {
          self.db.getSheet(SHEET_NAMES.SALES).appendRow([
            saleId, timestamp, Number(salePayload.totalAmount), Number(salePayload.amountPaid),
            Number(salePayload.changeDue), salePayload.paymentType,
            salePayload.customerName || 'Walk-in Suki', 'Completed'
          ]);
          const itemRows = salePayload.items.map(item => [
            saleId, item.productId, item.name, Number(item.qty),
            Number(item.unitPrice), Number(item.unitPrice) * Number(item.qty)
          ]);
          self.db.appendMany(SHEET_NAMES.SALES_ITEMS, itemRows);
        }
      });

      // Stage 2: deduct inventory (skip NON-INV- manual entries)
      const stockUpdates = [];
      salePayload.items.forEach(item => {
        if (String(item.productId).startsWith('NON-INV-')) return;
        const match = productIndex.get(String(item.productId));
        if (match) stockUpdates.push({ rowIndex: match.rowIndex, newQty: match.stock - Number(item.qty) });
      });
      if (stockUpdates.length > 0) {
        this.writeQueue.enqueue({
          label: 'stock-deduction',
          run: function () {
            stockUpdates.forEach(u => {
              prodSheet.getRange(u.rowIndex, PRODUCT_COL.QTY).setValue(u.newQty);
              prodSheet.getRange(u.rowIndex, PRODUCT_COL.UPDATED).setValue(timestamp);
            });
          }
        });
      }

      // Stage 3: cash ledger inflow OR utang record
      if (salePayload.paymentType === 'Cash') {
        this.writeQueue.enqueue({
          label: 'cash-ledger',
          run: function () {
            self.db.append(SHEET_NAMES.CASH_LEDGER, [
              'CASH-' + Utilities.formatDate(timestamp, TIME_ZONE, 'yyyyMMdd-HHmmss') + '-' + self._suffix_(),
              timestamp, 'Inflow', Number(salePayload.totalAmount), 'Sale ID: ' + saleId
            ]);
          }
        });
      } else if (salePayload.paymentType === 'Utang') {
        this.writeQueue.enqueue({
          label: 'utang-record',
          run: function () {
            self.db.append(SHEET_NAMES.UTANG, [
              'UTANG-' + Utilities.formatDate(timestamp, TIME_ZONE, 'yyyyMMdd-HHmmss') + '-' + self._suffix_(),
              timestamp, salePayload.customerName || 'Suki Customer', salePayload.phoneNumber || '',
              Number(salePayload.totalAmount), Number(salePayload.totalAmount), timestamp, 'Unpaid'
            ]);
          }
        });
      }

      // --- DSA #2: drain the queue strictly in order, retry once ---
      this.drainWriteQueue();

      return { success: true, saleId: saleId };

    } catch (err) {
      return { success: false, error: err.toString() };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Execute every queued write in FIFO order. A stage that fails
   * is retried once (transient Sheets glitches), then the whole
   * sale is reported as failed with the failing stage named.
   * Time O(stages) | each stage is a bulk Sheets call
   */
  drainWriteQueue() {
    while (!this.writeQueue.isEmpty()) {
      const stage = this.writeQueue.dequeue();
      try {
        stage.run();
      } catch (stageErr) {
        try {
          stage.run();                       // one retry for transient errors
        } catch (retryErr) {
          throw new Error(
            'Transaction failed at stage "' + stage.label + '": ' + retryErr
          );
        }
      }
    }
  }

  /** Random 3-digit suffix so same-second IDs never collide. */
  _suffix_() {
    return Math.floor(100 + Math.random() * 900);
  }
}

/* ------------------------------------------------------------------
 * Global wrapper - keeps the client's existing call signature.
 * ------------------------------------------------------------------ */
function processTransaction(salePayload) {
  return new TransactionService().process(salePayload);
}
