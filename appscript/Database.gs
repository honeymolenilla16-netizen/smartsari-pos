/**
 * Database.gs - Data Persistence Layer
 * ---------------------------------------------------------
 * Single access point for the Google Spreadsheet "database".
 * All other modules go through Database so sheet reading and
 * schema initialization live in exactly one place.
 */
class Database {

  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  /** @returns {GoogleAppsScript.Spreadsheet.Sheet} the named tab (never null - creates it). */
  getSheet(sheetName) {
    return this.ss.getSheetByName(sheetName) || this.ss.insertSheet(sheetName);
  }

  /**
   * Create every sheet from SCHEMAS (if missing), seed default
   * settings, and seed starter products on a brand-new install.
   * Safe to call on every request - idempotent.
   */
  ensureInitialized() {
    for (const [sheetName, headers] of Object.entries(SCHEMAS)) {
      let sheet = this.ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = this.ss.insertSheet(sheetName);
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length)
          .setFontWeight('bold').setBackground('#FCE7F3').setFontColor('#831843');
      }
    }

    // Settings: make sure each default key exists exactly once
    const setSheet = this.getSheet(SHEET_NAMES.STORE_SETTINGS);
    const settings = this.readAll(SHEET_NAMES.STORE_SETTINGS);
    const existing = new Set(settings.map(s => String(s.setting_key)));
    for (const def of DEFAULT_SETTINGS) {
      if (!existing.has(def.key)) {
        setSheet.appendRow([def.key, def.value, new Date()]);
      }
    }

    // Seed starter products only on an empty catalog
    const prodSheet = this.getSheet(SHEET_NAMES.PRODUCTS);
    if (prodSheet.getLastRow() <= 1) {
      for (const row of Database.STARTER_PRODUCTS()) prodSheet.appendRow(row);
    }
  }

  /**
   * Read an entire sheet as an array of objects keyed by header.
   * Dates are converted to ISO-8601 strings for the client.
   * Time O(rows x cols) - Sheets range read is one bulk call.
   * @param {string} sheetName
   * @returns {Array<Object>}
   */
  readAll(sheetName) {
    const sheet = this.ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return values.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val instanceof Date) val = val.toISOString();
        obj[h] = val;
      });
      return obj;
    });
  }

  /**
   * Append one row to a sheet.
   * Time O(cols)
   */
  append(sheetName, row) {
    this.getSheet(sheetName).appendRow(row);
  }

  /**
   * Bulk-append many rows in a single call (much faster than
   * N x appendRow at 500+ records).
   * Time O(rows x cols)
   */
  appendMany(sheetName, rows) {
    if (!rows || rows.length === 0) return;
    this.getSheet(sheetName).getRange(
      this.getSheet(sheetName).getLastRow() + 1, 1, rows.length, rows[0].length
    ).setValues(rows);
  }

  /**
   * Full application state for the client - one bulk read per tab.
   * @returns {Object} products, sales, totals, profile, settings...
   */
  loadFullState() {
    this.ensureInitialized();

    const products      = this.readAll(SHEET_NAMES.PRODUCTS);
    const sales         = this.readAll(SHEET_NAMES.SALES);
    const salesItems    = this.readAll(SHEET_NAMES.SALES_ITEMS);
    const utang         = this.readAll(SHEET_NAMES.UTANG);
    const utangPayments = this.readAll(SHEET_NAMES.UTANG_PAYMENTS);
    const gcash         = this.readAll(SHEET_NAMES.GCASH);
    const expenses      = this.readAll(SHEET_NAMES.EXPENSES);
    const purchases     = this.readAll(SHEET_NAMES.PURCHASES);
    const cashEntries   = this.readAll(SHEET_NAMES.CASH_LEDGER);
    const profileList   = this.readAll(SHEET_NAMES.STORE_PROFILE);
    const settingsList  = this.readAll(SHEET_NAMES.STORE_SETTINGS);

    const userProfile = profileList.length > 0 ? profileList[profileList.length - 1] : null;
    const settingOf = key => {
      const match = settingsList.find(s => String(s.setting_key) === key);
      return match ? match.setting_value : null;
    };

    return {
      products,
      sales,
      salesItems,
      utang,
      utangPayments,
      gcash,
      expenses,
      purchases,
      cashEntries,
      userProfile,
      startingFloat: Number(settingOf('starting_cash_float')) || 1000.00,
      alertEmail: settingOf('alert_email') || '',
      storeName: userProfile ? userProfile.store_name : 'SMARTSARI Store'
    };
  }

  /** 12 starter SKUs from the approved proposal catalog. */
  static STARTER_PRODUCTS() {
    return [
      ['BIS-001', 'SkyFlakes Crackers 25g',        'Biscuits',                  6.50,   8.00,  30, 10, '', new Date()],
      ['BEV-001', 'Coca-Cola Mismo 300ml',         'Beverages',                 16.00,  20.00, 20, 5,  '', new Date()],
      ['CND-001', 'Maxx Menthol Candy',            'Candies and Chocolates',    1.50,   2.00,  100, 20, '', new Date()],
      ['CIG-001', 'Marlboro Red Single',           'Cigarettes',                8.00,   10.00, 50, 10, '', new Date()],
      ['CND-002', 'Datu Puti Soy Sauce 100ml',     'Condiments',                12.00,  15.00, 25, 5,  '', new Date()],
      ['DET-001', 'Surf Powder Sun Fresh 80g',     'Laundry Detergent Powder',  11.00,  14.00, 30, 8,  '', new Date()],
      ['PC-001',  'Palmolive Shampoo 12ml',        'Personal Care',             6.00,   8.00,  40, 10, '', new Date()],
      ['MLK-001', 'Bear Brand Fortified 33g',      'Powdered Milk',             14.00,  17.00, 30, 8,  '', new Date()],
      ['COF-001', 'Nescafe 3in1 Original',         'Coffee, Tea, and Creamer',  7.00,   9.00,  50, 15, '', new Date()],
      ['RCE-001', 'Dinorado Rice (per kg)',        'Rice',                      50.00,  58.00, 50, 10, '', new Date()],
      ['SNK-001', 'Piattos Cheese 40g',            'Snacks',                    14.50,  18.00, 25, 5,  '', new Date()],
      ['LIQ-001', 'San Miguel Pale Pilsen 330ml',  'Wine and Liquor',           45.00,  55.00, 12, 4,  '', new Date()]
    ];
  }
}

/* ------------------------------------------------------------------
 * Global wrappers - google.script.run can ONLY call top-level
 * global functions, never class methods directly. These 1-line
 * delegators keep the original public API 100% backward compatible.
 * ------------------------------------------------------------------ */

/** Initializes all sheets/settings. Called automatically on load. */
function initializeDatabase() {
  return new Database().ensureInitialized();
}

/** Full data snapshot for the client (products, sales, ledgers...). */
function getStoreData() {
  return { success: true, data: new Database().loadFullState() };
}
