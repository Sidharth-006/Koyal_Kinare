# Phase 2 Implementation Plan Validation Report
**Project:** Koyal Kinare Cafe Management App (`c:\zayka`)  
**Target Scope:** Phase 2 (Inventory Master, Suppliers, Purchases, Stock Ledger, Stock Counts, Low-Stock Alerts, Reports)  
**Validation Date:** 2026-09-24  
**Document Status:** Complete — **READY FOR DLD**

---

## 1. Executive Summary

This validation report evaluates the proposed [Phase 2 Implementation Plan](file:///c:/zayka/docs/phase-2-implementation-plan.md) against the authoritative **Phase 2 PRD (v1.0)**, **Project HLD (v1.0)**, and the existing **Phase 1 codebase**.

**Result:** The Implementation Plan is architecturally sound, complies with all HLD constraints, and preserves Phase 1 integrity. Two open architectural choices have been identified and flagged for formal resolution in the **Phase 2 Detailed Level Design (DLD)** stage.

---

## 2. PRD & HLD Functional & Non-Functional Coverage

### Functional Coverage (PRD Matrix)
- **Inventory Master (INV-01 to INV-05):** Fully mapped. Items, categories, base units (`KG`, `LITER`, `PIECE`, etc.), minimum stock thresholds, cost per unit, and soft archiving are accounted for.
- **Suppliers (SUP-01 to SUP-04):** Fully mapped. Supplier records, contact info, GSTIN, and purchase history linkage are included.
- **Purchases (PUR-01 to PUR-06):** Fully mapped. Purchase orders, status lifecycle (`DRAFT` $\rightarrow$ `RECEIVED`), payment methods (`CASH`, `UPI`, `CARD`), attachments, line items, and server-side idempotency are covered.
- **Stock Ledger (STK-01 to STK-06):** Fully mapped. Append-only `stock_movements`, signed quantities, balance verification, manual adjustments/wastage with mandatory reasons, and physical stock count variance corrections are included.
- **Low-Stock Alerts (ALT-01 to ALT-03):** Fully mapped. Server-side evaluation (`current_stock <= threshold`), alert state transitions (`ACTIVE` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `RESOLVED`), and auto-resolution upon stock replenishment.
- **Inventory Dashboard (IDASH-01 to IDASH-03):** Fully mapped. Aggregate metric cards, low-stock counts, and stock valuation summaries.
- **Profitability & Expense Integration (FIN-01 to FIN-03):** Fully mapped. Purchases separated from operating expenses, food cost indicators marked as `ESTIMATED`, and daily cash reconciliation updated for `CASH`-paid purchases.
- **Reports (RPT-21 to RPT-25):** Fully mapped. Purchase Register, Stock Balances, Stock Movements, Supplier Summaries, and async Excel/PDF exports via `export_jobs`.

### Non-Functional & HLD Alignment
- **Server-Side Authority:** All stock balances, variances, alert evaluations, financial totals, and reconciliation updates are computed server-side.
- **Fixed-Precision Decimals:** Uses `NUMERIC(12,2)` / `decimal.js` for financial values and `NUMERIC(12,4)` for stock quantities.
- **Audit Logging:** Every critical mutation invokes `AuditService.logEvent(params, client)` within the active database transaction.
- **Phase 3 Boundary:** Recipe-driven POS consumption, payroll, barcode scanning, and multi-location transfers are strictly excluded.

---

## 3. Stock Ledger Architecture Validation

The proposed stock ledger design strictly enforces the required constraints:
- **Immutable Movements:** The `stock_movements` table is append-only. Historical records are never updated or deleted.
- **Traceability:** Every movement records `movement_type`, `quantity`, `balance_before`, `balance_after`, `reference_type` (`PURCHASE`, `STOCK_COUNT`, `MANUAL_ADJUSTMENT`, `WASTAGE`), `reference_id`, `reason`, and `created_by`.
- **No Silent Overwrites:** Stock adjustments and physical count corrections write compensating movement records rather than directly modifying quantity balances.
- **Mandatory Reasons:** Server validates non-empty `reason` strings for `MANUAL_DECREASE`, `WASTAGE`, and `COUNT_CORRECTION`.
- **Atomic Stock Changes:** Movement creation and cached `inventory_items.current_stock` updates occur in a single `withTransaction` block.

---

## 4. Purchase Receiving & Idempotency Validation

- **Draft State Safety:** Creating a purchase draft (`DRAFT`) creates purchase header and line items but produces **NO** stock movements.
- **Receiving Action:** Marking status as `RECEIVED` executes stock-in movements (`PURCHASE_RECEIVED`) for all lines.
- **Single Receipt Guarantee:** Server checks purchase status before processing; if status is already `RECEIVED`, the operation is rejected.
- **Duplicate Protection:** Handled via `IdempotencyRepository` checking payload SHA-256 hash against table `idempotency` with key `receive_purchase_<purchase_id>`.
- **Atomicity:** Purchase status update, stock-in movement insertion, balance caching, alert evaluation, and audit logging execute inside a unified DB transaction.

---

## 5. Phase 1 Reconciliation Integration Validation

The extended reconciliation calculation in `ReconciliationService.getReconciliationPreview` is verified:

$$\text{Expected Closing Cash} = \text{Opening Cash} + \text{Cash Sales} - \text{Cash Expenses} - \text{Cash Purchases}$$

- **Cash Purchases:** Evaluated by querying `purchases` where `business_date = target_date`, `status = 'RECEIVED'`, and `payment_method = 'CASH'`.
- **Non-Cash Protection:** Purchases paid via `UPI` or `CARD` do NOT affect physical cash drawer balances.
- **Regression Safety:** Phase 1 sales, expenses, and opening cash routines remain untouched.

---

## 6. Phase 3 Boundary Verification

The plan explicitly excludes Phase 3 features:
- POS billing does **NOT** trigger automatic recipe ingredient deductions.
- No barcode scanning or weighing scale integrations are included.
- Food cost ratios in Phase 2 reports are explicitly labeled as **ESTIMATED**.

---

## 7. Analysis of Open Architectural Decisions

### Decision A: Invoice Attachment Cardinality
- **Current Plan Proposal:** Single `attachment_id` FK on `purchases` referencing `attachments(id)`.
- **PRD/HLD Evaluation:** The PRD specifies attachment upload for purchase invoices/proofs. It does not mandate multi-attachment arrays.
- **Status:** **REQUIRES DECISION in DLD.**  
  *Option 1 (Default):* Single attachment per purchase (simplest, fits existing Phase 1 expense pattern).  
  *Option 2:* Separate `purchase_attachments` join table for multiple proof files per invoice.

### Decision B: Inventory Item Unit Cost Policy (`cost_per_unit`)
- **Current Plan Proposal:** Update `inventory_items.cost_per_unit` to the latest received purchase unit price.
- **PRD/HLD Evaluation:** The PRD/HLD mandates fixed-precision decimal arithmetic and estimated food cost reporting, but does not mandate a specific valuation model (e.g. Latest Received Price vs Weighted Average Cost vs Manual Master Cost).
- **Status:** **REQUIRES DECISION in DLD.**  
  *Option 1 (Latest Price):* Simplest to compute upon receipt; reflects current market replacement cost.  
  *Option 2 (Weighted Average Cost):* $\text{WAC} = \frac{(\text{Existing Stock} \times \text{Old Cost}) + (\text{Received Qty} \times \text{New Cost})}{\text{Existing Stock} + \text{Received Qty}}$.  
  *Option 3 (Manual Master Cost):* Admin manually sets standard cost in Item Master; purchase prices do not overwrite item master cost automatically.

---

## 8. Unsupported Assumptions & Identified Risks

1. **Category Hierarchy Assumption:** Plan assumes single-level `inventory_categories`. Nested/tree categories are excluded (aligned with Phase 1 menu categories).
2. **SKU Uniqueness:** Plan assumes `sku` is optional but unique if provided.
3. **Unit Standardisation:** Base units are restricted to `'KG'`, `'GRAM'`, `'LITER'`, `'ML'`, `'PIECE'`, `'PACKET'`, `'BOX'`. Unit conversion rates (e.g. 1 KG = 1000 GRAM) will be defined in the DLD.

---

## 9. Dependency & Milestone Order Verification

The milestone order in the Implementation Plan is logically coherent and free of circular dependencies:
1. Migration 008 (Schema Foundation)
2. Inventory & Supplier Master Domain
3. Stock Ledger Core & Purchase Receiving
4. Stock Counts & Low-Stock Alerts
5. Reconciliation Integration & Phase 2 Reports
6. Frontend UI Development
7. Integration & Regression Verification

---

## 10. Final Validation Conclusion & Next Step

The Phase 2 Implementation Plan is thoroughly validated against all PRD and HLD requirements. No code or migration changes have been executed.

**Final Status:** **READY FOR DLD**

The immediate next step is to author the **Phase 2 Detailed Level Design (DLD)** document to freeze:
1. Exact database DDL and constraints for Migration 008.
2. Formal resolution for Decision A (Attachment Cardinality) and Decision B (Inventory Unit Valuation Policy).
3. TypeScript interface contracts for domain services, repositories, and API request/response DTOs.
