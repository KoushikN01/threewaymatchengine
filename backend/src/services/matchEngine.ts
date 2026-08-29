import type { Document } from 'mongoose'
import { Grn, Invoice, MatchAudit, PurchaseOrder, SkuMaster } from '../models/schemas'

export type MatchStatus = 'insufficient_documents' | 'matched' | 'partially_matched' | 'mismatch'

export type MatchReason =
  | 'missing_grn'
  | 'missing_invoice'
  | 'grn_qty_exceeds_po_qty'
  | 'invoice_qty_exceeds_grn_qty'
  | 'invoice_qty_exceeds_po_qty'
  | 'invoice_date_after_po_date'
  | 'duplicate_po'
  | 'duplicate_document'
  | 'item_missing_in_po'
  | 'price_mismatch'
  | 'mrp_mismatch'
  | 'unmapped_master_sku'

const HARD_REASONS = new Set<MatchReason>([
  'grn_qty_exceeds_po_qty', 'invoice_qty_exceeds_grn_qty', 'invoice_qty_exceeds_po_qty',
  'invoice_date_after_po_date', 'duplicate_po', 'duplicate_document', 'item_missing_in_po',
])

const round = (value: number) => Math.round(value * 100) / 100
const keyOf = (item: { skuMasterId?: unknown; itemCode?: string; description?: string }) =>
  item.skuMasterId ? String(item.skuMasterId) : (item.itemCode || item.description || '').toLowerCase().trim()

export async function calculateMatch(po: any, grn: any | null, invoice: any | null, duplicatePo = false, duplicateDocument = false, skus: any[] = []) {
  const reasons = new Set<MatchReason>()
  const lineResults: any[] = []

  if (!po) return { status: 'insufficient_documents' as MatchStatus, reasons: ['missing_po'], lineResults: [], summary: emptySummary() }
  if (!grn) reasons.add('missing_grn')
  if (!invoice) reasons.add('missing_invoice')
  if (duplicatePo) reasons.add('duplicate_po')
  if (duplicateDocument) reasons.add('duplicate_document')

  // Build lookup map for SkuMaster records by skuErpCode and eanCode
  const skuMapByCode = new Map<string, any>()
  for (const master of skus) {
    if (master.skuErpCode) skuMapByCode.set(master.skuErpCode.trim().toLowerCase(), master)
    if (master.eanCode) skuMapByCode.set(master.eanCode.trim().toLowerCase(), master)
  }

  // Helper to dynamically resolve item to SkuMaster
  const resolveItemMaster = (item: any) => {
    if (!item) return null
    if (item.skuMasterId) {
      const found = skus.find((s) => String(s._id) === String(item.skuMasterId))
      if (found) return found
    }
    const rawCode = (item.itemCode || '').trim().toLowerCase()
    const rawEan = (item.eanCode || '').trim().toLowerCase()
    const tokens = [rawCode, rawCode.split(/\s+/)[0], rawEan, rawEan.split(/\s+/)[0]].filter(Boolean)
    for (const tok of tokens) {
      if (skuMapByCode.has(tok)) return skuMapByCode.get(tok)
    }
    return null
  }

  // Group line items by resolved SKU Master ID (or normalized itemCode if unmapped)
  interface AggregatedGroup {
    skuMaster: any | null
    itemCode: string
    description: string
    poLines: any[]
    grnLines: any[]
    invoiceLines: any[]
    orderedQty: number
    receivedQty: number
    billedQty: number
    hasGrnLine: boolean
    hasInvoiceLine: boolean
    hasPoLine: boolean
  }

  const groups = new Map<string, AggregatedGroup>()

  const getGroupKey = (item: any) => {
    const master = resolveItemMaster(item)
    if (master?._id) return `master:${master._id}`
    const raw = (item.itemCode || item.eanCode || item.description || '').trim().toLowerCase()
    return `raw:${raw}`
  }

  // Aggregate PO items
  for (const item of po.items ?? []) {
    const key = getGroupKey(item)
    const master = resolveItemMaster(item)
    if (!groups.has(key)) {
      groups.set(key, {
        skuMaster: master,
        itemCode: master?.skuErpCode || item.itemCode || '—',
        description: master?.name || item.description || 'Item',
        poLines: [],
        grnLines: [],
        invoiceLines: [],
        orderedQty: 0,
        receivedQty: 0,
        billedQty: 0,
        hasGrnLine: false,
        hasInvoiceLine: false,
        hasPoLine: true,
      })
    }
    const grp = groups.get(key)!
    grp.poLines.push(item)
    grp.orderedQty += Number(item.quantity ?? 0)
  }

  // Aggregate GRN items
  if (grn?.items) {
    for (const item of grn.items) {
      const key = getGroupKey(item)
      const master = resolveItemMaster(item)
      if (!groups.has(key)) {
        groups.set(key, {
          skuMaster: master,
          itemCode: master?.skuErpCode || item.itemCode || '—',
          description: master?.name || item.description || 'Item',
          poLines: [],
          grnLines: [],
          invoiceLines: [],
          orderedQty: 0,
          receivedQty: 0,
          billedQty: 0,
          hasGrnLine: true,
          hasInvoiceLine: false,
          hasPoLine: false,
        })
      }
      const grp = groups.get(key)!
      grp.hasGrnLine = true
      grp.grnLines.push(item)
      grp.receivedQty += Number(item.receivedQuantity ?? 0)
    }
  }

  // Aggregate Invoice items
  if (invoice?.items) {
    for (const item of invoice.items) {
      const key = getGroupKey(item)
      const master = resolveItemMaster(item)
      if (!groups.has(key)) {
        groups.set(key, {
          skuMaster: master,
          itemCode: master?.skuErpCode || item.itemCode || '—',
          description: master?.name || item.description || 'Item',
          poLines: [],
          grnLines: [],
          invoiceLines: [],
          orderedQty: 0,
          receivedQty: 0,
          billedQty: 0,
          hasGrnLine: false,
          hasInvoiceLine: true,
          hasPoLine: false,
        })
      }
      const grp = groups.get(key)!
      grp.hasInvoiceLine = true
      grp.invoiceLines.push(item)
      grp.billedQty += Number(item.quantity ?? 0)
    }
  }

  // Evaluate line item rules
  for (const [key, group] of groups.entries()) {
    const lineReasons: MatchReason[] = []

    if (!group.hasPoLine && (group.hasGrnLine || group.hasInvoiceLine)) {
      lineReasons.push('item_missing_in_po')
      reasons.add('item_missing_in_po')
    }

    if (!group.skuMaster) {
      lineReasons.push('unmapped_master_sku')
      reasons.add('unmapped_master_sku')
    }

    if (group.hasGrnLine && group.receivedQty > group.orderedQty) {
      lineReasons.push('grn_qty_exceeds_po_qty')
      reasons.add('grn_qty_exceeds_po_qty')
    }

    if (group.hasInvoiceLine && group.hasGrnLine && group.billedQty > group.receivedQty) {
      lineReasons.push('invoice_qty_exceeds_grn_qty')
      reasons.add('invoice_qty_exceeds_grn_qty')
    }

    if (group.hasInvoiceLine && group.hasPoLine && group.billedQty > group.orderedQty) {
      lineReasons.push('invoice_qty_exceeds_po_qty')
      reasons.add('invoice_qty_exceeds_po_qty')
    }

    const firstInvoiceItem = group.invoiceLines[0]
    const agreedRate = Number(group.skuMaster?.agreedRate ?? firstInvoiceItem?.agreedRate)
    const unitRate = Number(firstInvoiceItem?.unitRate ?? firstInvoiceItem?.rate)
    const tolerance = Number(group.skuMaster?.priceTolerance ?? 0.05)

    if (firstInvoiceItem && Number.isFinite(agreedRate) && Number.isFinite(unitRate) && agreedRate > 0 && Math.abs(unitRate - agreedRate) / agreedRate > tolerance) {
      lineReasons.push('price_mismatch')
      reasons.add('price_mismatch')
    }

    const masterMrp = Number(group.skuMaster?.mrp ?? group.poLines[0]?.mrp)
    const invoiceMrp = Number(firstInvoiceItem?.mrp ?? group.grnLines[0]?.mrp)
    if (firstInvoiceItem && Number.isFinite(masterMrp) && Number.isFinite(invoiceMrp) && masterMrp > 0 && Math.abs(invoiceMrp - masterMrp) / masterMrp > 0.01) {
      lineReasons.push('mrp_mismatch')
      reasons.add('mrp_mismatch')
    }

    lineResults.push({
      key,
      itemCode: group.itemCode,
      description: group.description,
      skuMasterId: group.skuMaster?._id || null,
      ordered: group.orderedQty,
      received: group.hasGrnLine ? group.receivedQty : null,
      billed: group.hasInvoiceLine ? group.billedQty : null,
      variance: group.hasInvoiceLine && group.hasGrnLine ? round(group.billedQty - group.receivedQty) : null,
      reasons: [...new Set(lineReasons)],
    })
  }

  if (invoice && po && new Date(invoice.invoiceDate) > new Date(po.poDate)) {
    reasons.add('invoice_date_after_po_date')
  }

  const reasonList = [...reasons]
  const hardMismatch = reasonList.some((reason) => HARD_REASONS.has(reason))
  const softWarnings = reasonList.some((reason) => !HARD_REASONS.has(reason))
  const quantitiesFullyReconciled = lineResults.every((line) => line.received === line.ordered && line.billed === line.ordered)

  const status: MatchStatus = (!grn || !invoice)
    ? 'insufficient_documents'
    : hardMismatch
    ? 'mismatch'
    : (softWarnings || !quantitiesFullyReconciled)
    ? 'partially_matched'
    : 'matched'

  const summary = {
    totalItems: lineResults.length,
    matchedItems: lineResults.filter((line) => line.reasons.length === 0).length,
    partialItems: lineResults.filter((line) => line.reasons.length > 0 && line.reasons.every((reason: MatchReason) => !HARD_REASONS.has(reason))).length,
    unmappedItems: lineResults.filter((line) => line.reasons.includes('unmapped_master_sku')).length,
    quantityMismatches: lineResults.filter((line) => line.reasons.some((reason: MatchReason) => reason.includes('qty_'))).length,
    priceMismatches: lineResults.filter((line) => line.reasons.includes('price_mismatch')).length,
  }

  return { status, reasons: reasonList, lineResults, summary }
}

function emptySummary() { return { totalItems: 0, matchedItems: 0, partialItems: 0, unmappedItems: 0, quantityMismatches: 0, priceMismatches: 0 } }

export async function getMatchForPo(poNumber: string) {
  const [po, grn, invoice, poCount, grnCount, invoiceCount, skus] = await Promise.all([
    PurchaseOrder.findOne({ poNumber }).lean(),
    Grn.findOne({ poNumber }).sort({ uploadedAt: -1 }).lean(),
    Invoice.findOne({ poNumber }).sort({ uploadedAt: -1 }).lean(),
    PurchaseOrder.countDocuments({ poNumber }),
    Grn.countDocuments({ poNumber }),
    Invoice.countDocuments({ poNumber }),
    SkuMaster.find().lean(),
  ])
  const result = await calculateMatch(po, grn, invoice, poCount > 1, grnCount > 1 || invoiceCount > 1, skus)
  await MatchAudit.findOneAndUpdate({ poNumber }, { ...result, computedAt: new Date() }, { upsert: true, returnDocument: 'after' })
  return { poNumber, documents: { po, grn, invoice }, ...result }
}

export function reasonLabel(reason: string) { return reason.replaceAll('_', ' ') }
export function isHardReason(reason: string) { return HARD_REASONS.has(reason as MatchReason) }
export { emptySummary }
