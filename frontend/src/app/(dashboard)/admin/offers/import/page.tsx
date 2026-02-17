'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types/user.types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    FileUp,
    Loader2,
    CheckCircle2,
    AlertCircle,
    X,
    ArrowLeft,
    FileSpreadsheet,
    Upload,
    Shield,
    Sparkles,
    Users,
    BarChart3,
    RefreshCw,
    ChevronRight,
    Info,
    FileCheck,
    AlertTriangle
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

export default function ImportOffersPage() {
    const router = useRouter()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()

    const [file, setFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)
    const [previewing, setPreviewing] = useState(false)
    const [preview, setPreview] = useState<any>(null)
    const [result, setResult] = useState<any>(null)
    const [dragActive, setDragActive] = useState(false)

    // Protect this page
    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) {
                router.push('/auth/login?callbackUrl=' + encodeURIComponent('/admin/offers/import'))
                return
            }
            if (user?.role !== UserRole.ADMIN) {
                router.push('/admin/dashboard')
                return
            }
        }
    }, [authLoading, isAuthenticated, user?.role, router])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await processFile(e.target.files[0])
        }
    }

    const processFile = async (selectedFile: File) => {
        setFile(selectedFile)
        setPreview(null)
        setResult(null)

        setPreviewing(true)
        try {
            const previewData = await apiService.previewOfferImport(selectedFile)
            setPreview(previewData)
        } catch (error: any) {
            console.error('Preview failed:', error)
            const errMsg = error?.response?.data?.error || error?.response?.data?.details || 'Failed to parse Excel file'
            toast.error(errMsg)
        } finally {
            setPreviewing(false)
        }
    }

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file first')
            return
        }

        setImporting(true)
        setResult(null)
        try {
            const response = await apiService.importOffers(file)
            setResult(response)
            toast.success('Import completed successfully!')
        } catch (error: any) {
            console.error('Import failed:', error)
            toast.error(error.response?.data?.error || 'Failed to import offers')
        } finally {
            setImporting(false)
        }
    }

    const resetAll = () => {
        setFile(null)
        setPreview(null)
        setPreviewing(false)
        setResult(null)
    }

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0]
            if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
                await processFile(droppedFile)
            } else {
                toast.error('Please upload an Excel file (.xlsx or .xls)')
            }
        }
    }, [])

    // Loading state
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#96AEC2] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[#5D6E73] font-medium">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated || user?.role !== UserRole.ADMIN) {
        return null
    }

    // Calculate preview stats from backend-provided accurate counts
    const totalSheets = preview?.sheets?.length || 0
    const totalOffers = preview?.sheets?.reduce((sum: number, s: any) => sum + s.totalInSheet, 0) || 0
    const newOffers = preview?.totalNewOffers ?? 0
    const updateOffers = preview?.totalUpdateOffers ?? 0
    const matchedSheets = preview?.sheets?.filter((s: any) => s.isMatchedUser)?.length || 0

    return (
        <div className="min-h-screen bg-[#AEBFC3]/10">
            <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#75242D] via-[#9E3B47] to-[#546A7A] rounded-2xl shadow-xl p-6 text-white">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                    <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#4F6A64]/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>

                    <div className="relative z-10">
                        <button
                            onClick={() => router.push('/admin/offers')}
                            className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4 transition-colors group"
                        >
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Offers
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl ring-2 ring-white/30 shadow-lg">
                                <FileUp className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl lg:text-3xl font-bold drop-shadow-md">Import Offers</h1>
                                <p className="text-white/80 text-sm mt-1">Upload your Excel file with the zonewise open/closed offer funnel</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {!result ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left Column - Upload & Guidelines */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Upload Area */}
                            <Card className="border-0 shadow-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] px-6 py-4">
                                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                        <Upload className="h-5 w-5" />
                                        Upload Excel File
                                    </h2>
                                    <p className="text-white/70 text-sm mt-0.5">Select or drag your .xlsx / .xls file</p>
                                </div>
                                <CardContent className="p-6 bg-white">
                                    <div
                                        className={`
                      relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
                      ${dragActive ? 'border-[#9E3B47] bg-[#9E3B47]/5 scale-[1.01]' : ''}
                      ${file ? 'border-green-400 bg-green-50/50' : 'border-slate-200 hover:border-[#9E3B47]/60 hover:bg-slate-50'}
                    `}
                                        onClick={() => !importing && document.getElementById('file-input')?.click()}
                                        onDragEnter={handleDrag}
                                        onDragLeave={handleDrag}
                                        onDragOver={handleDrag}
                                        onDrop={handleDrop}
                                    >
                                        <Input
                                            id="file-input"
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            disabled={importing}
                                            className="hidden"
                                        />

                                        {file ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                                                    <FileCheck className="h-8 w-8 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-bold text-green-700">{file.name}</p>
                                                    <p className="text-sm text-green-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        resetAll()
                                                    }}
                                                >
                                                    <X className="h-4 w-4 mr-1" /> Remove File
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                    <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-base font-semibold text-slate-600">
                                                        {dragActive ? 'Drop your file here...' : 'Click to upload or drag and drop'}
                                                    </p>
                                                    <p className="text-sm text-slate-400 mt-1">Supports .xlsx and .xls formats</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Preview Loading */}
                            {previewing && (
                                <Card className="border-0 shadow-xl overflow-hidden">
                                    <CardContent className="p-10 bg-white">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="relative">
                                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#9E3B47] to-[#75242D] flex items-center justify-center shadow-lg">
                                                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
                                                    <BarChart3 className="h-3.5 w-3.5 text-white" />
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-lg font-bold text-[#546A7A]">Analyzing Your File...</p>
                                                <p className="text-sm text-slate-400 mt-1">Comparing with existing records in the database</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Preview Results */}
                            {preview && (
                                <Card className="border-0 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] px-6 py-4">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                                <BarChart3 className="h-5 w-5" />
                                                File Preview
                                            </h2>
                                            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold hover:bg-white/20">
                                                {preview.totalRows} Rows Found
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-0 bg-white">
                                        {/* Preview Stats */}
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 border-b border-slate-100">
                                            <div className="p-4 text-center border-r border-slate-100">
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Sheets</p>
                                                <p className="text-2xl font-black text-[#546A7A] mt-1">{totalSheets}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{matchedSheets} matched</p>
                                            </div>
                                            <div className="p-4 text-center border-r border-slate-100">
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Offers</p>
                                                <p className="text-2xl font-black text-[#546A7A] mt-1">{totalOffers}</p>
                                            </div>
                                            <div className="p-4 text-center border-r border-slate-100">
                                                <p className="text-[10px] text-green-500 uppercase font-black tracking-widest">New</p>
                                                <p className="text-2xl font-black text-green-600 mt-1">{newOffers}</p>
                                            </div>
                                            <div className="p-4 text-center border-r border-slate-100">
                                                <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest">Updates</p>
                                                <p className="text-2xl font-black text-blue-600 mt-1">{updateOffers}</p>
                                            </div>
                                            <div className="p-4 text-center">
                                                <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest">Skipped</p>
                                                <p className="text-2xl font-black text-amber-600 mt-1">{totalSheets - matchedSheets}</p>
                                                <p className="text-[10px] text-amber-400 mt-0.5">no user match</p>
                                            </div>
                                        </div>

                                        {/* All-updates info banner */}
                                        {newOffers === 0 && updateOffers > 0 && (
                                            <div className="mx-6 mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                                                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-blue-700 leading-relaxed">
                                                    <strong>All {updateOffers} offers already exist</strong> in the database. Importing will update them with the latest values from this file. No new offers will be created.
                                                </p>
                                            </div>
                                        )}

                                        {/* Sheet-wise Summary Table */}
                                        <div className="p-6">
                                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200">
                                                            <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wider">Sheet / User</th>
                                                            <th className="px-4 py-3 text-center font-bold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                                                            <th className="px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wider">Offers</th>
                                                            <th className="px-4 py-3 text-center font-bold text-green-600 text-xs uppercase tracking-wider">New</th>
                                                            <th className="px-4 py-3 text-center font-bold text-blue-600 text-xs uppercase tracking-wider">Updates</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {preview.sheets.map((sheet: any, idx: number) => (
                                                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${!sheet.isMatchedUser ? 'opacity-50' : ''}`}>
                                                                <td className="px-5 py-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm text-white font-bold text-xs ${sheet.isMatchedUser ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`}>
                                                                            <Users className="h-4 w-4" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-slate-700">{sheet.sheetName}</p>
                                                                            {sheet.isMatchedUser && sheet.matchedUserName && (
                                                                                <p className="text-[11px] text-green-600 font-medium">→ {sheet.matchedUserName}</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {sheet.isMatchedUser ? (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                                            <CheckCircle2 className="h-3 w-3" /> Ready
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                                                                            <AlertTriangle className="h-3 w-3" /> Skip
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-bold text-slate-600">{sheet.totalInSheet}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${(sheet.newCount || 0) > 0 ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-50'}`}>
                                                                        {sheet.newCount || 0}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${(sheet.updateCount || 0) > 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-50'}`}>
                                                                        {sheet.updateCount || 0}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right Column - Guidelines & Actions */}
                        <div className="space-y-6">

                            {/* Import Guidelines */}
                            <Card className="border-0 shadow-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3.5">
                                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Import Guidelines
                                    </h3>
                                </div>
                                <CardContent className="p-5 bg-white space-y-3">
                                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                        <Shield className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-amber-800 leading-relaxed">Sheet names must match service person names in the system.</p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                        <FileSpreadsheet className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-800 leading-relaxed">Required columns: <strong>SL, Company, Offer Ref, Offer Value</strong></p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                                        <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-purple-800 leading-relaxed">Offer Reference Number is mandatory and used for uniqueness.</p>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-teal-50 rounded-xl border border-teal-100">
                                        <BarChart3 className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-teal-800 leading-relaxed">Multi-line items with same Offer Ref will be combined automatically.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Action Buttons */}
                            <Card className="border-0 shadow-xl overflow-hidden">
                                <CardContent className="p-5 bg-white space-y-3">
                                    <Button
                                        onClick={handleImport}
                                        disabled={importing || !file || !preview}
                                        className={`
                      w-full h-14 rounded-xl shadow-lg transition-all duration-300 text-base font-bold
                      ${!file || !preview
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-[#9E3B47] to-[#75242D] hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-white'}
                    `}
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <FileUp className="mr-2 h-5 w-5" />
                                                Start Import
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={resetAll}
                                        disabled={importing || (!file && !preview)}
                                        className="w-full h-12 rounded-xl border-2 hover:bg-slate-50 font-semibold disabled:opacity-40"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Reset
                                    </Button>

                                    <div className="pt-2 border-t border-slate-100">
                                        <Button
                                            variant="ghost"
                                            onClick={() => router.push('/admin/offers')}
                                            className="w-full h-10 rounded-xl text-slate-500 hover:text-[#546A7A] hover:bg-slate-50 font-medium text-sm"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back to Offers
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Status Indicator */}
                            {file && (
                                <div className="p-4 bg-white rounded-2xl shadow-lg border-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`h-3 w-3 rounded-full ${preview ? 'bg-green-500' : previewing ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                        <span className="text-sm font-semibold text-slate-600">
                                            {previewing ? 'Analyzing...' : preview ? 'Ready to Import' : 'Processing...'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            <span className="text-xs text-slate-500">File uploaded</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {preview ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            ) : previewing ? (
                                                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                                            ) : (
                                                <div className="h-4 w-4 rounded-full border-2 border-slate-200" />
                                            )}
                                            <span className="text-xs text-slate-500">File analyzed</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 rounded-full border-2 border-slate-200" />
                                            <span className="text-xs text-slate-500">Import complete</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Result View */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">

                        {/* Success Banner */}
                        <Card className="border-0 shadow-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-2 ring-white/30">
                                        <CheckCircle2 className="h-9 w-9 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">Import Completed!</h2>
                                        <p className="text-white/80 text-sm mt-1">Successfully processed {result.totalRead} rows from your Excel file</p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Result Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                                <CardContent className="p-6 bg-white text-center">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-3">
                                        <FileSpreadsheet className="h-6 w-6 text-slate-500" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Rows Read</p>
                                    <p className="text-3xl font-black text-slate-700 mt-1">{result.totalRead}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                                <CardContent className="p-6 bg-white text-center">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <p className="text-[10px] text-green-500 uppercase font-black tracking-widest">Imported</p>
                                    <p className="text-3xl font-black text-green-700 mt-1">{result.imported}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                                <CardContent className="p-6 bg-white text-center">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mx-auto mb-3">
                                        <RefreshCw className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest">Updated</p>
                                    <p className="text-3xl font-black text-blue-700 mt-1">{result.updated}</p>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                                <CardContent className="p-6 bg-white text-center">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="h-6 w-6 text-red-600" />
                                    </div>
                                    <p className="text-[10px] text-red-500 uppercase font-black tracking-widest">Errors</p>
                                    <p className="text-3xl font-black text-red-700 mt-1">{result.errors}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sheet-wise Details */}
                        {result.details && result.details.length > 0 && (
                            <Card className="border-0 shadow-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] px-6 py-4">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        Sheet-wise Breakdown
                                    </h3>
                                </div>
                                <CardContent className="p-0 bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-6 py-3.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wider">Sheet / User</th>
                                                    <th className="px-6 py-3.5 text-center font-bold text-slate-600 text-xs uppercase tracking-wider">Rows Read</th>
                                                    <th className="px-6 py-3.5 text-center font-bold text-green-600 text-xs uppercase tracking-wider">New</th>
                                                    <th className="px-6 py-3.5 text-center font-bold text-blue-600 text-xs uppercase tracking-wider">Updated</th>
                                                    <th className="px-6 py-3.5 text-center font-bold text-red-600 text-xs uppercase tracking-wider">Errors</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {result.details.map((d: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                                                    {d.sheetName?.charAt(0)?.toUpperCase() || 'S'}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-700">{d.sheetName}</p>
                                                                    {d.user && <p className="text-xs text-slate-400">{d.user}</p>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-center font-semibold text-slate-600">{d.read}</td>
                                                        <td className="px-6 py-3.5 text-center">
                                                            <span className="font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-xs">{d.imported}</span>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-center">
                                                            <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full text-xs">{d.updated}</span>
                                                        </td>
                                                        <td className="px-6 py-3.5 text-center">
                                                            <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${d.errors > 0 ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
                                                                {d.errors || 0}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                onClick={() => router.push('/admin/offers')}
                                className="flex-1 h-14 rounded-xl bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] text-white font-bold text-base shadow-lg transition-all"
                            >
                                <ChevronRight className="mr-2 h-5 w-5" />
                                Go to Offers
                            </Button>
                            <Button
                                variant="outline"
                                onClick={resetAll}
                                className="flex-1 h-14 rounded-xl border-2 hover:bg-slate-50 font-bold text-base"
                            >
                                <RefreshCw className="mr-2 h-5 w-5" />
                                Import Another File
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
