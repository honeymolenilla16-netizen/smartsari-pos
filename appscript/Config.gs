/**
 * SMARTSARI: Sari-Sari Store Management System
 * ---------------------------------------------------------
 * Config.gs - Global constants, sheet names, and schemas.
 * Every module reads its table layout from here so the
 * spreadsheet schema has exactly ONE definition.
 *
 * NOTE: Google Apps Script shares one global scope across
 * all .gs files, so these constants are visible everywhere
 * without any import statements. (V8 runtime required.)
 */

const APP_VERSION = '2.0.0';
const TIME_ZONE = 'Asia/Manila'; // GMT+8

/** Sheet tab names inside the bound Google Spreadsheet. */
const SHEET_NAMES = Object.freeze({
  PRODUCTS: 'Products',
  SALES: 'Sales',
  SALES_ITEMS: 'Sales_Items',
  UTANG: 'Utang_Ledger',
  UTANG_PAYMENTS: 'Utang_Payments',
  GCASH: 'GCash_Logs',
  EXPENSES: 'Expenses',
  PURCHASES: 'Purchases',
  CASH_LEDGER: 'Cash_Ledger',
  STORE_PROFILE: 'Store_Profile',
  DAILY_REMITTANCE: 'Daily_Remittance',
  STORE_SETTINGS: 'Store_Settings'
});

/** Header rows (in column order) for every sheet. */
const SCHEMAS = Object.freeze({
  [SHEET_NAMES.PRODUCTS]: [
    'product_id', 'name', 'category', 'cost_price', 'selling_price', 'stock_qty', 'reorder_level', 'image_url', 'date_updated'
  ],
  [SHEET_NAMES.SALES]: [
    'sale_id', 'timestamp', 'total_amount', 'amount_paid', 'change_due', 'payment_type', 'customer_name', 'status'
  ],
  [SHEET_NAMES.SALES_ITEMS]: [
    'sale_id', 'product_id', 'product_name', 'qty', 'unit_price', 'subtotal'
  ],
  [SHEET_NAMES.UTANG]: [
    'utang_id', 'date_recorded', 'customer_name', 'phone_number', 'total_amount', 'balance', 'last_updated', 'status'
  ],
  [SHEET_NAMES.UTANG_PAYMENTS]: [
    'payment_id', 'utang_id', 'timestamp', 'amount_paid', 'customer_name', 'note'
  ],
  [SHEET_NAMES.GCASH]: [
    'txn_id', 'timestamp', 'txn_type', 'amount', 'service_fee', 'reference_no', 'customer_name', 'commission'
  ],
  [SHEET_NAMES.EXPENSES]: [
    'expense_id', 'timestamp', 'category', 'amount', 'description'
  ],
  [SHEET_NAMES.PURCHASES]: [
    'purchase_id', 'timestamp', 'product_id', 'product_name', 'qty', 'total_cost'
  ],
  [SHEET_NAMES.CASH_LEDGER]: [
    'cash_id', 'timestamp', 'type', 'amount', 'note'
  ],
  [SHEET_NAMES.STORE_PROFILE]: [
    'store_name', 'owner_name', 'phone_number', 'date_registered'
  ],
  [SHEET_NAMES.DAILY_REMITTANCE]: [
    'remit_id', 'date_closed', 'expected_cash', 'actual_cash', 'discrepancy', 'closed_by', 'status'
  ],
  [SHEET_NAMES.STORE_SETTINGS]: [
    'setting_key', 'setting_value', 'date_updated'
  ]
});

/** 1-based column positions in the Products sheet (avoids magic numbers). */
const PRODUCT_COL = Object.freeze({
  ID: 1, NAME: 2, CATEGORY: 3, COST: 4, PRICE: 5, QTY: 6, REORDER: 7, IMAGE: 8, UPDATED: 9
});

/** Default Store_Settings rows created on first run. */
const DEFAULT_SETTINGS = Object.freeze([
  { key: 'starting_cash_float', value: '1000.00' },
  { key: 'auth_pin', value: '1234' },
  { key: 'alert_email', value: '' }
]);
