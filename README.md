# Three-Way Match Engine for PO, GRN, and Invoice

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black?logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-4.x-lightgrey?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?logo=mongodb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Gemini AI](https://img.shields.io/badge/Google_Gemini-API-orange?logo=google)

A full-stack procurement reconciliation application that automatically compares **Purchase Orders (PO)**, **Goods Receipt Notes (GRN)**, and **Invoices** to identify quantity, price, MRP, date, duplicate, and product-mapping discrepancies.

Built using:
- **Next.js** & **React** (Frontend UI)
- **Node.js** & **Express.js** (Backend API)
- **MongoDB** & **Mongoose** (Database Persistence)
- **Google Gemini API** (AI Document Understanding & Extraction)
- **TypeScript** (End-to-End Type Safety)
- **REST APIs** (Decoupled Architecture)

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [What Does Three-Way Matching Mean?](#2-what-does-three-way-matching-mean)
3. [Why Is This Project Necessary?](#3-why-is-this-project-necessary)
4. [Main Objective](#4-main-objective)
5. [How the Application Works](#5-how-the-application-works)
6. [Technologies Used](#6-technologies-used)
7. [Matching Rules](#7-matching-rules)
8. [Result Statuses](#8-result-statuses)
9. [SKU Master](#9-sku-master)
10. [Dashboard](#10-dashboard)
11. [Screenshots](#11-screenshots)
12. [API Endpoints](#12-api-endpoints)
13. [SKU Master APIs](#13-sku-master-apis)
14. [Workspace Reset](#14-workspace-reset)
15. [API Testing With Postman](#15-api-testing-with-postman)
16. [Important Functional Test Cases](#16-important-functional-test-cases)
17. [Out-of-Order Upload](#17-out-of-order-upload)
18. [Dynamic Reconciliation](#18-dynamic-reconciliation)
19. [Document Preview](#19-document-preview)
20. [Project Structure](#20-project-structure)
21. [Setup Requirements](#21-setup-requirements)
22. [Environment Variables](#22-environment-variables)
23. [Installation](#23-installation)
24. [Seed SKU Master](#24-seed-sku-master)
25. [Start the Backend](#25-start-the-backend)
26. [Start the Frontend](#26-start-the-frontend)
27. [End-to-End Usage](#27-end-to-end-usage)
28. [What the User Gets From the Application](#28-what-the-user-gets-from-the-application)
29. [Key Design Decisions](#29-key-design-decisions)
30. [Assessment-Focused Implementation](#30-assessment-focused-implementation)
31. [Limitations](#31-limitations)
32. [Summary](#32-summary)

---

## 1. What Is This Project?

Think of this application as a **digital checker for purchase documents**.

When a company buys products, three important documents are involved:

### Purchase Order (PO)
**"What did we order?"**
The PO is created when the company decides to purchase products. It contains:
- Product details
- Quantity ordered
- Agreed price & MRP
- PO number & PO date

---

### Goods Receipt Note (GRN)
**"What did we actually receive?"**
The GRN is created when the products arrive at the warehouse. It records how many products actually arrived.

```text
PO says:       100 units ordered
GRN says:       80 units received

The system can identify that the complete quantity was not received.
```

---

### Invoice
**"What are we being asked to pay?"**
The Invoice is the bill provided by the seller. It contains:
- Invoice number & Invoice date
- PO number
- Products & Quantities
- Unit prices & Tax/Amount information

---

### SKU Master
**"Which product is this?"**
The SKU Master is the application's canonical product catalogue. It helps the system identify the same product even when different product codes are present in different documents.

```text
Vendor Code  ──►  SKU Master  ──►  Canonical Product
```
This helps the matching engine compare the correct products across documents.

---

## 2. What Does Three-Way Matching Mean?

Three-way matching simply means comparing the PO, GRN, and Invoice against each other to ensure financial and operational accuracy.

```text
       PO ("What did we order?")
                   │
                   ▼
      GRN ("What did we receive?")
                   │
                   ▼
   Invoice ("What are we billed for?")
                   │
                   ▼
     ┌───────────────────────────┐
     │   Three-Way Match Engine  │
     └─────────────┬─────────────┘
                   │
                   ▼
  MATCH / MISMATCH / PARTIAL / INCOMPLETE
```

### Examples

**Scenario A — Exact Agreement:**
```text
PO       = 100 units
GRN      = 100 units
Invoice  = 100 units

Result   = MATCHED
```

**Scenario B — Discrepancy Detected:**
```text
PO       = 100 units
GRN      = 80 units
Invoice  = 100 units

Result   = MISMATCH / REQUIRES REVIEW
```

The purpose is to identify these differences automatically instead of checking every document manually.

---

## 3. Why Is This Project Necessary?

In a real company, many purchase documents are processed every day. Manually checking them can be:
- **Time-consuming**
- **Difficult to scale**
- **Prone to human mistakes**
- **Difficult to audit**

> [!WARNING]
> **Financial Risk Example:**
> Imagine a PO orders 100 products, GRN receives 80 products, but the supplier invoices 100 products. Without careful manual verification, the company would overpay for 20 items never received. This application acts as an automated reconciliation checkpoint before payments are approved.

---

## 4. Main Objective

The main objective of this project is to:
1. Upload PO, GRN, and Invoice documents (PDF or Images).
2. Extract structured information using AI.
3. Store and validate extracted information in a database.
4. Identify and map products using the SKU Master catalog.
5. Compare ordered, received, and billed quantities.
6. Compare prices and MRP values against agreed rates.
7. Check document date sequences.
8. Detect duplicate documents (PO, GRN, Invoice).
9. Detect missing or unmapped products across documents.
10. Display clear reconciliation summaries and highlight exceptions to users.
11. Provide production-ready REST API endpoints for integration and testing.

---

## 5. How the Application Works

### Complete System Architecture & Data Flow

```text
┌──────────────┐
│  User Upload │ (PDF / Image)
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│  Document Upload API    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Google Gemini API     │ (Extracts structured JSON data)
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Validation & Sanitation │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   MongoDB Storage       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ SKU Master Resolution   │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Three-Way Match Engine  │ (Deterministic backend business rules)
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Reconciliation Result   │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Next.js Dashboard     │
└─────────────────────────┘
```

> [!IMPORTANT]
> **Core Design Principle: Gemini extracts. Backend checks.**
> Gemini is strictly used to read uploaded documents and extract structured JSON data. The final matching decision is executed by deterministic backend business logic. This prevents AI hallucination from directly influencing financial matching decisions.

---

## 6. Technologies Used

### Frontend
- **Next.js & React**: Component-based modern UI architecture.
- **TypeScript**: Static typing for components and state.
- **Tailwind CSS**: Modern responsive styling and dark/light UI design.

### Backend
- **Node.js & Express.js**: High-performance RESTful API endpoints.
- **TypeScript**: Backend type safety for models, services, and routes.
- **Multer**: Handling multipart/form-data document uploads.

### Database
- **MongoDB + Mongoose**: Document storage for POs, GRNs, Invoices, SKU Masters, and raw extractions.

### AI / Document Extraction
- **Google Gemini API**: Multimodal document understanding to convert raw document images/PDFs into structured JSON schemas.
  - **Primary Model**: `gemini-3.5-flash` / `gemini-3.6-flash`
  - **Fallback Model**: `gemini-3.5-flash-lite`
  - **Resilience**: Features automatic retry on rate limits, quota fallback switching, and a local deterministic parser backup.

---

## 7. Matching Rules

The backend matching engine evaluates multiple rule sets deterministically:

### 1. Quantity Checks
- **GRN Qty Exceeds PO Qty**: Received Quantity > Ordered Quantity  
  `reason: grn_qty_exceeds_po_qty`
- **Invoice Qty Exceeds GRN Qty**: Invoiced Quantity > Received Quantity  
  `reason: invoice_qty_exceeds_grn_qty`
- **Invoice Qty Exceeds PO Qty**: Invoiced Quantity > Ordered Quantity  
  `reason: invoice_qty_exceeds_po_qty`

### 2. Date Check
- **Invoice Date After PO Date**: Invoice Date must not be earlier than PO Date  
  `reason: invoice_date_after_po_date`

### 3. Duplicate Document Checks
- **Duplicate PO**: Multiple POs uploaded with the same PO Number  
  `reason: duplicate_po`
- **Duplicate Document**: Multiple GRNs or Invoices uploaded under the same document number  
  `reason: duplicate_document`

### 4. Missing Item Check
- **Missing Item in PO**: Item present in GRN or Invoice but absent from PO  
  `reason: item_missing_in_po`

### 5. Price & MRP Checks
- **Price Mismatch**: Invoice rate differs from SKU Master agreed rate beyond tolerance  
  `reason: price_mismatch`
- **MRP Mismatch**: MRP on document differs from SKU Master MRP  
  `reason: mrp_mismatch`

### 6. Product Mapping Check
- **Unmapped SKU**: Item cannot be mapped to the canonical product catalogue  
  `reason: unmapped_master_sku`

---

## 8. Result Statuses

The matching engine generates one of four overall reconciliation statuses:

| Status | Description | Example |
|---|---|---|
| `INSUFFICIENT DOCUMENTS` | Complete document set (PO + GRN + Invoice) is not yet uploaded. | PO ✓, GRN ✗, Invoice ✗ |
| `MISMATCH` | A hard matching rule is violated (e.g., received > ordered, invoice > received). | PO = 100, GRN = 120, Invoice = 120 |
| `PARTIALLY MATCHED` | Warning-level issues present, but no hard quantity violations (e.g., price difference, unmapped SKU). | Price mismatch or MRP variance |
| `MATCHED` | All documents present and all quantities, prices, dates, and SKUs align perfectly. | PO = 100, GRN = 100, Invoice = 100 |

---

## 9. SKU Master

The SKU Master serves as the canonical product catalog for resolving vendor-specific codes and descriptions.

### Schema Fields
| Field | Type | Description |
|---|---|---|
| `skuId` | String | Unique SKU ID |
| `erpCode` | String | Internal ERP product identifier |
| `productName` | String | Canonical product name |
| `vendorCode` | String | Vendor / EAN barcode reference |
| `hsnCode` | String | Tax classification code |
| `uom` | String | Unit of Measurement (e.g., PCS, KG, BOX) |
| `agreedRate` | Number | Expected agreed unit purchase rate |
| `mrp` | Number | Maximum Retail Price |

The management UI allows users to **View**, **Add**, **Edit**, and **Delete** SKU records seamlessly.

---

## 10. Dashboard

The main reconciliation dashboard provides a unified workspace to inspect purchase orders:
- **Overall Reconciliation Status Badge** (`MATCHED`, `MISMATCH`, `PARTIALLY MATCHED`, `INSUFFICIENT DOCUMENTS`)
- **Document Completeness Progress Tracker** (e.g., 3 / 3 Documents)
- **Purchase Order Value Summary**
- **Document Tabs**: Purchase Order (PO), Fulfillment (Invoice), Delivery (GRN), SKU Master
- **Reconciliation Exceptions Banner**: Clear listing of all triggered flags and reasons
- **Line-Item Comparison Matrix**: Side-by-side comparison of ordered vs. received vs. billed quantities and rates
- **Original Document Viewer**: Embedded PDF/Image preview alongside extracted details

---

## 11. Screenshots

Here are visual previews of the main working application screens:

### 1. Authentication Screen
*Simple and secure bearer-token authentication interface.*

![Login](docs/screenshots/01-login.png)

---

### 2. Reconciliation Dashboard
*Unified workspace displaying overall reconciliation status, PO value, document completeness, and action summaries.*

![Reconciliation Dashboard](docs/screenshots/02-dashboard.png)

---

### 3. Purchase Order (PO) View
*Extracted PO metadata, vendor details, and ordered line-item specifications.*

![Purchase Order View](docs/screenshots/03-purchase-order.png)

---

### 4. Fulfillment (Invoice) View
*Extracted Invoice details, side-by-side original document viewer, and line-level billing checks.*

![Fulfillment Invoice View](docs/screenshots/04-fulfillment-invoice.png)

---

### 5. Delivery (GRN) View
*Goods Receipt Note details and actual quantities received at the warehouse.*

![Delivery GRN View](docs/screenshots/05-delivery-grn.png)

---

### 6. Discrepancy & Mismatch Highlight View
*Automatic detection and inline visual highlighting of reconciliation exceptions.*

![Reconciliation Mismatch View](docs/screenshots/06-reconciliation-mismatch.png)

---

### 7. SKU Master Management
*Canonical SKU catalog management with CRUD controls for agreed rates, vendor codes, and MRP values.*

![SKU Master Management](docs/screenshots/08-sku-master.png)

---

## 12. API Endpoints

The backend provides a complete set of RESTful APIs.

**Base URL**: `http://localhost:4000/api`  
**Authentication Header**: `Authorization: Bearer reconciliation-bearer-token-dev`

### Authentication & Health
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Returns authentication token |
| `GET` | `/api/health` | Backend service health check |

### Document Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Upload PDF/Image (`multipart/form-data`: `file`, `documentType` = `po` \| `grn` \| `invoice`) |
| `GET` | `/api/documents` | List documents (optional filters: `?type=po&poNumber=PO-1001`) |
| `GET` | `/api/documents/:id` | Get document metadata & extracted structured JSON |
| `GET` | `/api/documents/:id/file` | View original uploaded PDF or image file |

### Matching & Summary
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/match/:poNumber` | Runs deterministic 3-way reconciliation for target PO |
| `GET` | `/api/summary/:poNumber` | Returns aggregated reconciliation summary |

---

## 13. SKU Master APIs

| Method | Endpoint | Description | Request Body Example |
|---|---|---|---|
| `GET` | `/api/masters/sku` | List all SKU Master records | N/A |
| `POST` | `/api/masters/sku` | Create new SKU record | `{ "erpCode": "SKU-001", "productName": "Widget A", "vendorCode": "V-001", "agreedRate": 100, "mrp": 120 }` |
| `PATCH` | `/api/masters/sku/:skuId` | Update SKU record | `{ "agreedRate": 105 }` |
| `DELETE` | `/api/masters/sku/:skuId` | Delete SKU record | N/A |

---

## 14. Workspace Reset

Reset the system state for testing fresh reconciliations:

```http
POST /api/documents/reset
Authorization: Bearer reconciliation-bearer-token-dev
```

This clears uploaded document data, enabling fresh end-to-end test execution.

---

## 15. API Testing With Postman

Recommended sequential flow for testing the APIs independently via Postman:

```text
 1. Login (POST /api/auth/login)
        ↓
 2. Health Check (GET /api/health)
        ↓
 3. Upload Purchase Order (POST /api/documents/upload [documentType=po])
        ↓
 4. Upload Goods Receipt Note (POST /api/documents/upload [documentType=grn])
        ↓
 5. Upload Invoice (POST /api/documents/upload [documentType=invoice])
        ↓
 6. List Documents (GET /api/documents)
        ↓
 7. Get Document Details (GET /api/documents/:id)
        ↓
 8. View Original Document (GET /api/documents/:id/file)
        ↓
 9. Run Three-Way Match Engine (GET /api/match/:poNumber)
        ↓
10. Get Reconciliation Summary (GET /api/summary/:poNumber)
        ↓
11. Manage SKU Master APIs (GET/POST/PATCH/DELETE /api/masters/sku)
        ↓
12. Reset Workspace (POST /api/documents/reset)
```

---

## 16. Important Functional Test Cases

Below are the 10 core verification test cases:

| Test Case | Scenario | Uploaded Documents / Input | Expected Result / Status |
|---|---|---|---|
| **TC 1** | Complete Document Set | PO ✓, GRN ✓, Invoice ✓ | `Document Completeness = 3 of 3`, Match calculated |
| **TC 2** | Missing GRN | PO ✓, GRN ✗, Invoice ✓ | Status: `INSUFFICIENT DOCUMENTS` |
| **TC 3** | Missing Invoice | PO ✓, GRN ✓, Invoice ✗ | Status: `INSUFFICIENT DOCUMENTS` |
| **TC 4** | Received Qty Exceeds Ordered | PO = 100, GRN = 120 | Flag: `grn_qty_exceeds_po_qty` (MISMATCH) |
| **TC 5** | Invoiced Qty Exceeds Received | GRN = 80, Invoice = 100 | Flag: `invoice_qty_exceeds_grn_qty` (MISMATCH) |
| **TC 6** | Invoiced Qty Exceeds Ordered | PO = 100, Invoice = 120 | Flag: `invoice_qty_exceeds_po_qty` (MISMATCH) |
| **TC 7** | Price Mismatch | SKU Agreed Rate = ₹100, Invoice Rate = ₹120 | Flag: `price_mismatch` (PARTIALLY MATCHED) |
| **TC 8** | Unmapped SKU | Item cannot be resolved in SKU Master | Flag: `unmapped_master_sku` (PARTIALLY MATCHED) |
| **TC 9** | Duplicate Document | Upload same invoice number twice | Flag: `duplicate_document` |
| **TC 10** | Missing Item from PO | Item present in GRN/Invoice but absent in PO | Flag: `item_missing_in_po` |

---

## 17. Out-of-Order Upload

The system supports **asynchronous out-of-order document uploads**.

```text
Invoice Uploaded First  ──►  GRN Uploaded Second  ──►  PO Uploaded Last
```

Documents are dynamically linked using the **PO Number**. Once all documents become available, the engine computes the complete reconciliation automatically.

---

## 18. Dynamic Reconciliation

Reconciliation statuses are calculated dynamically on-demand:
- Uploading a missing document triggers recalculation from `INSUFFICIENT DOCUMENTS` to `MATCHED` or `MISMATCH`.
- Updating a SKU Master record immediately updates subsequent reconciliation price and mapping checks.

---

## 19. Document Preview

The application features an embedded PDF and image viewer. Users can view the original uploaded file directly alongside the Gemini-extracted JSON data and rule validation flags in the same window.

---

## 20. Project Structure

```text
three-way/
├── app/                        # Next.js App Router (Frontend Pages & UI)
│   ├── layout.tsx              # Root Layout
│   ├── page.tsx                # Main Reconciliation Dashboard
│   └── sku-master/             # SKU Master Management Page
├── backend/                    # Node.js + Express Backend
│   ├── src/
│   │   ├── middleware/         # Auth & Multer Middleware
│   │   ├── models/             # Mongoose Schemas (PO, GRN, Invoice, SKU)
│   │   ├── routes/             # REST Express Route Handlers
│   │   ├── services/           # Gemini Extractor & Match Engine Services
│   │   ├── seed.ts             # SKU Master Seed Script
│   │   └── server.ts           # Express Application Server Entrypoint
│   └── .env.example            # Environment Variable Template
├── components/                 # React UI Components
│   ├── DocumentPreview.tsx     # Original Document PDF/Image Viewer
│   ├── LineItemComparison.tsx # Side-by-side reconciliation matrix
│   ├── ReconciliationSummary.tsx # Status summary banner
│   └── SkuMasterModal.tsx      # SKU CRUD Dialog Modal
├── docs/
│   └── screenshots/            # Embedded Documentation Screenshots
│       ├── 01-login.png
│       ├── 02-dashboard.png
│       ├── 03-purchase-order.png
│       ├── 04-fulfillment-invoice.png
│       ├── 05-delivery-grn.png
│       ├── 06-reconciliation-mismatch.png
│       ├── 07-insufficient-documents.png
│       └── 08-sku-master.png
├── lib/                        # Frontend Utilities & API Client Helpers
├── screenshots/                # Root Screenshot Copy
├── .env.example                # Root Environment File Template
├── package.json                # Project Dependencies & Scripts
└── README.md                   # Application Documentation
```

---

## 21. Setup Requirements

Ensure you have the following installed locally:
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017/reconciliation`) or MongoDB Atlas
- **npm** or **pnpm**

---

## 22. Environment Variables

Create `backend/.env` from the provided `.env.example`:

```env
MONGODB_URI=mongodb://localhost:27017/reconciliation
AUTH_TOKEN=reconciliation-bearer-token-dev
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_PRIMARY_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
```

> [!CAUTION]
> **Security Note:** Never commit your actual `GEMINI_API_KEY` to public repositories. Keep it secure inside `backend/.env`.

---

## 23. Installation

From the project root directory, install dependencies:

```bash
npm install
```

If backend dependencies are managed separately:

```bash
cd backend
npm install
cd ..
```

---

## 24. Seed SKU Master

Populate initial canonical SKU Master data into MongoDB:

```bash
npm run seed
```

---

## 25. Start the Backend

Run the Express API server:

```bash
npm run backend
```

*Backend Server will run at*: `http://localhost:4000`

---

## 26. Start the Frontend

Run the Next.js development server:

```bash
npm run dev
```

*Frontend Application will run at*: `http://localhost:3000`

Open `http://localhost:3000` in your browser and enter the bearer token (`reconciliation-bearer-token-dev`) to log in.

---

## 27. End-to-End Usage

1. **Launch App**: Open `http://localhost:3000`.
2. **Authenticate**: Enter access token.
3. **Open Workspace**: Navigate to Reconciliation Dashboard.
4. **Upload PO**: Select and upload Purchase Order file.
5. **Upload GRN**: Upload Goods Receipt Note.
6. **Upload Invoice**: Upload Invoice document.
7. **AI Extraction**: System runs Gemini API extraction.
8. **SKU Resolution**: System maps items to canonical SKU Master catalogue.
9. **Rule Check**: Deterministic matching engine runs quantity, price, MRP, date, and duplicate rules.
10. **View Results**: Dashboard updates with reconciliation status (`MATCHED` / `MISMATCH` / `PARTIALLY MATCHED`).
11. **Review Discrepancies**: Inspect inline line-item variance highlights.
12. **Preview Document**: Open side-by-side original PDF/image preview.
13. **Manage SKU Master**: Add missing SKUs or update agreed rates if needed.

---

## 28. What the User Gets From the Application

Instead of manually reviewing raw documents:

```text
PO PDF  +  GRN PDF  +  Invoice PDF
```

The user gets a single, automated reconciliation workspace:

```text
┌─────────────────────────────────────────────────────────┐
│                    THREE-WAY MATCH                      │
├─────────────────────────────────────────────────────────┤
│   Overall Status:  MISMATCH / MATCHED / PARTIAL         │
├─────────────────────────────────────────────────────────┤
│   PO Metadata     │  Invoice Details │  GRN Details    │
├─────────────────────────────────────────────────────────┤
│   Line Item Comparison Matrix & Exception Warnings      │
├─────────────────────────────────────────────────────────┤
│   SKU Master Catalog  & Side-by-Side Original Document   │
└─────────────────────────────────────────────────────────┘
```

---

## 29. Key Design Decisions

1. **AI for Extraction**: Gemini handles document parsing, turning unstructured text into structured JSON.
2. **Deterministic Matching Engine**: Business rules are enforced strictly in TypeScript backend code to eliminate AI hallucinations in financial matching.
3. **MongoDB Persistence**: Stored extractions, SKUs, and match logs provide audit trails.
4. **PO Number Linking**: Connects documents asynchronously regardless of upload sequence.
5. **Dynamic On-Demand Calculation**: Re-computes status dynamically when new documents or SKUs are added.

---

## 30. Assessment-Focused Implementation

This implementation fulfills key reconciliation capabilities:
- Multimodal PO / GRN / Invoice upload & AI parsing
- Dynamic PO linkage
- Canonical SKU Master resolution & CRUD
- Quantity, Price, MRP, Date, and Duplicate checks
- Comprehensive exception flagging & UI highlighting
- Embedded PDF/Image document viewer
- Complete REST API suite with Postman verification flow

---

## 31. Limitations

- Gemini API extractions depend on API quota and uploaded document quality/legibility.
- Products missing from SKU Master require user review or manual entry.
- Requires active MongoDB database connection.

---

## 32. Summary

The Three-Way Match Engine replaces manual document checking with an automated digital workflow:

```text
     PO ("What we ordered") 
              + 
     GRN ("What we received") 
              + 
  Invoice ("What we were billed")
              │
              ▼
   Three-Way Match Engine ──► MATCHED / MISMATCH / PARTIAL
```

### Final Operational Principle

> **Gemini reads the documents.**  
> **The backend validates the data.**  
> **The matching engine applies the rules.**  
> **The dashboard explains the result to the user.**
