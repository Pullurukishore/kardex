'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiService } from '@/services/api'
import { UserRole } from '@/types/user.types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Ticket,
  Download,
  Trash2,
  Eye,
  FileText,
  X,
  Building2,
  MapPin,
  Wrench,
  Users,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type ImportStep = 'upload' | 'preview' | 'importing' | 'result'

interface PreviewData {
  totalRows: number
  totalNew: number
  totalUpdate: number
  sheetName: string
  sampleRows: any[]
  headers: string[]
}

interface ImportResult {
  totalRead: number
  imported: number
  updated: number
  errors: number
  errorDetails: string[]
}

export default function TicketImportPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      await handleFileSelect(files[0])
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFileSelect(files[0])
    }
  }

  const handleFileSelect = async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ]

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!validTypes.includes(file.type) && ext !== 'xlsx' && ext !== 'xls') {
      setError('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum size is 50MB.')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Automatically preview
    setIsLoadingPreview(true)
    try {
      const data = await apiService.previewTicketImport(file)
      setPreviewData(data)
      setStep('preview')
    } catch (err: any) {
      const msg = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to preview file'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return

    setStep('importing')
    setIsImporting(true)
    setError(null)

    try {
      const result = await apiService.importTickets(selectedFile)
      setImportResult(result)
      setStep('result')
      toast.success(`Import completed: ${result.imported} new, ${result.updated} updated`)
    } catch (err: any) {
      const msg = err.response?.data?.details || err.response?.data?.error || err.message || 'Import failed'
      setError(msg)
      setStep('preview')
      toast.error(msg)
    } finally {
      setIsImporting(false)
    }
  }

  const resetImport = () => {
    setStep('upload')
    setSelectedFile(null)
    setPreviewData(null)
    setImportResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can import tickets.</p>
          <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#AEBFC3]/10">
      <div className="w-full p-2 sm:p-3 lg:p-4 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#9E3B47] via-[#E17F70] to-[#6F8A9D] rounded-2xl shadow-xl p-4 sm:p-6 text-white">
          <div className="relative z-10 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 bg-white/25 backdrop-blur-sm rounded-xl ring-2 ring-white/40 shadow-lg">
                <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold drop-shadow-md">Import Tickets</h1>
                <p className="text-white/90 text-sm sm:text-base mt-1">Upload an Excel file to bulk import support tickets</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => router.push('/admin/tickets')} variant="outline" className="bg-white/15 hover:bg-white/25 text-white border-white/30 font-semibold">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tickets
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-0">
          {[
            { key: 'upload', label: 'Upload', icon: FileSpreadsheet },
            { key: 'preview', label: 'Preview', icon: Eye },
            { key: 'importing', label: 'Import', icon: Upload },
            { key: 'result', label: 'Result', icon: CheckCircle2 }
          ].map((s, i) => {
            const stepOrder = ['upload', 'preview', 'importing', 'result']
            const currentIdx = stepOrder.indexOf(step)
            const thisIdx = stepOrder.indexOf(s.key)
            const isActive = thisIdx === currentIdx
            const isDone = thisIdx < currentIdx
            const Icon = s.icon

            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${isActive ? 'bg-[#9E3B47] text-white shadow-lg scale-105' :
                    isDone ? 'bg-[#82A094] text-white' :
                      'bg-gray-200 text-gray-500'}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 3 && <div className={`w-8 sm:w-12 h-0.5 ${isDone ? 'bg-[#82A094]' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-semibold text-sm">Error</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-xl">
                <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-[#9E3B47]" />
                    Upload Excel File
                  </CardTitle>
                  <CardDescription>Drag and drop or click to select your ticket data file</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
                      ${isDragOver
                        ? 'border-[#9E3B47] bg-[#9E3B47]/5 scale-[1.02] shadow-lg'
                        : 'border-gray-300 hover:border-[#9E3B47]/50 hover:bg-[#9E3B47]/5'
                      }
                      ${isLoadingPreview ? 'pointer-events-none opacity-60' : ''}
                    `}
                  >
                    {isLoadingPreview ? (
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 text-[#9E3B47] animate-spin" />
                        <p className="text-[#9E3B47] font-semibold">Analyzing file...</p>
                        <p className="text-sm text-gray-500">Scanning rows and validating data</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-[#9E3B47]/10 rounded-full">
                          <Upload className="h-10 w-10 text-[#9E3B47]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-700">
                            {isDragOver ? 'Drop file here!' : 'Drop Excel file here or click to browse'}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">Supports .xlsx and .xls (max 50MB)</p>
                        </div>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept=".xlsx,.xls"
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <Card className="border-0 shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#6F8A9D]" />
                    Expected Columns
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  {[
                    { icon: Building2, label: 'Company Name', color: 'text-[#9E3B47]' },
                    { icon: MapPin, label: 'Place', color: 'text-[#6F8A9D]' },
                    { icon: Ticket, label: 'Ticket ID', color: 'text-[#CE9F6B]' },
                    { icon: Wrench, label: 'Machine Serial Number', color: 'text-[#82A094]' },
                    { icon: Users, label: 'Responsible (Engineer)', color: 'text-[#546A7A]' },
                    { icon: MapPin, label: 'Zone', color: 'text-[#6F8A9D]' },
                    { icon: FileText, label: 'Work Start / End', color: 'text-[#82A094]' },
                    { icon: Eye, label: 'Service Report Details', color: 'text-[#6F8A9D]' },
                  ].map((col, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-50">
                      <col.icon className={`h-3 w-3 ${col.color}`} />
                      <span className="text-gray-700 font-medium">{col.label}</span>
                    </div>
                  ))}
                  <p className="text-gray-400 pt-2 border-t mt-2">
                    + Call Type, Error, Ticket Date/Time, Scheduled On, Closed On, Contact Name/Number, Kdx Engineer, Konte Team, MDT, etc.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-semibold text-amber-800">Import Notes</p>
                      <ul className="text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                        <li>Ticket ID is used as unique key for updates</li>
                        <li>Customers, contacts & assets auto-created</li>
                        <li>Closed tickets need &ldquo;Closed On&rdquo; date</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && previewData && (
          <div className="space-y-6">
            {/* File & Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/15"><FileSpreadsheet className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">File</p>
                    <p className="text-sm font-bold text-blue-900 truncate max-w-[150px]">{selectedFile?.name}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-lg p-4 bg-gradient-to-br from-[#9E3B47]/5 to-[#9E3B47]/15">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#9E3B47]/15"><Ticket className="h-5 w-5 text-[#9E3B47]" /></div>
                  <div>
                    <p className="text-xs text-[#9E3B47] font-medium">Total Rows</p>
                    <p className="text-2xl font-bold text-[#75242D]">{previewData.totalRows}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-lg p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/15"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">New Tickets</p>
                    <p className="text-2xl font-bold text-emerald-800">{previewData.totalNew}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-lg p-4 bg-gradient-to-br from-amber-50 to-amber-100/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/15"><RefreshCw className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-xs text-amber-600 font-medium">Updates</p>
                    <p className="text-2xl font-bold text-amber-800">{previewData.totalUpdate}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sample Data */}
            {previewData.sampleRows.length > 0 && (
              <Card className="border-0 shadow-xl overflow-hidden">
                <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-[#6F8A9D]" />
                    Data Preview ({previewData.sampleRows.length} rows)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#75242D] via-[#9E3B47] to-[#546A7A] text-white">
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Ticket ID</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Company</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Machine</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Zone</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Kdx Eng</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Konte Team</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Start/End</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Downtime</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.sampleRows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-red-50/30">
                          <td className="px-3 py-2 text-xs font-mono font-bold text-[#9E3B47]">{row.ticketId || '-'}</td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-700 max-w-[120px] truncate">{row.company || '-'}</td>
                          <td className="px-3 py-2 text-xs font-mono text-gray-600">{row.machineSerial || '-'}</td>
                          <td className="px-3 py-2 text-[10px]">
                            {row.zone ? <Badge variant="outline" className="text-[10px] px-1 py-0">{row.zone}</Badge> : '-'}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-gray-600">{row.owner || '-'}</td>
                          <td className="px-3 py-2 text-[10px] text-gray-600">{row.assigned || '-'}</td>
                          <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">
                            {row.workStart} - {row.workEnd || ''}
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-[#82A094]">{row.downtime || '-'}</td>
                          <td className="px-3 py-2 text-xs text-gray-600 max-w-[150px] truncate">{row.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetImport} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                className="bg-gradient-to-r from-[#9E3B47] to-[#75242D] hover:from-[#75242D] hover:to-[#9E3B47] text-white gap-2 px-6 shadow-lg"
                size="lg"
              >
                <Upload className="h-4 w-4" />
                Start Import ({previewData.totalRows} tickets)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-12 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="p-6 bg-[#9E3B47]/10 rounded-full">
                  <Loader2 className="h-16 w-16 text-[#9E3B47] animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-2 bg-white rounded-full shadow-md">
                  <Ticket className="h-5 w-5 text-[#CE9F6B]" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-800">Importing Tickets...</h3>
                <p className="text-gray-500 mt-2">Processing {previewData?.totalRows || 0} rows. This may take a few minutes.</p>
                <p className="text-xs text-gray-400 mt-1">Please do not close this page.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Result */}
        {step === 'result' && importResult && (
          <div className="space-y-6">
            {/* Summary */}
            <Card className="border-0 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/25 rounded-xl">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Import Complete!</h2>
                    <p className="text-emerald-100">Successfully processed {importResult.totalRead} rows</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center py-4 px-3 bg-gray-50 rounded-xl">
                    <p className="text-3xl font-bold text-gray-800">{importResult.totalRead}</p>
                    <p className="text-xs text-gray-500 mt-1">Total Read</p>
                  </div>
                  <div className="text-center py-4 px-3 bg-emerald-50 rounded-xl">
                    <p className="text-3xl font-bold text-emerald-700">{importResult.imported}</p>
                    <p className="text-xs text-emerald-600 mt-1">New Created</p>
                  </div>
                  <div className="text-center py-4 px-3 bg-amber-50 rounded-xl">
                    <p className="text-3xl font-bold text-amber-700">{importResult.updated}</p>
                    <p className="text-xs text-amber-600 mt-1">Updated</p>
                  </div>
                  <div className="text-center py-4 px-3 bg-red-50 rounded-xl">
                    <p className="text-3xl font-bold text-red-700">{importResult.errors}</p>
                    <p className="text-xs text-red-600 mt-1">Errors</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Details */}
            {importResult.errorDetails.length > 0 && (
              <Card className="border-0 shadow-lg border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Error Details ({importResult.errorDetails.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto">
                  {importResult.errorDetails.map((err, i) => (
                    <div key={i} className="py-2 px-3 text-xs text-red-700 border-b border-red-100 last:border-0">
                      {err}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Import Another File
              </Button>
              <Button onClick={() => router.push('/admin/tickets')} className="bg-[#9E3B47] hover:bg-[#75242D] text-white gap-2">
                <ArrowUpRight className="h-4 w-4" />
                View Tickets
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
