import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { authenticate, login } from './middleware/auth'
import { Grn, Invoice, MatchAudit, PurchaseOrder, SkuMaster } from './models/schemas'
import { getMatchForPo } from './services/matchEngine'
import { extractDocument, parseModelJson, validateParsedDocument } from './services/documentParser'
import { resolveItems } from './services/skuResolver'

const uploadDir = path.resolve('backend/uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.pdf'
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  },
})

const router = Router()
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } })

router.post('/auth/login', login)
router.use(authenticate)

router.get('/health', (_req, res) => res.json({ ok: true, service: 'reconciliation-api' }))

router.post('/documents/reset', async (_req, res) => {
  await Promise.all([
    PurchaseOrder.deleteMany({}),
    Grn.deleteMany({}),
    Invoice.deleteMany({}),
    MatchAudit.deleteMany({}),
  ])
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir)
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(uploadDir, f))
      } catch (e) {}
    }
  }
  res.json({ ok: true, message: 'All documents cleared. Workspace reset to clean state.' })
})

router.get('/documents', async (req, res) => {
  const type = String(req.query.type || '').toLowerCase()
  const poNumber = req.query.poNumber ? String(req.query.poNumber) : undefined
  const filter = poNumber ? { poNumber } : {}
  const [purchaseOrders, grns, invoices] = await Promise.all([
    type === 'grn' || type === 'invoice' ? [] : PurchaseOrder.find(filter).sort({ uploadedAt: -1 }).lean(),
    type === 'po' || type === 'invoice' ? [] : Grn.find(filter).sort({ uploadedAt: -1 }).lean(),
    type === 'po' || type === 'grn' ? [] : Invoice.find(filter).sort({ uploadedAt: -1 }).lean(),
  ])
  res.json({ purchaseOrders, grns, invoices })
})

router.get('/documents/:id', async (req, res) => {
  const [po, grn, invoice] = await Promise.all([PurchaseOrder.findById(req.params.id).lean(), Grn.findById(req.params.id).lean(), Invoice.findById(req.params.id).lean()])
  const document = po || grn || invoice
  if (!document) return res.status(404).json({ error: 'Document not found' })
  res.json(document)
})

router.get('/documents/:id/file', async (req, res) => {
  const [po, grn, invoice] = await Promise.all([
    PurchaseOrder.findById(req.params.id).lean(),
    Grn.findById(req.params.id).lean(),
    Invoice.findById(req.params.id).lean(),
  ])
  const document = po || grn || invoice
  if (!document || !document.originalFilePath) return res.status(404).json({ error: 'Document or file path not found' })
  const absolutePath = path.resolve(document.originalFilePath)
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File missing on disk' })

  const ext = path.extname(absolutePath).toLowerCase()
  let contentType = 'application/pdf'
  if (ext === '.png') contentType = 'image/png'
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
  else if (ext === '.txt') contentType = 'text/plain'
  else if (ext === '.svg') contentType = 'image/svg+xml'
  else {
    try {
      const buffer = Buffer.alloc(8)
      const fd = fs.openSync(absolutePath, 'r')
      fs.readSync(fd, buffer, 0, 8, 0)
      fs.closeSync(fd)
      if (buffer.toString('utf8', 0, 4) === '%PDF') {
        contentType = 'application/pdf'
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        contentType = 'image/png'
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        contentType = 'image/jpeg'
      }
    } catch (_e) {}
  }

  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', 'inline')
  res.sendFile(absolutePath)
})

router.post('/documents/upload', upload.single('file'), async (req, res) => {
  req.setTimeout(120000)
  if (!req.file) return res.status(400).json({ error: 'A PDF or image file is required' })
  const type = String(req.body.documentType || '').toLowerCase() as 'po' | 'grn' | 'invoice'
  if (!['po', 'grn', 'invoice'].includes(type)) return res.status(400).json({ error: 'documentType must be po, grn, or invoice' })

  try {
    const extracted = await extractDocument(req.file.path, type)
    const parsed = validateParsedDocument(extracted)
    if (!parsed.success) return res.status(422).json({ error: 'Extracted document failed validation', details: parsed.error.flatten() })
    const resolvedItems = await resolveItems(parsed.data.items)
    const base = { poNumber: parsed.data.poNumber, items: resolvedItems, rawParsed: extracted, originalFilePath: req.file.path, uploadedAt: new Date() }

    if (type === 'po') {
      const existingCount = await PurchaseOrder.countDocuments({ poNumber: parsed.data.poNumber })
      const document = await PurchaseOrder.create({ ...base, poNumber: parsed.data.poNumber, poDate: parsed.data.documentDate, vendorName: parsed.data.vendorName || 'Unknown vendor', expectedDelivery: parsed.data.expectedDelivery, expiryDate: parsed.data.expiryDate })
      return res.status(201).json({ document, duplicate: existingCount > 0 })
    }
    if (type === 'grn') {
      const existingCount = await Grn.countDocuments({ poNumber: parsed.data.poNumber, grnNumber: parsed.data.documentNumber })
      const document = await Grn.create({ ...base, grnNumber: parsed.data.documentNumber, grnDate: parsed.data.documentDate, inboundNumber: parsed.data.inboundNumber, invoiceNumber: parsed.data.invoiceNumber })
      return res.status(201).json({ document, duplicate: existingCount > 0 })
    }
    const existingCount = await Invoice.countDocuments({ poNumber: parsed.data.poNumber, invoiceNumber: parsed.data.documentNumber })
    const document = await Invoice.create({ ...base, invoiceNumber: parsed.data.documentNumber, invoiceDate: parsed.data.documentDate, vendorName: parsed.data.vendorName, totalAmount: parsed.data.totalAmount, taxAmount: parsed.data.taxAmount })
    return res.status(201).json({ document, duplicate: existingCount > 0 })
  } catch (error) {
    console.error('[UPLOAD] Processing failed:', error instanceof Error ? error.message : String(error))
    res.status(500).json({ error: error instanceof Error ? error.message : 'Document processing failed' })
  }
})

router.get('/match/:poNumber', async (req, res) => res.json(await getMatchForPo(req.params.poNumber)))
router.get('/summary/:poNumber', async (req, res) => {
  const match = await getMatchForPo(req.params.poNumber)
  res.json({ poNumber: match.poNumber, status: match.status, reasons: match.reasons, summary: match.summary })
})

router.get('/masters/sku', async (_req, res) => res.json(await SkuMaster.find().sort({ name: 1 }).lean()))
router.post('/masters/sku', async (req, res) => res.status(201).json(await SkuMaster.create(req.body)))
router.get('/masters/sku/:id', async (req, res) => {
  const sku = await SkuMaster.findById(req.params.id).lean()
  if (!sku) return res.status(404).json({ error: 'SKU not found' })
  res.json(sku)
})
router.patch('/masters/sku/:id', async (req, res) => res.json(await SkuMaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })))
router.delete('/masters/sku/:id', async (req, res) => { await SkuMaster.findByIdAndDelete(req.params.id); res.status(204).send() })

export default router
