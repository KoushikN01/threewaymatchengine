# Three-Way Match Engine for PO, GRN, and Invoice

A full-stack procurement reconciliation application built with **Next.js (App Router)**, **Node.js/Express**, **MongoDB (Mongoose)**, and **Google Gemini API**.

---

## 1. Explanation

Think of this system as an **automatic digital checker** for procurement operations.

When a business buys products from a supplier, three different documents are generated for the exact same order:

1. **PO (Purchase Order)**: *"What did we ask for?"*  
   The order created by the buyer specifying the items, quantities, and agreed rates.
2. **GRN (Goods Receipt Note)**: *"What did we actually receive?"*  
   The warehouse record created upon receiving products at the unloading dock.
3. **Invoice (Bill)**: *"What are they asking us to pay?"*  
   The bill sent by the seller requesting payment.
4. **SKU Master**: *"Which product is this?"*  
   The canonical product dictionary that maps different vendor item codes across documents to the same physical product.
5. **Match Engine**: *"Do all three documents agree?"*  
   The business logic that compares quantities, prices, MRPs, dates, and item codes to spot discrepancies.

---

## 2. Why This System Is Needed

In high-volume commercial purchasing, manual checking of documents leads to massive financial leakages:
- **Paying for unreceived items**: Invoicing 100 units when warehouse only received 30.
- **Overbilling**: Billing at ₹220/unit when contract agreed rate is ₹199/unit.
- **Duplicate payments**: Paying the same invoice or PO twice.
- **Out-of-order document arrivals**: Invoices arriving days before the warehouse GRN or PO is processed.

This application automates document reading, standardizes item identities, and computes deterministic match results instantly.

---

## 3. End-to-End Architecture & Design Principle

```
PDF / Image Upload
       │
       ▼
Google Gemini API (OCR & Structured JSON Extraction)
       │
       ▼
Zod Schema Validation & Sanitization
       │
       ▼
SKU Master Resolution (skuErpCode -> eanCode -> unmapped_master_sku)
       │
       ▼
MongoDB Persistence (keyed by poNumber string)
       │
       ▼
Deterministic Match Engine (Calculates Item & PO Status dynamically)
       │
       ▼
Next.js Responsive Dashboard (Split-screen Preview & Cell Highlighting)
```

> [!IMPORTANT]
> **Core Principle: "GEMINI EXTRACTS. BACKEND CHECKS."**  
> We use Gemini AI for document OCR and text-to-JSON extraction. Gemini is **never trusted to make business matching decisions**. The backend enforces strict, deterministic TypeScript comparison logic for calculations.

---

## 4. Matching Rules & Status Hierarchy

### Reason Codes
- `grn_qty_exceeds_po_qty`: Received quantity (all GRNs) exceeds ordered PO quantity.
- `invoice_qty_exceeds_grn_qty`: Invoiced quantity (all Invoices) exceeds received GRN quantity.
- `invoice_qty_exceeds_po_qty`: Invoiced quantity exceeds PO quantity.
- `invoice_date_after_po_date`: Invoice date is after PO release date.
- `duplicate_po`: Multiple POs uploaded with the same `poNumber`.
- `duplicate_document`: Multiple GRNs/Invoices re-using document numbers under the same PO.
- `item_missing_in_po`: Item present on GRN/Invoice does not exist on PO.
- `price_mismatch`: Invoice unit rate differs from SKU Master `agreedRate` by more than `priceTolerance` (5%).
- `mrp_mismatch`: Invoice/GRN MRP differs from SKU Master `mrp` by >1%.
- `unmapped_master_sku`: Item code could not be resolved to any `SkuMaster` record.

### Status Hierarchy
1. `insufficient_documents`: Missing PO, GRN, or Invoice (incomplete set).
2. `mismatch`: Any hard violation (`*_qty_exceeds_*`, `invoice_date_after_po_date`, `duplicate_*`, `item_missing_in_po`).
3. `partially_matched`: No hard violations, but soft warnings exist (`price_mismatch`, `mrp_mismatch`, `unmapped_master_sku`).
4. `matched`: Fully reconciled across all three documents.

---

## 5. Key Features

- **Out-of-Order Upload Robustness**: Documents are linked by string `poNumber` without requiring foreign keys. An Invoice or GRN can be uploaded before the PO exists.
- **Dynamic Recomputation**: `GET /api/match/:poNumber` recomputes the status on every request. Adding a new `SkuMaster` record automatically updates subsequent match calculations without stale cache.
- **Embedded Document Preview**: Right-column PDF preview pane with zoom controls (`-`, `%`, `+`) using `/api/documents/:id/file`.
- **SKU Master CRUD UI**: Built-in management interface to view, create, edit, and delete catalogue entries.

---

## 6. Setup & Execution Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB running locally at `mongodb://localhost:27017/reconciliation` (or MongoDB Atlas URI)

### Environment Variables
Create `.env` inside `backend/`:
```env
MONGODB_URI=mongodb://localhost:27017/reconciliation
AUTH_TOKEN=reconciliation-bearer-token-dev
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_actual_gemini_api_key
```

### Installation & Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Initial SKU Master Catalogue**:
   ```bash
   npm run seed
   ```

3. **Start Backend Server** (Port 4000):
   - From root project directory:
     ```bash
     npm run backend
     ```
   - *Or* if inside `backend/` directory:
     ```bash
     npm start
     ```

4. **Start Frontend Dev Server** (Port 3000):
   ```bash
   npm run dev
   ```

5. Open browser at `http://localhost:3000`.

---

FRONTEND     = SHOWS SUMMARY, PREVIEWS & MISMATCH HIGHLIGHTS
```
