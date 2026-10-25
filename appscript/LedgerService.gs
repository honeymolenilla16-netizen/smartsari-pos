/**
 * LedgerService.gs - Cash, Utang, Expense, GCash & Profile Ledgers
 * ---------------------------------------------------------
 * Every money-ledger operation of the store lives here.
 * Each method returns {success:true} | {success:false, error}
 * so the client can keep its existing handlers unchanged.
 */
class LedgerService {

  constructor(db) {
    this.db = db || new Database();
  }

  /** Unique, collision-proof ledger ID (timestamp + random suffix). */
  static newId(prefix, timestamp) {
    const ts = Utilities.formatDate(timestamp || new Date(), TIME_ZONE, 'yyyyMMdd-HHmmss');
    return prefix + '-' + ts + '-' + Math.floor(100 + Math.random() * 900);
  }

  /**
   * Manual cash in/out entry.
   * @param {string} type 'Inflow' | 'Outflow'
   * @param {number} amount
   * @param {string} note
   */
  saveCashEntry(type, amount, note) {
    try {
      const timestamp = new Date();
      this.db.append(SHEET_NAMES.CASH_LEDGER, [
        LedgerService.newId('CASH', timestamp), timestamp, type, Number(amount), note || 'Manual Entry'
      ]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Record a partial or full utang payment.
   * DSA tie-in: CustomHashTable (O(1) average lookup by utang_id)
   *             instead of linear scan. Finds ledger row then updates balance/status.
   * Time  O(m + 1) where m = Utang_Ledger rows (build index) | Space O(m)
   * @param {string} utangId
   * @param {string} customerName
   * @param {number} amountPaid
   * @param {string} note
   */
  recordUtangPayment(utangId, customerName, amountPaid, note) {
    try {
      const utangSheet = this.db.getSheet(SHEET_NAMES.UTANG);
      const data = utangSheet.getDataRange().getValues();
      if (data.length <= 1) throw new Error('Utang record not found.');

      // Build id -> {rowIndex (1-based), balance} using CustomHashTable
      const idx = new CustomHashTable(Math.max(16, data.length - 1));
      for (let i = 1; i < data.length; i++) {
        idx.put(String(data[i][0]), {
          rowIndex: i + 1,
          balance: Number(data[i][5]) || 0
        });
      }

      const match = idx.get(String(utangId));
      if (!match) throw new Error('Utang record not found.');
      const foundRow = match.rowIndex;
      let currentBalance = match.balance;

      const payAmount = Number(amountPaid);
      const newBalance = Math.max(0, currentBalance - payAmount);
      const newStatus = newBalance === 0 ? 'Paid' : 'Partial';
      const timestamp = new Date();

      utangSheet.getRange(foundRow, 6).setValue(newBalance);
      utangSheet.getRange(foundRow, 7).setValue(timestamp);
      utangSheet.getRange(foundRow, 8).setValue(newStatus);

      this.db.append(SHEET_NAMES.UTANG_PAYMENTS, [
        LedgerService.newId('PAY', timestamp), utangId, timestamp,
        payAmount, customerName, note || 'Utang Payment'
      ]);
      this.db.append(SHEET_NAMES.CASH_LEDGER, [
        LedgerService.newId('CASH', timestamp), timestamp, 'Inflow',
        payAmount, 'Utang Payment from ' + customerName
      ]);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Record an operational expense (+ cash outflow).
   */
  saveExpense(category, amount, description) {
    try {
      const timestamp = new Date();
      this.db.append(SHEET_NAMES.EXPENSES, [
        LedgerService.newId('EXP', timestamp), timestamp, category, Number(amount), description
      ]);
      this.db.append(SHEET_NAMES.CASH_LEDGER, [
        LedgerService.newId('CASH', timestamp), timestamp, 'Outflow',
        Number(amount), 'Expense: ' + category + ' - ' + description
      ]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Record a GCash micro-transaction and sync the cash box.
   */
  recordGCashTxn(txnType, amount, fee, refNo, customerName) {
    try {
      const timestamp = new Date();
      const amt = Number(amount);
      const serviceFee = Number(fee) || 0;

      this.db.append(SHEET_NAMES.GCASH, [
        LedgerService.newId('GCASH', timestamp), timestamp, txnType, amt,
        serviceFee, refNo || '', customerName || 'Walk-in', serviceFee
      ]);

      if (txnType === 'Cash-In') {
        this.db.append(SHEET_NAMES.CASH_LEDGER, [
          LedgerService.newId('CASH', timestamp), timestamp, 'Inflow', amt + serviceFee, 'GCash Cash-In + Fee'
        ]);
      } else if (txnType === 'Cash-Out') {
        this.db.append(SHEET_NAMES.CASH_LEDGER, [
          LedgerService.newId('CASH', timestamp), timestamp, 'Outflow', amt, 'GCash Cash-Out Released'
        ]);
        if (serviceFee > 0) {
          this.db.append(SHEET_NAMES.CASH_LEDGER, [
            LedgerService.newId('CASH', timestamp), timestamp, 'Inflow', serviceFee, 'GCash Service Fee'
          ]);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Update the panimulang (starting) cash float in Store_Settings.
   */
  updateStartingFloat(newFloat) {
    try {
      const sheet = this.db.getSheet(SHEET_NAMES.STORE_SETTINGS);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === 'starting_cash_float') {
          sheet.getRange(i + 1, 2).setValue(Number(newFloat));
          sheet.getRange(i + 1, 3).setValue(new Date());
          return { success: true };
        }
      }
      sheet.appendRow(['starting_cash_float', Number(newFloat), new Date()]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Daily remittance: expected cash (from the cash ledger) vs
   * the physical cash count, with discrepancy.
   * Expected = starting float + net ledger inflow
   *   (Utang sales are NOT counted as cash - only real inflows)
   */
  closeDailyRemittance(actualCash, closedBy) {
    try {
      const state = this.db.loadFullState();
      const netCashInflow = state.cashEntries.reduce((sum, entry) => {
        const amt = Number(entry.amount) || 0;
        return entry.type === 'Inflow' ? sum + amt : sum - amt;
      }, 0);

      const expectedCash = state.startingFloat + netCashInflow;
      const actual = Number(actualCash);
      const discrepancy = actual - expectedCash;
      const timestamp = new Date();

      this.db.append(SHEET_NAMES.DAILY_REMITTANCE, [
        LedgerService.newId('REMIT', timestamp), timestamp,
        expectedCash, actual, discrepancy, closedBy || 'Owner', 'Closed'
      ]);

      return { success: true, expectedCash, actual, discrepancy };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Save store profile (append-only history) + optional new PIN.
   */
  updateStoreProfile(storeName, ownerName, phone, newPin) {
    try {
      const timestamp = new Date();
      this.db.append(SHEET_NAMES.STORE_PROFILE, [storeName, ownerName, phone, timestamp]);

      if (newPin) {
        const setSheet = this.db.getSheet(SHEET_NAMES.STORE_SETTINGS);
        const data = setSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === 'auth_pin') {
            setSheet.getRange(i + 1, 2).setValue(String(newPin).trim());
            setSheet.getRange(i + 1, 3).setValue(timestamp);
            return { success: true };
          }
        }
        setSheet.appendRow(['auth_pin', String(newPin).trim(), timestamp]);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Add a new product or restock an existing one (+ purchase log).
   */
  addInventoryProduct(productId, name, category, costPrice, sellingPrice, stockQty) {
    try {
      const prodSheet = this.db.getSheet(SHEET_NAMES.PRODUCTS);
      const timestamp = new Date();
      const data = prodSheet.getDataRange().getValues();
      let existingRow = -1;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(productId)) { existingRow = i + 1; break; }
      }

      if (existingRow > -1) {
        const currentStock = Number(prodSheet.getRange(existingRow, PRODUCT_COL.QTY).getValue()) || 0;
        prodSheet.getRange(existingRow, PRODUCT_COL.COST).setValue(Number(costPrice));
        prodSheet.getRange(existingRow, PRODUCT_COL.PRICE).setValue(Number(sellingPrice));
        prodSheet.getRange(existingRow, PRODUCT_COL.QTY).setValue(currentStock + Number(stockQty));
        prodSheet.getRange(existingRow, PRODUCT_COL.UPDATED).setValue(timestamp);
      } else {
        prodSheet.appendRow([
          productId, name, category, Number(costPrice), Number(sellingPrice),
          Number(stockQty), 5, '', timestamp
        ]);
      }

      this.db.append(SHEET_NAMES.PURCHASES, [
        LedgerService.newId('PURCH', timestamp), timestamp, productId, name,
        Number(stockQty), Number(costPrice) * Number(stockQty)
      ]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Verify the admin PIN (stored in Store_Settings).
   * @param {string} inputCode
   * @returns {Object} {success, authorized} | {success:false, error}
   */
  verifyAuthCode(inputCode) {
    try {
      let storedPin = '1234';
      const settings = this.db.readAll(SHEET_NAMES.STORE_SETTINGS);
      const pinSetting = settings.find(s => String(s.setting_key) === 'auth_pin');
      if (pinSetting) storedPin = String(pinSetting.setting_value);

      if (String(inputCode).trim() === storedPin.trim()) {
        return { success: true, authorized: true };
      }
      return { success: false, error: 'Maling PIN code! Pakisubukan ulit.' };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }
}

/* ------------------------------------------------------------------
 * Global wrappers - backward-compatible public API.
 * ------------------------------------------------------------------ */
function saveCashEntry(type, amount, note) {
  return new LedgerService().saveCashEntry(type, amount, note);
}
function recordUtangPayment(utangId, customerName, amountPaid, note) {
  return new LedgerService().recordUtangPayment(utangId, customerName, amountPaid, note);
}
function saveExpense(category, amount, description) {
  return new LedgerService().saveExpense(category, amount, description);
}
function recordGCashTxn(txnType, amount, fee, refNo, customerName) {
  return new LedgerService().recordGCashTxn(txnType, amount, fee, refNo, customerName);
}
function updateStartingFloat(newFloat) {
  return new LedgerService().updateStartingFloat(newFloat);
}
function closeDailyRemittance(actualCash, closedBy) {
  return new LedgerService().closeDailyRemittance(actualCash, closedBy);
}
function updateStoreProfile(storeName, ownerName, phone, newPin) {
  return new LedgerService().updateStoreProfile(storeName, ownerName, phone, newPin);
}
function addInventoryProduct(productId, name, category, costPrice, sellingPrice, stockQty) {
  return new LedgerService().addInventoryProduct(productId, name, category, costPrice, sellingPrice, stockQty);
}
function verifyAuthCode(inputCode) {
  return new LedgerService().verifyAuthCode(inputCode);
}
