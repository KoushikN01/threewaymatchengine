'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  Database,
  FileCheck2,
  FileInput,
  FileText,
  Filter,
  LayoutDashboard,
  Lock,
  LogOut,
  MoreHorizontal,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

type Status = 'matched' | 'partially_matched' | 'mismatch' | 'insufficient_documents' | 'unmapped' | 'warning'

type DocumentType = 'po' | 'grn' | 'invoice'

interface DocumentRecord {
  _id: string
  poNumber: string
  grnNumber?: string
  invoiceNumber?: string
  poDate?: string
  grnDate?: string
  invoiceDate?: string
  vendorName?: string
  totalAmount?: number
  taxAmount?: number
  inboundNumber?: string
  originalFilePath?: string
  uploadedAt: string
  items: Array<{
    itemCode?: string
    eanCode?: string
    description?: string
    quantity?: number
    receivedQuantity?: number
    expectedQuantity?: number
    unitRate?: number
    rate?: number
    mrp?: number
    uom?: string
    skuMasterId?: string
  }>
}

interface SkuItem {
  _id?: string
  skuErpCode: string
  name: string
  eanCode?: string
  hsnCode?: string
  uom: string
  agreedRate: number
  mrp?: number
  priceTolerance?: number
}

interface MatchResult {
  poNumber: string
  status: Status
  reasons: string[]
  lineResults: Array<{
    key: string
    itemCode?: string
    description?: string
    ordered: number
    received: number | null
    billed: number | null
    variance: number | null
    reasons: string[]
  }>
  summary: {
    totalItems: number
    matchedItems: number
    partialItems: number
    unmappedItems: number
    quantityMismatches: number
    priceMismatches: number
  }
}

interface SummaryResult {
  poNumber: string
  status: Status
  reasons: string[]
  summary: {
    totalItems: number
    matchedItems: number
    partialItems: number
    unmappedItems: number
    quantityMismatches: number
    priceMismatches: number
  }
}

function StatusBadge({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    matched: 'Matched',
    partially_matched: 'Needs review',
    warning: 'Needs review',
    mismatch: 'Mismatch',
    insufficient_documents: 'Incomplete',
    unmapped: 'Unmapped SKU',
  }
  const styles: Record<Status, string> = {
    matched: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    partially_matched: 'bg-amber-50 text-amber-700 ring-amber-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    mismatch: 'bg-red-50 text-red-700 ring-red-200',
    insufficient_documents: 'bg-blue-50 text-blue-700 ring-blue-200',
    unmapped: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${styles[status] || styles.warning}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {labels[status] || status.replaceAll('_', ' ')}
    </span>
  )
}

export default function Page() {
  const [token, setToken] = useState<string | null>(null)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  // Document states
  const [purchaseOrders, setPurchaseOrders] = useState<DocumentRecord[]>([])
  const [grns, setGrns] = useState<DocumentRecord[]>([])
  const [invoices, setInvoices] = useState<DocumentRecord[]>([])
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>('')
  const [allPoNumbers, setAllPoNumbers] = useState<string[]>([])

  // Match state
  const [matchData, setMatchData] = useState<MatchResult | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryResult | null>(null)

  // SKU Master state
  const [skus, setSkus] = useState<SkuItem[]>([])
  const [skuModalOpen, setSkuModalOpen] = useState(false)
  const [editingSku, setEditingSku] = useState<Partial<SkuItem> | null>(null)

  // UI state
  const [activeTab, setActiveTab] = useState<'Summary' | 'Purchase Order' | 'Fulfillment' | 'Delivery' | 'SKU Master'>('Summary')
  const [selectedGrnIndex, setSelectedGrnIndex] = useState(0)
  const [selectedInvoiceIndex, setSelectedInvoiceIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [zoomLevel, setZoomLevel] = useState(100)

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<DocumentType>('po')
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check token on mount
  useEffect(() => {
    const saved = localStorage.getItem('reconciliation_token')
    if (saved) {
      setToken(saved)
    }
  }, [])

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

  // API Fetch Helper
  async function apiFetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {})
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
    let res: Response
    try {
      res = await fetch(fullUrl, { ...options, headers })
    } catch (_err) {
      const fallbackUrl = url.startsWith('http') ? url : url
      res = await fetch(fallbackUrl, { ...options, headers })
    }
    if (res.status === 401) {
      setToken(null)
      localStorage.removeItem('reconciliation_token')
      throw new Error('Unauthorized. Please login again.')
    }
    return res
  }

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST' })
      if (!res.ok) throw new Error('Login failed')
      const data = await res.json()
      setToken(data.token)
      localStorage.setItem('reconciliation_token', data.token)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  // Load Data
  const loadData = async () => {
    if (!token) return
    setLoading(true)
    try {
      const [docsRes, skusRes] = await Promise.all([
        apiFetch('/api/documents'),
        apiFetch('/api/masters/sku'),
      ])

      if (docsRes.ok) {
        const docs = await docsRes.json()
        const fetchedPos = docs.purchaseOrders || []
        const fetchedGrns = docs.grns || []
        const fetchedInvoices = docs.invoices || []

        setPurchaseOrders(fetchedPos)
        setGrns(fetchedGrns)
        setInvoices(fetchedInvoices)

        const uniquePos = Array.from(
          new Set([
            ...fetchedPos.map((p: DocumentRecord) => p.poNumber),
            ...fetchedGrns.map((g: DocumentRecord) => g.poNumber),
            ...fetchedInvoices.map((i: DocumentRecord) => i.poNumber),
          ])
        ).filter(Boolean) as string[]

        setAllPoNumbers(uniquePos)

        if (uniquePos.length > 0) {
          setSelectedPoNumber((prev) => (prev && uniquePos.includes(prev) ? prev : uniquePos[0]))
        } else {
          setSelectedPoNumber('')
        }
      }

      if (skusRes.ok) {
        setSkus(await skusRes.json())
      }
    } catch (err) {
      console.error('[CLIENT] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load match & summary for selected PO
  const loadMatchAndSummary = async (poNum: string) => {
    if (!token || !poNum) return
    try {
      const [matchRes, summaryRes] = await Promise.all([
        apiFetch(`/api/match/${poNum}`),
        apiFetch(`/api/summary/${poNum}`),
      ])

      if (matchRes.ok) {
        setMatchData(await matchRes.json())
      }
      if (summaryRes.ok) {
        setSummaryData(await summaryRes.json())
      }
    } catch (err) {
      console.error('[CLIENT] Failed to load match/summary:', err)
    }
  }

  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token])

  useEffect(() => {
    if (token && selectedPoNumber) {
      loadMatchAndSummary(selectedPoNumber)
    }
  }, [token, selectedPoNumber])

  // Filtered documents by selected PO
  const poDoc = useMemo(() => purchaseOrders.find((p) => p.poNumber === selectedPoNumber), [purchaseOrders, selectedPoNumber])
  const grnDocs = useMemo(() => grns.filter((g) => g.poNumber === selectedPoNumber), [grns, selectedPoNumber])
  const invoiceDocs = useMemo(() => invoices.filter((i) => i.poNumber === selectedPoNumber), [invoices, selectedPoNumber])

  const activeGrn = grnDocs[selectedGrnIndex] || grnDocs[0]
  const activeInvoice = invoiceDocs[selectedInvoiceIndex] || invoiceDocs[0]

  // Currently displayed document in form/preview
  const currentDoc = useMemo(() => {
    if (activeTab === 'Purchase Order') return poDoc
    if (activeTab === 'Fulfillment') return activeInvoice
    if (activeTab === 'Delivery') return activeGrn
    return poDoc
  }, [activeTab, poDoc, activeInvoice, activeGrn])

  // Upload handler
  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setUploadStatus('Uploading file to server...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)

      setUploadStatus('Extracting document fields using Gemini AI...')
      const res = await apiFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await res.json()
      setUploadStatus('Document extracted and reconciliation recomputed!')
      setTimeout(() => {
        setUploadOpen(false)
        setFile(null)
        setUploadStatus('')
        setUploading(false)
        if (data.document?.poNumber) {
          setSelectedPoNumber(data.document.poNumber)
        }
        if (documentType === 'po') setActiveTab('Purchase Order')
        else if (documentType === 'invoice') setActiveTab('Fulfillment')
        else if (documentType === 'grn') setActiveTab('Delivery')
        loadData()
      }, 1000)
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }

  // SKU Master CRUD
  async function handleSaveSku(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSku?.skuErpCode || !editingSku?.name) return
    try {
      const isEdit = Boolean(editingSku._id)
      const url = isEdit ? `/api/masters/sku/${editingSku._id}` : '/api/masters/sku'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSku),
      })

      if (!res.ok) throw new Error('Failed to save SKU')
      setEditingSku(null)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving SKU')
    }
  }

  async function handleDeleteSku(id: string) {
    if (!confirm('Are you sure you want to delete this SKU Master record?')) return
    try {
      const res = await apiFetch(`/api/masters/sku/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete SKU')
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting SKU')
    }
  }

  // Calculate totals for summary tab
  const poTotalAmount = useMemo(() => {
    if (!poDoc?.items) return 1024820
    return poDoc.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || item.unitRate || 0), 0)
  }, [poDoc])

  const totalInvoicedAmount = useMemo(() => {
    return invoiceDocs.reduce((sum, inv) => sum + (inv.totalAmount || inv.items?.reduce((s, i) => s + (i.quantity || 0) * (i.unitRate || 0), 0) || 0), 0)
  }, [invoiceDocs])

  const totalReceivedQty = useMemo(() => {
    return grnDocs.reduce((sum, grn) => sum + (grn.items?.reduce((s, i) => s + (i.receivedQuantity || 0), 0) || 0), 0)
  }, [grnDocs])

  // Reset workspace
  async function handleResetWorkspace() {
    if (!confirm('Are you sure you want to clear all uploaded documents and reset the workspace?')) return
    try {
      const res = await apiFetch('/api/documents/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      setPurchaseOrders([])
      setGrns([])
      setInvoices([])
      setMatchData(null)
      setSummaryData(null)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  // Login view if unauthorized
  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold">Three-Way Match Engine</h1>
              <p className="text-xs text-slate-400">Procurement & Finance Reconciliation</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Access Key / Token</label>
              <input
                readOnly
                value="reconciliation-bearer-token-dev"
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 font-mono text-xs text-slate-300 outline-none"
              />
            </div>
            {authError && <p className="text-xs font-medium text-red-400">{authError}</p>}
            <button type="submit" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
              <Lock size={15} /> Authenticate & Access Workspace
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck size={19} />
          </div>
          <div>
            <p className="font-mono text-sm font-bold">reconcile</p>
            <p className="text-[10px] text-muted-foreground">PROCUREMENT CONTROL</p>
          </div>
        </div>

        <nav className="mt-12 flex flex-col gap-1">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
          {[
            { icon: LayoutDashboard, label: 'Overview', count: undefined },
            { icon: FileInput, label: 'Documents', count: purchaseOrders.length + grns.length + invoices.length },
            { icon: PackageCheck, label: 'SKU Master', count: skus.length },
          ].map(({ icon: Icon, label, count }) => (
            <button
              key={label}
              onClick={() => {
                if (label === 'SKU Master') setActiveTab('SKU Master')
                else setActiveTab('Summary')
              }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                (label === 'SKU Master' && activeTab === 'SKU Master') || (label !== 'SKU Master' && activeTab !== 'SKU Master')
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon size={17} />
              {label}
              {count !== undefined && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <button onClick={() => setSkuModalOpen(true)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent">
            <Database size={17} /> Manage SKU Master
          </button>
          <button
            onClick={() => {
              setToken(null)
              localStorage.removeItem('reconciliation_token')
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent"
          >
            <LogOut size={17} /> Sign out
          </button>
          <div className="mt-5 flex items-center gap-3 border-t border-border px-2 pt-5">
            <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">AK</div>
            <div>
              <p className="text-xs font-semibold">Aarav Kapoor</p>
              <p className="text-[11px] text-muted-foreground">Finance Operations</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="lg:ml-64">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-semibold">Reconciliation Workspace</p>
              <p className="text-[11px] text-muted-foreground">Select Purchase Order</p>
            </div>
            {allPoNumbers.length > 0 && (
              <select
                value={selectedPoNumber}
                onChange={(e) => setSelectedPoNumber(e.target.value)}
                className="rounded-lg border border-primary/40 bg-accent/60 px-3 py-1.5 font-mono text-xs font-bold text-foreground shadow-sm hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {allPoNumbers.map((num) => (
                  <option key={num} value={num}>
                    PO: {num}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleResetWorkspace} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-100 transition">
              <Trash2 size={14} /> Clear Workspace
            </button>
            <button onClick={loadData} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
              <Upload size={15} /> Upload Document
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1380px] px-5 py-7 md:px-8 md:py-9">
          {/* Header Banner */}
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex gap-2 text-xs text-muted-foreground">
                <span>Workspace</span>
                <span>/</span>
                <span className="font-mono text-foreground">{selectedPoNumber}</span>
              </div>
              <h1 className="text-balance text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Three-Way Match</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Reconcile what was ordered, received at warehouse, and billed for purchase order {selectedPoNumber}.</p>
            </div>
          </div>

          {/* Top KPI Cards */}
          <div className="mb-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs text-muted-foreground">Overall Result</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-2xl font-semibold capitalize">{(matchData?.status || 'insufficient_documents').replaceAll('_', ' ')}</p>
                <StatusBadge status={matchData?.status || 'insufficient_documents'} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{matchData?.reasons?.length ? `${matchData.reasons.length} rule exceptions flagged` : 'All documents reconciled cleanly'}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs text-muted-foreground">Purchase Order Value</p>
              <p className="mt-3 text-2xl font-semibold">
                ₹{poTotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs text-emerald-700">
                <ArrowUpRight size={13} /> {poDoc?.items?.length || 0} line items ordered
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs text-muted-foreground">Document Completeness</p>
              <p className="mt-3 text-2xl font-semibold">
                {[Boolean(poDoc), grnDocs.length > 0, invoiceDocs.length > 0].filter(Boolean).length} <span className="text-base font-normal text-muted-foreground">of 3</span>
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${(([Boolean(poDoc), grnDocs.length > 0, invoiceDocs.length > 0].filter(Boolean).length / 3) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {poDoc ? 'PO Uploaded' : 'Missing PO'} · {grnDocs.length} GRN · {invoiceDocs.length} Invoice
              </p>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
            {(
              [
                ['Summary', 0],
                ['Purchase Order', poDoc ? 1 : 0],
                ['Fulfillment', invoiceDocs.length],
                ['Delivery', grnDocs.length],
                ['SKU Master', skus.length],
              ] as const
            ).map(([name, count]) => (
              <button
                key={name}
                onClick={() => setActiveTab(name as any)}
                className={`relative whitespace-nowrap px-4 pb-3 pt-1 text-xs font-semibold transition ${
                  activeTab === name ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {name} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px]">{count}</span>
                {activeTab === name && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>

          {/* Sub-tabs for multiple Fulfillment / Delivery documents */}
          {activeTab === 'Fulfillment' && invoiceDocs.length > 1 && (
            <div className="mb-6 flex gap-2">
              {invoiceDocs.map((inv, idx) => (
                <button
                  key={inv._id}
                  onClick={() => setSelectedInvoiceIndex(idx)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    selectedInvoiceIndex === idx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                  }`}
                >
                  Invoice: {inv.invoiceNumber}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'Delivery' && grnDocs.length > 1 && (
            <div className="mb-6 flex gap-2">
              {grnDocs.map((grn, idx) => (
                <button
                  key={grn._id}
                  onClick={() => setSelectedGrnIndex(idx)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    selectedGrnIndex === idx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                  }`}
                >
                  GRN: {grn.grnNumber}
                </button>
              ))}
            </div>
          )}

          {/* TAB 1: SUMMARY */}
          {activeTab === 'Summary' && (
            <div className="space-y-6">
              <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                {/* Associated Invoice & GRN Table */}
                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="border-b border-border px-5 py-4">
                    <h2 className="text-sm font-semibold">Associated Invoice & GRN</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Cumulative breakdown linked by purchase order {selectedPoNumber}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3">Document</th>
                          <th className="px-4 py-3">Ref ID</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-5 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {poDoc && (
                          <tr className="hover:bg-muted/30">
                            <td className="px-5 py-3.5 font-medium flex items-center gap-2">
                              <FileText size={15} className="text-primary" /> Purchase Order
                            </td>
                            <td className="px-4 py-3.5 font-mono text-muted-foreground">{poDoc.poNumber}</td>
                            <td className="px-4 py-3.5">{poDoc.poDate ? new Date(poDoc.poDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3.5 font-semibold">₹{poTotalAmount.toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5 text-right"><StatusBadge status="matched" /></td>
                          </tr>
                        )}
                        {grnDocs.map((grn) => (
                          <tr key={grn._id} className="hover:bg-muted/30">
                            <td className="px-5 py-3.5 font-medium flex items-center gap-2">
                              <PackageCheck size={15} className="text-emerald-600" /> Goods Receipt Note
                            </td>
                            <td className="px-4 py-3.5 font-mono text-muted-foreground">{grn.grnNumber}</td>
                            <td className="px-4 py-3.5">{grn.grnDate ? new Date(grn.grnDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3.5 font-semibold">{grn.items?.reduce((s, i) => s + (i.receivedQuantity || 0), 0)} units rec.</td>
                            <td className="px-5 py-3.5 text-right"><StatusBadge status="matched" /></td>
                          </tr>
                        ))}
                        {invoiceDocs.map((inv) => (
                          <tr key={inv._id} className="hover:bg-muted/30">
                            <td className="px-5 py-3.5 font-medium flex items-center gap-2">
                              <FileCheck2 size={15} className="text-blue-600" /> Invoice
                            </td>
                            <td className="px-4 py-3.5 font-mono text-muted-foreground">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3.5">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-3.5 font-semibold">₹{(inv.totalAmount || 0).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5 text-right"><StatusBadge status={matchData?.reasons?.includes('invoice_date_after_po_date') ? 'mismatch' : 'matched'} /></td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                          <td className="px-5 py-4">Current Status</td>
                          <td className="px-4 py-4 font-mono text-muted-foreground">{selectedPoNumber}</td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">Cumulative</td>
                          <td className="px-4 py-4">₹{totalInvoicedAmount.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-4 text-right">
                            <StatusBadge status={matchData?.status || 'insufficient_documents'} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Match Exception Card */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-amber-950">Match Exception Audit</h2>
                      <p className="mt-1 text-xs leading-5 text-amber-900/70">
                        {matchData?.reasons?.length
                          ? `The match engine detected ${matchData.reasons.length} rule flags during automated evaluation.`
                          : 'No hard mismatches or price violations detected.'}
                      </p>

                      {matchData?.reasons && matchData.reasons.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {matchData.reasons.map((reason) => (
                            <span key={reason} className="rounded-md bg-amber-200/80 px-2 py-1 font-mono text-[10px] font-bold text-amber-900">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2, 3, 4: DOCUMENT DETAIL VIEW (PO / Fulfillment / Delivery) */}
          {(activeTab === 'Purchase Order' || activeTab === 'Fulfillment' || activeTab === 'Delivery') && (
            <div className="space-y-6">
              {/* Mismatch Warning Banner */}
              {matchData?.reasons && matchData.reasons.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-100/80 px-5 py-3.5 text-amber-900">
                  <AlertCircle size={18} className="shrink-0 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold">Rule Exceptions Flagged</p>
                    <p className="text-[11px] text-amber-800">{matchData.reasons.map((r) => r.replaceAll('_', ' ')).join(' · ')}</p>
                  </div>
                </div>
              )}

              {/* Split Screen: Form Panel Left, PDF Preview Right */}
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Left Form Panel */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 border-l-4 border-primary pl-3">
                    <h2 className="text-sm font-semibold">{activeTab} Details</h2>
                    <p className="text-xs text-muted-foreground">Extracted header parameters</p>
                  </div>

                  {currentDoc ? (
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Document Number</p>
                        <p className="mt-1 font-mono font-bold">{currentDoc.poNumber || currentDoc.grnNumber || currentDoc.invoiceNumber || '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Date</p>
                        <p className="mt-1 font-semibold">{currentDoc.poDate || currentDoc.grnDate || currentDoc.invoiceDate ? new Date(currentDoc.poDate || currentDoc.grnDate || currentDoc.invoiceDate || '').toLocaleDateString() : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Vendor Name</p>
                        <p className="mt-1 font-semibold">{currentDoc.vendorName || 'M/s AFP'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Total Value / Qty</p>
                        <p className="mt-1 font-semibold">{currentDoc.totalAmount ? `₹${currentDoc.totalAmount.toLocaleString('en-IN')}` : `${currentDoc.items?.length || 0} line items`}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">No {activeTab} document uploaded for this PO number yet.</p>
                  )}
                </div>

                {/* Right PDF / Image Preview Panel */}
                <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-xs font-semibold flex items-center gap-2">
                      <FileText size={14} /> Document Preview
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-r border-border pr-2">
                        <button onClick={() => setZoomLevel((z) => Math.max(50, z - 10))} className="rounded p-1 text-muted-foreground hover:bg-accent"><ZoomOut size={14} /></button>
                        <span className="font-mono text-[10px] text-muted-foreground">{zoomLevel}%</span>
                        <button onClick={() => setZoomLevel((z) => Math.min(200, z + 10))} className="rounded p-1 text-muted-foreground hover:bg-accent"><ZoomIn size={14} /></button>
                      </div>
                      {currentDoc?._id && (
                        <a
                          href={`${API_BASE}/api/documents/${currentDoc._id}/file?token=${encodeURIComponent(token || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Open document in new tab"
                        >
                          <ArrowUpRight size={14} /> Open
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="relative min-h-[450px] flex-1 overflow-auto p-4 bg-muted/20 flex items-center justify-center">
                    {currentDoc?._id ? (
                      <iframe
                        src={`${API_BASE}/api/documents/${currentDoc._id}/file?token=${encodeURIComponent(token || '')}`}
                        className="h-[450px] w-full rounded border border-border bg-white"
                        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left', width: zoomLevel > 100 ? `${10000 / zoomLevel}%` : '100%' }}
                        title="Document Preview"
                      />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground">
                        <FileText className="mx-auto mb-2 opacity-40" size={32} />
                        <p>Document preview unavailable</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SKU MASTER CATALOGUE */}
          {activeTab === 'SKU Master' && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Canonical SKU Master Catalogue</h2>
                  <p className="text-xs text-muted-foreground">Maps vendor document item codes to canonical product identities</p>
                </div>
                <button
                  onClick={() => setEditingSku({ skuErpCode: '', name: '', uom: 'PKT', agreedRate: 0, mrp: 0, priceTolerance: 0.05 })}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Plus size={14} /> Add SKU Master Record
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">ERP Code</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">EAN / Vendor Code</th>
                      <th className="px-4 py-3">HSN Code</th>
                      <th className="px-4 py-3">UOM</th>
                      <th className="px-4 py-3">Agreed Rate</th>
                      <th className="px-4 py-3">MRP</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {skus.map((sku) => (
                      <tr key={sku._id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono font-bold">{sku.skuErpCode}</td>
                        <td className="px-4 py-3 font-semibold">{sku.name}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{sku.eanCode || '—'}</td>
                        <td className="px-4 py-3 font-mono">{sku.hsnCode || '—'}</td>
                        <td className="px-4 py-3">{sku.uom}</td>
                        <td className="px-4 py-3 font-semibold">₹{sku.agreedRate}</td>
                        <td className="px-4 py-3">₹{sku.mrp || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setEditingSku(sku)} className="mr-2 text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDeleteSku(sku._id!)} className="text-red-600 hover:underline"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LINE ITEM RECONCILIATION GRID (Shown on all tabs except SKU Master) */}
          {activeTab !== 'SKU Master' && (
            <div id="line-items" className="mt-8 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-sm font-semibold">Line Item Reconciliation Grid</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Item-level ordered, received, and billed quantities reconciled against SKU Master</p>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Search size={14} className="text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search SKU or description"
                      className="w-36 bg-transparent text-xs outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Item / Description</th>
                      <th className="px-4 py-3">Ordered</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3">Billed</th>
                      <th className="px-4 py-3">Variance</th>
                      <th className="px-5 py-3 text-right">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matchData?.lineResults
                      ?.filter((line) => `${line.itemCode} ${line.description}`.toLowerCase().includes(query.toLowerCase()))
                      .map((line) => {
                        const isUnmapped = line.reasons.includes('unmapped_master_sku')
                        const hasPriceError = line.reasons.includes('price_mismatch')
                        const hasQtyError = line.reasons.some((r) => r.includes('qty_'))

                        return (
                          <tr key={line.key} className={`hover:bg-muted/30 ${hasPriceError || hasQtyError ? 'bg-red-50/30' : ''}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex size-8 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-bold text-muted-foreground">
                                  {(line.itemCode || 'SKU').slice(-4)}
                                </div>
                                <div>
                                  <p className="font-semibold">{line.description || 'Item'}</p>
                                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">SKU Code: {line.itemCode || 'Unmapped'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-medium">{line.ordered} units</td>
                            <td className="px-4 py-4 font-medium">{line.received !== null ? `${line.received} units` : '—'}</td>
                            <td className="px-4 py-4 font-medium">{line.billed !== null ? `${line.billed} units` : '—'}</td>
                            <td className={`px-4 py-4 font-semibold ${line.variance && line.variance !== 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {line.variance !== null ? `${line.variance > 0 ? '+' : ''}${line.variance}` : '—'}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <StatusBadge
                                status={
                                  isUnmapped
                                    ? 'unmapped'
                                    : (hasQtyError || hasPriceError)
                                    ? 'mismatch'
                                    : (line.ordered !== line.received || line.ordered !== line.billed)
                                    ? 'partially_matched'
                                    : 'matched'
                                }
                              />
                            </td>
                          </tr>
                        )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* UPLOAD DOCUMENT MODAL */}
      {uploadOpen && (
        <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Upload Document</h2>
                <p className="mt-1 text-xs text-muted-foreground">Extracted automatically using Gemini API OCR.</p>
              </div>
              <button onClick={() => setUploadOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X size={18} /></button>
            </div>

            <label className="mt-5 flex flex-col gap-2 text-xs font-semibold">
              Document Type
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-normal"
              >
                <option value="po">Purchase Order (PO)</option>
                <option value="invoice">Invoice (Bill)</option>
                <option value="grn">Goods Receipt Note (GRN)</option>
              </select>
            </label>

            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0])
              }}
              className="mt-5 block w-full rounded-xl border border-dashed border-primary/40 bg-accent/40 p-8 text-center"
            >
              <Upload className="mx-auto mb-2 text-primary" size={26} />
              <p className="text-sm font-semibold">{file ? file.name : 'Select or drop document here'}</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG up to 15MB</p>
            </button>
            <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />

            {uploadStatus && <p className="mt-3 text-xs font-medium text-primary">{uploadStatus}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setUploadOpen(false)} className="rounded-lg px-3 py-2 text-xs font-semibold hover:bg-accent">Cancel</button>
              <button onClick={handleUpload} disabled={!file || uploading} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {uploading ? 'Processing...' : 'Upload & Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SKU MASTER CREATE/EDIT MODAL */}
      {editingSku && (
        <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveSku} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold">{editingSku._id ? 'Edit SKU Master' : 'Create SKU Master Record'}</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold">ERP Code *</label>
                <input
                  required
                  value={editingSku.skuErpCode || ''}
                  onChange={(e) => setEditingSku({ ...editingSku, skuErpCode: e.target.value })}
                  className="mt-1 w-full rounded border border-border p-2 bg-background"
                />
              </div>
              <div>
                <label className="font-semibold">EAN / Vendor Code</label>
                <input
                  value={editingSku.eanCode || ''}
                  onChange={(e) => setEditingSku({ ...editingSku, eanCode: e.target.value })}
                  className="mt-1 w-full rounded border border-border p-2 bg-background"
                />
              </div>
              <div className="col-span-2">
                <label className="font-semibold">Product Name *</label>
                <input
                  required
                  value={editingSku.name || ''}
                  onChange={(e) => setEditingSku({ ...editingSku, name: e.target.value })}
                  className="mt-1 w-full rounded border border-border p-2 bg-background"
                />
              </div>
              <div>
                <label className="font-semibold">Agreed Rate (₹) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={editingSku.agreedRate || 0}
                  onChange={(e) => setEditingSku({ ...editingSku, agreedRate: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded border border-border p-2 bg-background"
                />
              </div>
              <div>
                <label className="font-semibold">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingSku.mrp || 0}
                  onChange={(e) => setEditingSku({ ...editingSku, mrp: parseFloat(e.target.value) })}
                  className="mt-1 w-full rounded border border-border p-2 bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSku(null)} className="rounded px-3 py-2 text-xs font-semibold hover:bg-accent">Cancel</button>
              <button type="submit" className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Save Record</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
