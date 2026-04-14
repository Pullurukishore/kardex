'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { arApi } from '@/lib/ar-api';
import { 
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, 
  Sparkles, UploadCloud, FileCheck, Eye, ArrowRight, ArrowLeft, 
  ChevronLeft, ChevronRight, List, Grid3X3, AlertTriangle, 
  Info, XCircle, CreditCard, Banknote, Calendar, User, 
  Hash, ClipboardList, Wallet
} from 'lucide-react';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  message?: string;
}

interface Step {
  id: 'upload' | 'preview' | 'importing' | 'summary';
  title: string;
}

const STEPS: Step[] = [
  { id: 'upload', title: 'Upload Excel' },
  { id: 'preview', title: 'Preview & Validate' },
  { id: 'importing', title: 'Processing' },
  { id: 'summary', title: 'Import Complete' }
];

export default function PaymentImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'importing' | 'summary'>('upload');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const rowsPerPage = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      await arApi.downloadPaymentTemplate();
    } catch (err) {
      console.error('Template download failed:', err);
      alert('Failed to download template. Please try again.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setImporting(true);

    try {
      const previewData = await arApi.previewPaymentExcel(selectedFile);
      setData(previewData);
      
      const validIndices = new Set<number>();
      (previewData.rows || []).forEach((row: any) => {
        if (row.isValid) validIndices.add(row.index);
      });
      setSelectedIndices(validIndices);
      
      setCurrentStep('preview');
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Preview error:', err);
      setError({
        title: 'Upload Failed',
        message: err.response?.data?.error || 'Failed to read the Excel file.',
        details: err.response?.data?.message
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!data?.rows) return;
    
    setImporting(true);
    setCurrentStep('importing');
    
    try {
      const res = await arApi.importPaymentExcel(data.rows, Array.from(selectedIndices));
      setResult({
        total: Array.from(selectedIndices).length,
        success: res.count,
        failed: Array.from(selectedIndices).length - res.count,
        message: res.message
      });
      setCurrentStep('summary');
    } catch (err: any) {
      console.error('Import error:', err);
      setError({
        title: 'Import Failed',
        message: err.response?.data?.error || 'A system error occurred during import.',
        details: err.response?.data?.message
      });
      setCurrentStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const toggleRow = (index: number) => {
    const nextIdx = new Set(selectedIndices);
    if (nextIdx.has(index)) nextIdx.delete(index);
    else nextIdx.add(index);
    setSelectedIndices(nextIdx);
  };

  const toggleAllOnPage = () => {
    const pageRows = currentRows;
    const allSelected = pageRows.every((r: any) => selectedIndices.has(r.index));
    const nextIdx = new Set(selectedIndices);
    
    pageRows.forEach((r: any) => {
      if (allSelected) nextIdx.delete(r.index);
      else if (r.isValid) nextIdx.add(r.index);
    });
    
    setSelectedIndices(nextIdx);
  };

  const currentRows = data?.rows?.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage) || [];
  const totalPages = Math.ceil((data?.rows?.length || 0) / rowsPerPage);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 group">
        <div className="relative">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-2 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Invoices
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
              <Banknote className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bulk Payment Import</h1>
              <p className="text-slate-500 font-medium">Weekly batch update from Excel</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all border border-slate-200 hover:border-slate-300 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Fixed Template
          </button>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="mb-12">
        <div className="flex items-center justify-between max-w-3xl mx-auto relative px-4">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-700 ease-in-out" 
            style={{ width: currentStep === 'upload' ? '0%' : currentStep === 'preview' ? '50%' : '100%' }}
          />
          
          {STEPS.map((s, i) => {
            const isActive = currentStep === s.id;
            const isDone = i < STEPS.findIndex(st => st.id === currentStep);
            
            return (
              <div key={s.id} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg ${
                  isActive ? 'bg-blue-600 text-white scale-125 ring-4 ring-blue-100' : 
                  isDone ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border-2 border-slate-200'
                }`}>
                  {isDone ? <CheckCircle className="w-5 h-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                </div>
                <span className={`absolute -bottom-7 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${isActive ? 'text-blue-700' : 'text-slate-400'}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-16">
        {error && (
          <div className="max-w-3xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl flex gap-5 shadow-sm overflow-hidden relative group">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-red-900 font-bold text-lg mb-1">{error.title}</h3>
                <p className="text-red-700 font-medium leading-relaxed">{error.message}</p>
                {error.details && (
                  <div className="mt-3 p-3 bg-white/60 rounded-xl border border-red-200 font-mono text-xs text-red-800">
                    {error.details}
                  </div>
                )}
              </div>
              <button onClick={() => setError(null)} className="p-2 text-red-400 hover:text-red-600 transition-colors self-start">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 'upload' && (
          <div className="max-w-3xl mx-auto">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative h-[400px] rounded-[40px] border-4 border-dashed transition-all duration-500 flex flex-col items-center justify-center p-12 text-center group overflow-hidden ${
                dragActive ? 'border-blue-600 bg-blue-50/50 scale-102' : 'border-slate-200 bg-white hover:border-slate-300 shadow-xl'
              }`}
            >
              <div className="absolute top-10 right-10 animate-pulse text-blue-200"><Sparkles className="w-12 h-12" /></div>
              <div className="absolute bottom-10 left-10 animate-pulse delay-700 text-indigo-200"><Sparkles className="w-8 h-8" /></div>
              
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-blue-400 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />
                <div className="relative w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[35px] flex items-center justify-center shadow-2xl group-hover:rotate-6 transition-transform duration-500">
                  <UploadCloud className="w-14 h-14 text-white" />
                </div>
              </div>

              <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Drop your Excel here</h2>
              <p className="text-slate-500 max-w-sm font-medium mb-10 leading-relaxed text-lg">
                Upload the weekly fixed payment template to update multiple invoices at once
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="px-10 py-4 bg-slate-900 text-white rounded-[20px] font-bold text-lg hover:bg-slate-800 transition-all flex items-center gap-3 shadow-xl hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                >
                  {importing ? (
                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6" />
                  )}
                  Select File
                </button>
              </div>
            </div>
            
            <div className="mt-12 p-8 bg-blue-900/5 rounded-[30px] border border-blue-100 flex gap-6 items-start shadow-sm">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-200">
                <Info className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-blue-900 font-bold text-lg mb-2">Important Instructions</h4>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {[
                    'Use the fixed Excel format provided',
                    'Invoice No is the lookup key (Required)',
                    'Dates must be in DD/MM/YYYY format',
                    'Payments can exceed balance (will show warning)',
                    'Multiple payments for same invoice are okay',
                    'Reference Bank & Notes are optional'
                  ].map((text, idx) => (
                    <li key={idx} className="flex gap-2 text-sm font-semibold text-blue-700/80 items-center">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-blue-100 flex flex-wrap gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-900/60">Accepted Modes:</span>
                  {['Receipt', 'TDS', 'LD', 'Other', 'NEFT', 'RTGS'].map(mode => (
                    <span key={mode} className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-blue-100 text-blue-600 italic">"{mode}"</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'preview' && data && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Rows', val: data.summary.totalRows, icon: ClipboardList, color: 'blue' },
                { label: 'Valid Rows', val: data.summary.validRows, icon: CheckCircle, color: 'emerald' },
                { label: 'Invalid / Errors', val: data.summary.invalidRows, icon: XCircle, color: 'red' },
                { label: 'Total Amount', val: formatCurrency(data.summary.totalAmount), icon: Wallet, color: 'indigo' },
              ].map((stat, i) => (
                <div key={i} className={`bg-white p-5 rounded-[25px] border border-slate-100 shadow-sm flex items-center gap-4 group`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm bg-slate-50 group-hover:bg-slate-100`}>
                    <stat.icon className={`w-6 h-6 text-slate-600`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                    <p className="text-xl font-black text-slate-800">{stat.val}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[35px] border border-slate-100 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    Preview Data
                  </h3>
                  <div className="h-6 w-px bg-slate-200" />
                  <span className="text-sm font-bold text-slate-500">
                    Selected: <span className="text-blue-600">{selectedIndices.size}</span> / {data.summary.totalRows}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold px-2 text-slate-600">Page {currentPage} of {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-16">
                        <div className="flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={currentRows.length > 0 && currentRows.every((r: any) => selectedIndices.has(r.index))}
                            onChange={toggleAllOnPage}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest w-24">Row</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Invoice No</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Mode</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Bank</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Notes</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">Status / Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row: any) => (
                      <tr key={row.index} className={`border-t border-slate-50 hover:bg-slate-50/30 transition-colors ${!row.isValid ? 'bg-red-50/10' : ''}`}>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            disabled={!row.isValid}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-20"
                            checked={selectedIndices.has(row.index)}
                            onChange={() => toggleRow(row.index)}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-400">#{row.index}</td>
                        <td className="px-6 py-4 text-sm font-black text-slate-800">{row.invoiceNo}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-600 truncate max-w-[150px]">{row.customerName}</td>
                        <td className="px-6 py-4 text-sm font-black text-blue-700 text-right">{formatCurrency(row.amount)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">
                          {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            row.paymentMode === 'CASH' ? 'bg-amber-100 text-amber-700' :
                            row.paymentMode === 'TDS' ? 'bg-orange-100 text-orange-700' :
                            row.paymentMode === 'LD' ? 'bg-rose-100 text-rose-700' :
                            row.paymentMode === 'ADJUSTMENT' || row.paymentMode === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {row.paymentMode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                          {row.referenceBank || '-'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[150px]">
                          {row.notes || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            {row.isValid && row.warnings.length === 0 && (
                              <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                <CheckCircle className="w-3.5 h-3.5" /> Valid
                              </div>
                            )}
                            
                            {row.warnings.map((w: string, i: number) => (
                              <div key={i} className="flex items-start gap-1.5 text-amber-600 text-[10px] font-bold leading-tight">
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                              </div>
                            ))}
                            
                            {row.errors.map((e: string, i: number) => (
                              <div key={i} className="flex items-start gap-1.5 text-red-600 text-[10px] font-bold leading-tight">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {e}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
              <button 
                onClick={() => {
                  setCurrentStep('upload');
                  setData(null);
                  setFile(null);
                }}
                className="px-8 py-3.5 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ArrowLeft className="w-5 h-5" />
                Discard & Reselect
              </button>
              
              <button 
                onClick={handleImport}
                disabled={selectedIndices.size === 0 || importing}
                className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black text-xl flex items-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
              >
                {importing ? (
                   <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-6 h-6" />
                )}
                Import {selectedIndices.size} Payments
              </button>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <div className="max-w-xl mx-auto py-20 animate-in fade-in duration-500">
            <div className="bg-white rounded-[40px] p-12 border border-slate-100 shadow-2xl flex flex-col items-center text-center">
              <div className="w-32 h-32 relative mb-10">
                <div className="absolute inset-0 border-8 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-8 border-t-blue-600 border-r-indigo-500 rounded-full animate-spin" />
                <div className="absolute inset-4 bg-blue-50 rounded-full flex items-center justify-center">
                  <UploadCloud className="w-12 h-12 text-blue-600 animate-bounce" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Processing Payments</h2>
              <p className="text-slate-500 font-medium max-w-xs leading-relaxed">
                Applying payments to your invoices and recalculating balances...
              </p>
            </div>
          </div>
        )}

        {currentStep === 'summary' && result && (
          <div className="max-w-2xl mx-auto animate-in zoom-in-95 fade-in duration-500">
            <div className="bg-white rounded-[45px] border border-slate-100 shadow-2xl overflow-hidden text-center">
              <div className="p-12 pb-0">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-[30px] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Import Successful</h2>
                <p className="text-slate-500 font-bold mb-10">{result.message}</p>
                
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-12">
                  <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 group transition-all hover:bg-emerald-50">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Success</p>
                    <p className="text-3xl font-black text-emerald-800">{result.success}</p>
                  </div>
                  <div className={`p-6 rounded-3xl border group transition-all ${result.failed > 0 ? 'bg-red-50/50 border-red-100 hover:bg-red-50' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${result.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>Failed</p>
                    <p className={`text-3xl font-black ${result.failed > 0 ? 'text-red-800' : 'text-slate-800'}`}>{result.failed}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50/80 p-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => router.push('/finance/ar/invoices')}
                  className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 shadow-xl transition-all hover:-translate-y-1 active:scale-95"
                >
                  <List className="w-5 h-5" />
                  View All Invoices
                </button>
                <button 
                  onClick={() => {
                    setFile(null);
                    setData(null);
                    setResult(null);
                    setCurrentStep('upload');
                  }}
                  className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Import Another File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
