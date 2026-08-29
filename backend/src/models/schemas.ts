import mongoose from 'mongoose'

/**
 * SKU Master schema: canonical product catalogue.
 * Maps products across different document representations to a single identity.
 */
const skuMasterSchema = new mongoose.Schema(
  {
    skuErpCode: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    eanCode: { type: String, sparse: true, index: true },
    hsnCode: { type: String },
    uom: { type: String, default: 'PKT' },
    agreedRate: { type: Number, required: true },
    mrp: { type: Number },
    priceTolerance: { type: Number, default: 0.05 },
  },
  { timestamps: true }
)

/**
 * Purchase Order schema.
 * Stores what the company ordered.
 */
const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, index: true },
    poDate: { type: Date, required: true },
    vendorName: { type: String, required: true },
    expectedDelivery: { type: Date },
    expiryDate: { type: Date },
    items: [
      {
        itemCode: String,
        description: String,
        quantity: Number,
        uom: String,
        rate: Number,
        mrp: Number,
        skuMasterId: mongoose.Schema.Types.ObjectId,
        _id: false,
      },
    ],
    rawParsed: mongoose.Schema.Types.Mixed,
    originalFilePath: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

/**
 * Goods Receipt Note schema.
 * Stores what was actually received at the warehouse.
 */
const grnSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, index: true },
    poNumber: { type: String, required: true, index: true },
    grnDate: { type: Date, required: true },
    inboundNumber: String,
    invoiceNumber: String,
    items: [
      {
        itemCode: String,
        description: String,
        receivedQuantity: Number,
        expectedQuantity: Number,
        uom: String,
        lotNumber: String,
        mrp: Number,
        rate: Number,
        skuMasterId: mongoose.Schema.Types.ObjectId,
        _id: false,
      },
    ],
    rawParsed: mongoose.Schema.Types.Mixed,
    originalFilePath: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

/**
 * Invoice schema.
 * Stores what the vendor is asking to be paid for.
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, index: true },
    poNumber: { type: String, required: true, index: true },
    invoiceDate: { type: Date, required: true },
    vendorName: String,
    items: [
      {
        itemCode: String,
        description: String,
        quantity: Number,
        uom: String,
        unitRate: Number,
        mrp: Number,
        skuMasterId: mongoose.Schema.Types.ObjectId,
        _id: false,
      },
    ],
    totalAmount: Number,
    taxAmount: Number,
    rawParsed: mongoose.Schema.Types.Mixed,
    originalFilePath: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

/**
 * Match Audit schema.
 * Records the processing history and results for a PO's reconciliation.
 */
const matchAuditSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['insufficient_documents', 'matched', 'partially_matched', 'mismatch'],
      default: 'insufficient_documents',
    },
    reasons: [String],
    steps: [
      {
        step: String,
        status: { type: String, enum: ['success', 'warning', 'error'] },
        message: String,
        at: { type: Date, default: Date.now },
      },
    ],
    summary: {
      totalItems: Number,
      matchedItems: Number,
      partialItems: Number,
      unmappedItems: Number,
      quantityMismatches: Number,
      priceMismatches: Number,
    },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

/**
 * Export models with readable names and proper typing.
 */
export const SkuMaster = mongoose.model('SkuMaster', skuMasterSchema)
export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema)
export const Grn = mongoose.model('Grn', grnSchema)
export const Invoice = mongoose.model('Invoice', invoiceSchema)
export const MatchAudit = mongoose.model('MatchAudit', matchAuditSchema)

/**
 * Type exports for server actions and controllers.
 */
export type SkuMasterDoc = mongoose.InferSchemaType<typeof skuMasterSchema>
export type PurchaseOrderDoc = mongoose.InferSchemaType<typeof purchaseOrderSchema>
export type GrnDoc = mongoose.InferSchemaType<typeof grnSchema>
export type InvoiceDoc = mongoose.InferSchemaType<typeof invoiceSchema>
export type MatchAuditDoc = mongoose.InferSchemaType<typeof matchAuditSchema>
