/**
 * SMARTSARI: Sari-Sari Store Management System
 * Google Apps Script Server Backend - Entry Point
 * ---------------------------------------------------------
 * File map (paste each file into the Apps Script editor):
 *   Code.gs                - web app entry point (this file)
 *   Config.gs              - sheet names, schemas, constants
 *   Database.gs            - spreadsheet access layer + getStoreData()
 *   DSA_HashTable.gs       - DSA #1  CustomHashTable
 *   DSA_Queue.gs           - DSA #2  CustomQueue (FIFO)
 *   DSA_MinHeap.gs         - DSA #3  CustomMinHeap (priority queue)
 *   DSA_Algorithms.gs      - Alg #1  MergeSort   Alg #2  BinarySearch
 *   TransactionService.gs  - POS checkout engine (hash + queue)
 *   LedgerService.gs       - cash/utang/expense/gcash/profile ledgers
 *   ReportService.gs       - date-range financial reports (merge sort)
 *   AlertService.gs        - low-stock email alerts (min-heap + trigger)
 *   DsaTests.gs            - unit test runner (runDsaUnitTests)
 *   DataSeeder.gs          - 500+ record sample dataset generator
 *
 * Runtime: the V8 runtime is used automatically by all current Apps Script
 * projects (the legacy "Use the V8 runtime" checkbox no longer exists).
 */

/** Serve the frontend. Called on web app /exec visits. */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('SMARTSARI: Sari-Sari Store Management System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper for HTML partials (templating).
 * Usage inside Index.html:  <?!= include('SomePartial'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
