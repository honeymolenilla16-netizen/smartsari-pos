/**
 * AlertService.gs - Automated Low-Stock Email Alerts
 * ---------------------------------------------------------
 * Fulfils proposal objective 2.2 / feature 3.7: time-driven
 * Google Apps Script triggers dispatch email notifications
 * when product inventories breach minimum reorder levels.
 *
 * DSA tie-in: CustomMinHeap ranks every breached product by
 * urgency (stock / reorder_level - the LOWEST ratio is the
 * most urgent) so the email lists most-critical items first
 * WITHOUT sorting the entire catalog.
 */
class AlertService {

  constructor(db) {
    this.db = db || new Database();
  }

  /**
   * Scan the catalog, rank low-stock products with the min-heap,
   * and email the ranked table to the configured alert address.
   * Designed to be called by a time-driven trigger (see
   * setupLowStockTrigger) or manually for testing.
   * @returns {Object} {success, lowStockCount, emailedTo}
   */
  checkLowStockAlerts() {
    try {
      const state = this.db.loadFullState();

      /* --- DSA #3: CustomMinHeap - urgency ranking ---
       * urgency = stock / reorder_level  (0 = sold out,
       * 1.0 = exactly at the reorder line; lowest wins) */
      const heap = new CustomMinHeap((a, b) => a.urgency - b.urgency);
      for (const p of state.products) {
        const reorder = Number(p.reorder_level) || 5;
        const stock = Number(p.stock_qty) || 0;
        if (stock <= reorder) {
          heap.insert({
            id: String(p.product_id),
            name: String(p.name),
            stock: stock,
            reorder: reorder,
            urgency: reorder > 0 ? stock / reorder : 0,
            suggestedQty: Math.max(reorder * 2 - stock, reorder)
          });
        }
      }

      if (heap.isEmpty()) {
        return { success: true, lowStockCount: 0, emailedTo: '', message: 'All products are above reorder levels.' };
      }

      // Extract-Min loop = items most-urgent first
      const ranked = heap.toRankedList();

      const email = this.resolveAlertEmail_();
      if (!email) {
        return {
          success: true,
          lowStockCount: ranked.length, emailedTo: '',
          message: 'Low stock detected but no alert_email is set. Set it in the Tindahan modal.'
        };
      }

      MailApp.sendEmail(email, this.buildSubject_(ranked.length), this.buildHtmlBody_(ranked));

      return { success: true, lowStockCount: ranked.length, emailedTo: email };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * One-time setup: creates a daily 7AM (Manila) time-driven
   * trigger for checkLowStockAlerts. Removes any previous ones
   * so repeated calls never duplicate emails.
   * @returns {Object} {success, triggerCount}
   */
  setupLowStockTrigger() {
    try {
      this.removeTriggers_();
      ScriptApp.newTrigger('checkLowStockAlerts')
        .timeBased().everyDays(1).atHour(7).create();
      return { success: true, triggerCount: this.countTriggers_() };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /** Delete every low-stock trigger. @returns {Object} */
  removeLowStockTrigger() {
    try {
      const removed = this.removeTriggers_();
      return { success: true, removed: removed };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /**
   * Store the alert recipient in Store_Settings.
   * @param {string} email
   */
  setAlertEmail(email) {
    try {
      const clean = String(email || '').trim();
      if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        throw new Error('Invalid email address: ' + clean);
      }
      const setSheet = this.db.getSheet(SHEET_NAMES.STORE_SETTINGS);
      const data = setSheet.getDataRange().getValues();
      const timestamp = new Date();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === 'alert_email') {
          setSheet.getRange(i + 1, 2).setValue(clean);
          setSheet.getRange(i + 1, 3).setValue(timestamp);
          return { success: true };
        }
      }
      setSheet.appendRow(['alert_email', clean, timestamp]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  /** Alert address = setting, else the script's active user. */
  resolveAlertEmail_() {
    const settings = this.db.readAll(SHEET_NAMES.STORE_SETTINGS);
    const row = settings.find(s => String(s.setting_key) === 'alert_email');
    const configured = row ? String(row.setting_value).trim() : '';
    if (configured) return configured;
    return Session.getActiveUser().getEmail() || '';
  }

  /** Remove all triggers bound to checkLowStockAlerts. */
  removeTriggers_() {
    let removed = 0;
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'checkLowStockAlerts') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    });
    return removed;
  }

  countTriggers_() {
    return ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'checkLowStockAlerts').length;
  }

  buildSubject_(count) {
    return '🔔 SMARTSARI Low Stock Alert - ' + count + ' item(s) need restocking';
  }

  /** Ranked HTML table - most urgent product first. */
  buildHtmlBody_(ranked) {
    const rows = ranked.map((r, i) =>
      '<tr>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center">' + (i + 1) + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd">' + r.name + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center;font-family:monospace">' + r.id + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center;color:#be123c;font-weight:bold">' + r.stock + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center">' + r.reorder + '</td>' +
        '<td style="padding:6px;border:1px solid #ddd;text-align:center;color:#047857;font-weight:bold">' + r.suggestedQty + '</td>' +
      '</tr>'
    ).join('');

    return (
      '<div style="font-family:Arial,sans-serif">' +
      '<h2 style="color:#be185d">SMARTSARI - Mababa ang Stock</h2>' +
      '<p>Narito ang mga panindang kailangan nang i-restock (pinaka-urgent sa itaas):</p>' +
      '<table style="border-collapse:collapse">' +
      '<tr style="background:#fce7f3">' +
        '<th style="padding:6px;border:1px solid #ddd">#</th>' +
        '<th style="padding:6px;border:1px solid #ddd">Product</th>' +
        '<th style="padding:6px;border:1px solid #ddd">Code</th>' +
        '<th style="padding:6px;border:1px solid #ddd">Stock</th>' +
        '<th style="padding:6px;border:1px solid #ddd">Reorder Level</th>' +
        '<th style="padding:6px;border:1px solid #ddd">Suggested Restock</th>' +
      '</tr>' + rows +
      '</table>' +
      '<p style="color:#6b7280;font-size:12px">Ito ay awtomatikong alerto mula sa SMARTSARI (Google Apps Script trigger).</p>' +
      '</div>'
    );
  }
}

/* ------------------------------------------------------------------
 * Global wrappers - backward-compatible public API.
 * ------------------------------------------------------------------ */
function checkLowStockAlerts() {
  return new AlertService().checkLowStockAlerts();
}
function setupLowStockTrigger() {
  return new AlertService().setupLowStockTrigger();
}
function removeLowStockTrigger() {
  return new AlertService().removeLowStockTrigger();
}
function setAlertEmail(email) {
  return new AlertService().setAlertEmail(email);
}
