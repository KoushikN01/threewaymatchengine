# Three-Way Match Engine for PO, GRN, and Invoice

A full-stack procurement reconciliation application that automatically
compares Purchase Orders (PO), Goods Receipt Notes (GRN), and Invoices
to identify quantity, price, MRP, date, duplicate, and product-mapping
discrepancies.

The application uses Next.js, Node.js/Express, MongoDB/Mongoose, and
Google Gemini API for document extraction.

---

## 1. What Is This Project?

In simple terms, this application is a digital checker for purchase
documents.

When a company buys products, three important documents are involved:

### Purchase Order (PO)

**"What did we order?"**

The PO contains the products the company wants to buy, the quantities,
agreed rates, and other purchase details.

### Goods Receipt Note (GRN)

**"What did we actually receive?"**

The GRN is created when the warehouse receives the products. It records
the quantities that actually arrived.

### Invoice

**"What is the supplier asking us to pay?"**

The invoice is the bill containing the products and amounts that the
supplier expects to be paid.

### SKU Master

**"Which product is this?"**

The SKU Master is the application's product catalogue. It helps identify
when different item codes in different documents actually represent the
same product.

### Three-Way Match Engine

**"Do the PO, GRN, and Invoice agree?"**

The matching engine compares the three documents and identifies
discrepancies before payment/reconciliation.

---

## 2. Why Is This Needed?

Manually comparing hundreds of purchase documents can be slow and
error-prone.

For example:

```text
PO:
Ordered = 100 units

GRN:
Received = 80 units

Invoice:
Billed = 100 units
