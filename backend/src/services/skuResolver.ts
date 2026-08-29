import { SkuMaster } from '../models/schemas'

export type RawLineItem = {
  itemCode?: string | null
  eanCode?: string | null
  description?: string | null
}

/** Resolves an extracted line to the canonical SKU Master record. */
export async function resolveSku(item: RawLineItem) {
  const rawCode = item.itemCode?.trim()
  const rawEan = item.eanCode?.trim()

  const codesToTry = [
    rawCode,
    rawCode ? rawCode.split(/\s+/)[0] : null,
    rawEan,
    rawEan ? rawEan.split(/\s+/)[0] : null,
  ].filter((c): c is string => Boolean(c && c.length >= 2))

  const uniqueCodes = [...new Set(codesToTry)]

  for (const c of uniqueCodes) {
    const esc = c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    const match = await SkuMaster.findOne({
      $or: [
        { skuErpCode: { $regex: new RegExp(`^${esc}$`, 'i') } },
        { eanCode: { $regex: new RegExp(`^${esc}$`, 'i') } },
        { name: { $regex: new RegExp(esc, 'i') } },
      ],
    }).lean()
    if (match) return match
  }

  if (item.description && item.description.trim().length >= 3) {
    const descWords = item.description.trim().split(/\s+/).filter((w) => w.length >= 3)
    if (descWords.length > 0) {
      const firstWordEsc = descWords[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const matchByName = await SkuMaster.findOne({
        name: { $regex: new RegExp(firstWordEsc, 'i') },
      }).lean()
      if (matchByName) return matchByName
    }
  }

  return null
}

export async function resolveItems<T extends RawLineItem>(items: T[]) {
  return Promise.all(
    items.map(async (item) => {
      const sku = await resolveSku(item)
      return { ...item, skuMasterId: sku?._id ?? null, skuName: sku?.name ?? null }
    }),
  )
}

export function isUnmapped(item: { skuMasterId?: unknown }) {
  return !item.skuMasterId
}

export function normalizedText(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function descriptionsLookRelated(left?: string | null, right?: string | null) {
  const a = normalizedText(left).split(' ').filter(Boolean)
  const b = new Set(normalizedText(right).split(' ').filter(Boolean))
  return a.length > 0 && a.filter((word) => b.has(word)).length >= Math.min(2, a.length)
}

export default { resolveSku, resolveItems, isUnmapped, descriptionsLookRelated }

export type ResolvedLineItem = Awaited<ReturnType<typeof resolveItems>>[number]

export function skuIdString(value: unknown) {
  return value ? String(value) : null
}

export function hasResolvedSku(item: { skuMasterId?: unknown }) {
  return Boolean(skuIdString(item.skuMasterId))
}

export function codeOrDescription(item: RawLineItem) {
  return item.itemCode?.trim() || item.description?.trim() || 'Unknown item'
}

export const SKU_RESOLUTION_ORDER = ['skuErpCode', 'eanCode'] as const

export function resolutionLabel(item: RawLineItem) {
  return item.itemCode ? 'ERP code' : item.eanCode ? 'EAN code' : 'unmapped'
}

export function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function percentageDifference(actual: number, expected: number) {
  if (expected === 0) return actual === 0 ? 0 : Infinity
  return Math.abs(actual - expected) / Math.abs(expected)
}

export function exceedsTolerance(actual: number, expected: number, tolerance: number) {
  return percentageDifference(actual, expected) > tolerance
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function buildUnmappedReason() {
  return 'unmapped_master_sku'
}

export function buildMissingReason(type: 'grn' | 'invoice') {
  return `missing_${type}`
}

export function buildQuantityReason(type: 'grn' | 'invoice', relation: 'po' | 'grn') {
  return `${type}_qty_exceeds_${relation}_qty`
}

export function buildPriceReason() {
  return 'price_mismatch'
}

export function buildMrpReason() {
  return 'mrp_mismatch'
}

export function buildDuplicateReason(type: 'po' | 'document') {
  return type === 'po' ? 'duplicate_po' : 'duplicate_document'
}

export function buildMissingItemReason() {
  return 'item_missing_in_po'
}

export function buildDateReason() {
  return 'invoice_date_after_po_date'
}

export function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function summarizeResolution(items: Array<{ skuMasterId?: unknown }>) {
  return { total: items.length, mapped: items.filter(hasResolvedSku).length, unmapped: items.filter(isUnmapped).length }
}

export function masterLookupKey(item: RawLineItem) {
  return item.itemCode?.trim() || item.eanCode?.trim() || normalizedText(item.description)
}

export function mergeResolution<T extends RawLineItem>(item: T, sku: { _id: unknown; name: string } | null) {
  return { ...item, skuMasterId: sku?._id ?? null, resolvedName: sku?.name ?? null }
}

export function resolutionFailed(item: RawLineItem) {
  return !item.itemCode && !item.eanCode && !item.description
}

export function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || null
}

export function sameCode(a?: string | null, b?: string | null) {
  return normalizeCode(a) === normalizeCode(b)
}

export function sameDescription(a?: string | null, b?: string | null) {
  return normalizedText(a) === normalizedText(b)
}

export function itemIdentity(item: RawLineItem) {
  return normalizeCode(item.itemCode) || normalizeCode(item.eanCode) || normalizedText(item.description)
}

export function dedupeItems<T extends RawLineItem>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const identity = itemIdentity(item)
    if (!identity || seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function compareIdentity(a: RawLineItem, b: RawLineItem) {
  return itemIdentity(a) === itemIdentity(b)
}

export function emptyResolution() {
  return { skuMasterId: null, skuName: null }
}

export function hasAnyIdentifier(item: RawLineItem) {
  return Boolean(item.itemCode || item.eanCode || item.description)
}

export function compactItem(item: RawLineItem) {
  return { code: item.itemCode ?? null, ean: item.eanCode ?? null, description: item.description ?? null }
}

export function resolutionStatus(item: { skuMasterId?: unknown }) {
  return hasResolvedSku(item) ? 'mapped' : 'unmapped'
}

export type ResolutionStatus = ReturnType<typeof resolutionStatus>

export function isMappedStatus(status: ResolutionStatus) {
  return status === 'mapped'
}

export function isUnmappedStatus(status: ResolutionStatus) {
  return status === 'unmapped'
}

export function resolutionReason(item: { skuMasterId?: unknown }) {
  return isUnmapped(item) ? buildUnmappedReason() : null
}

export function countUnmapped(items: Array<{ skuMasterId?: unknown }>) {
  return items.filter(isUnmapped).length
}

export function countMapped(items: Array<{ skuMasterId?: unknown }>) {
  return items.filter(hasResolvedSku).length
}

export function resolutionSummary(items: Array<{ skuMasterId?: unknown }>) {
  return { mapped: countMapped(items), unmapped: countUnmapped(items), total: items.length }
}

export function pickBestCode(item: RawLineItem) {
  return item.itemCode || item.eanCode || null
}

export function hasCode(item: RawLineItem) {
  return Boolean(pickBestCode(item))
}

export function trimItem(item: RawLineItem) {
  return { ...item, itemCode: item.itemCode?.trim() || null, eanCode: item.eanCode?.trim() || null, description: item.description?.trim() || null }
}

export function prepareItems<T extends RawLineItem>(items: T[]) {
  return items.map(trimItem)
}

export function matchesMasterCode(item: RawLineItem, master: { skuErpCode?: string; eanCode?: string }) {
  return sameCode(item.itemCode, master.skuErpCode) || sameCode(item.eanCode, master.eanCode)
}

export function resolutionConfidence(item: RawLineItem) {
  return item.itemCode ? 'high' : item.eanCode ? 'high' : item.description ? 'low' : 'none'
}

export type ResolutionConfidence = ReturnType<typeof resolutionConfidence>

export function validConfidence(value: string): value is ResolutionConfidence {
  return ['high', 'low', 'none'].includes(value)
}

export function buildResolutionLog(item: RawLineItem, sku: { name?: string } | null) {
  return { lookup: masterLookupKey(item), resolved: Boolean(sku), name: sku?.name ?? null }
}

export function nowIso() {
  return new Date().toISOString()
}

export function mapForPersistence<T extends RawLineItem>(item: T, sku: { _id: unknown } | null) {
  return { ...item, skuMasterId: sku?._id ?? null }
}

export function extractIdentifiers(item: RawLineItem) {
  return [item.itemCode, item.eanCode].filter((value): value is string => Boolean(value))
}

export function resolutionMessage(item: RawLineItem, sku: { name?: string } | null) {
  return sku ? `Resolved to ${sku.name ?? 'SKU Master item'}` : `Could not resolve ${codeOrDescription(item)}`
}

export function sortByCode<T extends RawLineItem>(items: T[]) {
  return [...items].sort((a, b) => codeOrDescription(a).localeCompare(codeOrDescription(b)))
}

export function uniqueIdentifiers(items: RawLineItem[]) {
  return [...new Set(items.flatMap(extractIdentifiers))]
}

export function resolutionComplete(items: Array<{ skuMasterId?: unknown }>) {
  return items.length > 0 && items.every(hasResolvedSku)
}

export function resolutionIncomplete(items: Array<{ skuMasterId?: unknown }>) {
  return !resolutionComplete(items)
}

export function resolutionPercent(items: Array<{ skuMasterId?: unknown }>) {
  return items.length ? Math.round((countMapped(items) / items.length) * 100) : 0
}

export function cloneItems<T>(items: T[]) {
  return items.map((item) => ({ ...item }))
}

export function isSameSku(a: { skuMasterId?: unknown }, b: { skuMasterId?: unknown }) {
  return skuIdString(a.skuMasterId) === skuIdString(b.skuMasterId)
}

export function groupBySku<T extends { skuMasterId?: unknown }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = skuIdString(item.skuMasterId) || 'unmapped'
    groups[key] ||= []
    groups[key].push(item)
    return groups
  }, {})
}

export function resolutionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'SKU resolution failed'
}

export function normalizeItems<T extends RawLineItem>(items: T[]) {
  return prepareItems(items).filter(hasAnyIdentifier)
}

export function resolutionVersion() {
  return 'sku-resolution-v1'
}

export const skuResolver = { resolveSku, resolveItems }
