'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { arApi } from '@/lib/ar-api';
import { 
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, 
  Sparkles, UploadCloud, FileCheck, Eye, ArrowRight, ArrowLeft, 
  ChevronLeft, ChevronRight, AlertTriangle, XCircle, Loader2,
  Trash2, Grid3X3, Info, User, Users, Mail, Phone, MapPin, DollarSign,
  Building2, Hash, Search, Filter, HelpCircle, RefreshCw
} from 'lucide-react';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  totalInvoicesUpdated?: number;
  unmatchedCustomers?: string[];
}

interface ErrorDetails {
  message: string;
  details?: string;
  error?: string;
  missingColumns?: string[];
}

type Step = 'upload' | 'preview' | 'importing';
type FilterType = 'ALL' | 'VALID' | 'INVALID';

export default function CustomerImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [importProgress, setImportProgress] = useState(0);
  
  const rowsPerPage = 15;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      setError({
        message: 'Unsupported Format',
        details: 'Excel documents (.xlsx, .xls) are required for customer master updates.'
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setError(null);
    setImporting(true);

    try {
      const previewData = await arApi.previewCustomerExcel(selectedFile);
      setPreview(previewData);
      
      const validIndices = new Set<number>();
      previewData.preview?.forEach((row: any, idx: number) => {
        if (row._isValid !== false) {
          validIndices.add(idx);
        }
      });
      
      setSelectedRows(validIndices);
      setStep('preview');
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Preview error:', err);
      const errorData = err.response?.data || err;
      setError({
        message: errorData.message || 'File Inspection Failed',
        details: errorData.details || 'The selected file could not be parsed. Ensure it matches the required template structure.',
        error: errorData.error || err.message,
        missingColumns: errorData.missingColumns
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setStep('importing');
    setImportProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => Math.min(prev + 5, 95));
    }, 200);

    try {
      const selectedIndicesArray = Array.from(selectedRows);
      const importResult = await arApi.importCustomerExcel(file, selectedIndicesArray);
      
      setImportProgress(100);
      clearInterval(progressInterval);

      if (importResult.success !== false) {
        setResult({
          total: selectedIndicesArray.length,
          success: importResult.totalImported,
          totalInvoicesUpdated: importResult.totalInvoicesUpdated || 0,
          unmatchedCustomers: importResult.unmatchedCustomers || [],
          failed: selectedIndicesArray.length - importResult.totalImported,
          errors: importResult.errors || []
        });
        setFile(null);
        setPreview(null);
        setStep('upload');
      } else {
        throw new Error(importResult.message || 'Import failed');
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Import error:', err);
      const errorData = err.response?.data || err;
      setError({
        message: errorData.message || 'Processing Error',
        details: errorData.details || 'A system error occurred during the database update synchronization.',
        error: errorData.error || err.message
      });
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setFile(null); setPreview(null); setResult(null); setError(null);
    setStep('upload'); setCurrentPage(1); setSelectedRows(new Set());
    setSearchTerm(''); setFilterType('ALL');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      if (preview?.preview?.[index]?._isValid !== false) {
        newSelected.add(index);
      }
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    const validRows = preview?.preview?.filter((r: any) => r._isValid !== false) || [];
    if (selectedRows.size === validRows.length) {
      setSelectedRows(new Set());
    } else {
      const allValid = new Set<number>();
      preview?.preview?.forEach((r: any, idx: number) => {
        if (r._isValid !== false) allValid.add(idx);
      });
      setSelectedRows(allValid);
    }
  };

  const filteredPreview = useMemo(() => {
    if (!preview?.preview) return [];
    return preview.preview.filter((row: any) => {
      const matchesSearch = searchTerm === '' || 
        row.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.bpCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.region?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterType === 'ALL' ||
        (filterType === 'VALID' && row._isValid !== false) ||
        (filterType === 'INVALID' && row._isValid === false);
      
      return matchesSearch && matchesFilter;
    });
  }, [preview, searchTerm, filterType]);

  const totalRows = filteredPreview.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = filteredPreview.slice(startIndex, startIndex + rowsPerPage);

  const downloadTemplate = () => {
    const headers = ["Customer Code", "Customer Name", "Email ID", "Contact No", "Region", "Credit Limit", "Department", "Person In-charge"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customer_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-top-4 duration-1000">
      
      {/* Premium Header with Glassmorphism */}
      <div className="relative overflow-hidden rounded-[32px] bg-[#4F6A64] p-8 sm:p-12 shadow-2xl border border-white/10 group">
        <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/40 via-transparent to-black/20" />
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-5 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform hover:rotate-3">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter flex items-center gap-4">
                Sync Master
                <span className="px-3 py-1 text-xs font-black bg-white/20 rounded-lg backdrop-blur-md border border-white/30 uppercase">Enterprise</span>
              </h1>
              <p className="text-white/70 text-sm sm:text-lg mt-2 font-medium max-w-xl leading-relaxed">
                Seamlessly bulk-synchronize your customer database with intelligent validation and automated invoice mapping.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
            <button 
              onClick={() => router.push('/finance/ar/customers')}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-[#4F6A64] font-black text-xs uppercase tracking-widest hover:shadow-2xl transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Exit
            </button>
          </div>
        </div>
      </div>

      {/* Modern Steps Section */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center p-2 rounded-[24px] bg-white border border-[#AEBFC3]/20 shadow-sm backdrop-blur-sm">
          {[
            { key: 'upload', label: 'Upload Data', icon: UploadCloud },
            { key: 'preview', label: 'Verify & Clean', icon: Eye },
            { key: 'importing', label: 'Synchronize', icon: Sparkles }
          ].map((s, index) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isPast = (step === 'preview' && s.key === 'upload') || (step === 'importing' && (s.key === 'upload' || s.key === 'preview'));
            
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-500 ${
                  isActive ? 'bg-[#82A094] text-white shadow-xl scale-105' : 'text-gray-400'
                }`}>
                  <Icon className={`w-5 h-5 ${isPast ? 'text-[#82A094]' : ''}`} />
                  <span className="text-sm font-black tracking-tight">{s.label}</span>
                </div>
                {index < 2 && <div className="mx-2 w-8 h-px bg-gray-100" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[500px]">
        {/* Upload State */}
        {step === 'upload' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <label 
                  className={`flex flex-col items-center justify-center cursor-pointer min-h-[500px] border-[3px] border-dashed rounded-[48px] transition-all duration-700 group relative overflow-hidden bg-white hover:bg-[#82A094]/5 ${
                    dragActive ? 'border-[#82A094] bg-[#82A094]/10' : 'border-[#AEBFC3]/40'
                  }`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-transparent via-[#82A094]/20 to-transparent" />
                  
                  <div className={`w-32 h-32 rounded-[40px] bg-gradient-to-tr from-[#4F6A64] to-[#82A094] flex items-center justify-center mb-10 shadow-3xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 ${dragActive ? 'scale-125' : ''}`}>
                    <UploadCloud className="w-16 h-16 text-white" />
                  </div>
                  
                  <div className="text-center px-8 z-10">
                    <h2 className="text-gray-900 font-extrabold text-4xl mb-4 tracking-tight">Drop your database here</h2>
                    <p className="text-gray-500 text-lg font-medium leading-relaxed max-w-sm mx-auto">
                      Support for standard Excel formats (.xlsx, .xls) for automated master record ingestion.
                    </p>
                    
                    <div className="mt-12 p-3 inline-flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                        <Info className="w-5 h-5 text-[#82A094]" />
                      </div>
                      <span className="text-xs text-gray-400 font-bold uppercase tracking-widest text-left pr-4">
                        Mandatory: BP Code & Name
                      </span>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>

              {/* Sidebar Info/History */}
              <div className="space-y-6">
                <div className="bg-[#4F6A64] rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                  <Sparkles className="absolute top-4 right-4 text-white/20 w-16 h-16" />
                  <h3 className="text-xl font-black mb-4">Quick Guide</h3>
                  <ul className="space-y-4">
                    {[
                      { icon: FileCheck, text: "Use our certified template for zero errors." },
                      { icon: AlertTriangle, text: "Ensure unique BP codes for consistency." },
                      { icon: Grid3X3, text: "System auto-maps columns to record fields." }
                    ].map((item, idx) => (
                      <li key={idx} className="flex gap-4">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-white/80">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={downloadTemplate} className="w-full mt-8 py-4 bg-white text-[#4F6A64] rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all">Get Template</button>
                </div>

                {result && (
                  <div className="bg-white rounded-[40px] border border-[#AEBFC3]/20 p-8 shadow-xl animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#82A094]/10 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-[#82A094]" /></div>
                      <div>
                        <h4 className="font-extrabold text-gray-900">Last Sync</h4>
                        <p className="text-xs font-bold text-gray-400">{result.success} records processed</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <span className="text-sm font-bold text-gray-500">Success</span>
                        <span className="text-lg font-black text-[#82A094]">{result.success}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl">
                        <span className="text-sm font-bold text-red-400">Failed</span>
                        <span className="text-lg font-black text-red-600">{result.failed}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preview State - Heavy Refactor */}
        {step === 'preview' && preview && (
          <div className="space-y-6 animate-in fade-in duration-700">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-[32px] border border-[#AEBFC3]/20 p-6 shadow-xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-[#82A094] flex items-center justify-center shadow-lg"><FileSpreadsheet className="w-7 h-7 text-white" /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Rows</p>
                  <p className="text-2xl font-black text-gray-900">{totalRows}</p>
                </div>
              </div>
              <div className="bg-white rounded-[32px] border border-[#AEBFC3]/20 p-6 shadow-xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg"><CheckCircle className="w-7 h-7 text-white" /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valid Rows</p>
                  <p className="text-2xl font-black text-green-600">{preview.validRows}</p>
                </div>
              </div>
              <div className="bg-white rounded-[32px] border border-[#AEBFC3]/20 p-6 shadow-xl flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg"><AlertTriangle className="w-7 h-7 text-white" /></div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">At Risk</p>
                  <p className="text-2xl font-black text-red-600">{preview.invalidRows}</p>
                </div>
              </div>
              <div className="bg-[#4F6A64] rounded-[32px] p-6 shadow-xl shadow-[#4F6A64]/20 flex items-center gap-5 text-white">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm"><Users className="w-7 h-7" /></div>
                <div>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Selected</p>
                  <p className="text-2xl font-black">{selectedRows.size}</p>
                </div>
              </div>
            </div>

            {/* Table Control Bar */}
            <div className="bg-white rounded-[28px] border border-[#AEBFC3]/20 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" placeholder="Search preview data..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-[#82A094]/5 focus:border-[#82A094]/50 transition-all text-sm font-medium"
                />
              </div>
              
              <div className="flex items-center gap-2">
                {(['ALL', 'VALID', 'INVALID'] as FilterType[]).map((f) => (
                  <button 
                    key={f} onClick={() => setFilterType(f)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      filterType === f ? 'bg-[#82A094] text-white shadow-lg shadow-[#82A094]/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Premium Table Container */}
            <div className="bg-white rounded-[40px] border border-[#AEBFC3]/20 shadow-2xl overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-[#82A094] rounded-full" />
                   <h3 className="text-xl font-black text-gray-900">Synchronization Preview</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={toggleAllRows} className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-black uppercase text-gray-500 hover:bg-gray-50">Toggle All</button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-8 py-5 w-20"></th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer Entity</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Security & Credit</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Info</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentRows.length > 0 ? currentRows.map((row: any, i: number) => {
                      const globalIndex = preview.preview.indexOf(row);
                      const isSelected = selectedRows.has(globalIndex);
                      const isValid = row._isValid !== false;
                      
                      return (
                        <tr key={i} className={`group ${!isValid ? 'bg-red-50/20' : isSelected ? 'bg-[#82A094]/5' : 'hover:bg-gray-50/50'} transition-all`}>
                          <td className="px-8 py-5">
                            <button 
                              onClick={() => toggleRowSelection(globalIndex)}
                              disabled={!isValid}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'bg-[#82A094] border-[#82A094] shadow-md scale-110' : 'border-gray-200'
                              } disabled:opacity-30`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </button>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-800">{row.customerName || 'Undefined Customer'}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-[#82A094] uppercase bg-[#82A094]/10 px-2 py-0.5 rounded tracking-widest">{row.bpCode || 'NO-CODE'}</span>
                                {row.region && <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {row.region}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-gray-900 tracking-tight">{row.creditLimit ? `₹${row.creditLimit.toLocaleString()}` : '₹0'}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Allocation Limit</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><Mail className="w-3 h-3" /> {row.emailId || '-'}</div>
                              <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><Phone className="w-3 h-3" /> {row.contactNo || '-'}</div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                             {isValid ? (
                               <div className="inline-flex items-center gap-2 text-[#82A094] bg-[#82A094]/10 px-3 py-1.5 rounded-full">
                                 <CheckCircle className="w-3 h-3" />
                                 <span className="text-[10px] font-black uppercase">Verified</span>
                               </div>
                             ) : (
                               <div className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-full relative group">
                                 <AlertCircle className="w-3 h-3" />
                                 <span className="text-[10px] font-black uppercase">Defective</span>
                                 <div className="absolute right-0 bottom-full mb-3 hidden group-hover:block z-50 p-4 bg-gray-900 text-white rounded-2xl w-64 shadow-3xl animate-in fade-in slide-in-from-bottom-2">
                                    <p className="text-[10px] font-black uppercase mb-2 text-red-400 tracking-widest">Error Breakdown</p>
                                    <div className="space-y-1">
                                      {row._errors?.map((err: any, idx: number) => <p key={idx} className="text-xs">• {err.message}</p>)}
                                    </div>
                                 </div>
                               </div>
                             )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={5} className="py-32 text-center text-gray-400 font-bold italic">No records match your current sync filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Footbar */}
              <div className="px-8 py-6 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Viewing {startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} entries</p>
                 <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all disabled:opacity-20 shadow-sm"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-black px-4">{currentPage} / {totalPages || 1}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage >= totalPages} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all disabled:opacity-20 shadow-sm"><ChevronRight className="w-4 h-4" /></button>
                 </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="bg-gray-900 rounded-[40px] p-8 shadow-3xl flex flex-col sm:flex-row items-center justify-between gap-8 border border-white/5 animate-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-[#82A094]/10 border border-[#82A094]/20 flex items-center justify-center shadow-inner"><SyncIcon className="w-8 h-8 text-[#82A094] animate-pulse" /></div>
                <div>
                  <h3 className="text-white font-black text-2xl tracking-tight leading-none">Execute Database Sync</h3>
                  <p className="text-gray-400 text-sm font-bold mt-2">Ready to patch <span className="text-[#82A094]">{selectedRows.size}</span> customer master records into live environment.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button onClick={handleClear} className="flex-1 sm:flex-initial px-8 py-4 rounded-2xl bg-white/5 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all">Reset Sync</button>
                <button 
                  onClick={handleImport} disabled={selectedRows.size === 0}
                  className="flex-1 sm:flex-initial px-12 py-4 bg-[#82A094] text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 hover:shadow-[0_20px_40px_-15px_rgba(130,160,148,0.5)] transition-all active:scale-95 disabled:opacity-20"
                >
                  Confirm Sync <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Importing Progress State */}
        {step === 'importing' && (
          <div className="bg-white rounded-[56px] border border-[#AEBFC3]/20 p-24 text-center shadow-3xl animate-in zoom-in duration-700 flex flex-col items-center">
             <div className="relative w-48 h-48 mb-12">
                <svg className="w-full h-full -rotate-90">
                   <circle cx="96" cy="96" r="88" className="fill-none stroke-gray-100 stroke-[8]" />
                   <circle cx="96" cy="96" r="88" className="fill-none stroke-[#82A094] stroke-[8] transition-all duration-300" 
                     strokeDasharray={552.92} strokeDashoffset={552.92 - (552.92 * importProgress) / 100} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <SyncIcon className="w-10 h-10 text-[#82A094] animate-spin-slow mb-2" />
                   <span className="text-2xl font-black text-gray-900">{importProgress}%</span>
                </div>
             </div>
             <h3 className="text-gray-900 text-4xl font-black mb-4 tracking-tight">Synchronizing Master</h3>
             <p className="text-gray-400 font-bold text-lg max-w-sm">Please do not disconnect. Updating secure customer records and mapping associated invoices.</p>
          </div>
        )}

        {/* Result Outcome - Premium Success */}
        {result && (
          <div className="bg-white rounded-[56px] border border-[#82A094]/30 p-12 lg:p-20 shadow-4xl animate-in zoom-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="relative">
                <div className="w-40 h-40 rounded-[48px] bg-[#82A094] flex items-center justify-center shadow-3xl rotate-3"><CheckCircle className="w-20 h-20 text-white" /></div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-[20px] flex items-center justify-center shadow-xl -rotate-12"><Sparkles className="w-6 h-6 text-white" /></div>
              </div>
              
              <div className="flex-1 text-center lg:text-left">
                <h3 className="font-black text-5xl lg:text-7xl text-gray-900 tracking-tighter mb-4">Sync Success!</h3>
                <p className="text-gray-400 font-bold text-xl lg:text-2xl leading-relaxed">System has successfully reconciled <span className="text-gray-900 font-black">{result.success}</span> customer entities across our ecosystem.</p>
                
                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-8 rounded-[32px] bg-gray-50 border border-gray-100 text-center">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Processed</p>
                    <p className="text-4xl font-black text-gray-900">{result.total}</p>
                  </div>
                  <div className="p-8 rounded-[32px] bg-[#82A094]/10 border border-[#82A094]/20 text-center">
                    <p className="text-[#82A094] text-[10px] font-black uppercase tracking-widest mb-2">Synchronized</p>
                    <p className="text-4xl font-black text-[#82A094]">{result.success}</p>
                  </div>
                  <div className="p-8 rounded-[32px] bg-red-50 border border-red-100 text-center">
                    <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-2">Warnings</p>
                    <p className="text-4xl font-black text-red-600">{result.failed}</p>
                  </div>
                </div>

                {/* Database Metrics */}
                <div className="mt-8 p-6 bg-gray-50 rounded-[32px] border border-gray-100">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-2 h-2 rounded-full bg-[#82A094]" />
                      <h4 className="text-xs font-black uppercase text-gray-500 tracking-widest">Database Sync Metrics</h4>
                   </div>
                   <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-500">Invoices Patched</span>
                      <span className="text-sm font-black text-gray-900">{result.totalInvoicesUpdated || 0} invoices</span>
                   </div>
                   {result.unmatchedCustomers && result.unmatchedCustomers.length > 0 && (
                     <div className="mt-4">
                        <div className="flex items-center gap-2 text-red-500 mb-2">
                           <AlertCircle className="w-4 h-4" />
                           <span className="text-xs font-black uppercase italic">Skipped Customers (No Invoices Found)</span>
                        </div>
                        <div className="max-h-24 overflow-y-auto pr-2">
                           <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                              These BP Codes were not found as active entities in the AR system. New customers must be added via Invoice Import: 
                              <span className="ml-1 text-red-400 font-bold">{result.unmatchedCustomers.join(', ')}</span>
                           </p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="mt-16 flex flex-wrap items-center justify-center lg:justify-start gap-6">
                  <button onClick={() => router.push('/finance/ar/customers')} className="px-12 py-5 bg-[#4F6A64] text-white rounded-[24px] font-black text-lg hover:shadow-3xl transition-all hover:-translate-y-1 active:scale-95">Go to Master Table</button>
                  <button onClick={handleClear} className="px-10 py-5 bg-white border-2 border-gray-200 text-gray-500 rounded-[24px] font-black text-lg hover:bg-gray-50 transition-all">New Import</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Fallback */}
        {error && !result && (
          <div className="bg-red-50 border-2 border-red-100 rounded-[48px] p-20 flex flex-col items-center text-center animate-in shake-in duration-500">
            <div className="w-24 h-24 rounded-[32px] bg-red-100 flex items-center justify-center mb-8 shadow-xl"><XCircle className="w-12 h-12 text-red-600" /></div>
            <h3 className="text-gray-900 font-black text-4xl tracking-tight mb-4">{error.message}</h3>
            <p className="text-red-600/70 font-bold text-xl max-w-lg mb-10 leading-relaxed">{error.details}</p>
            <button onClick={handleClear} className="px-12 py-5 bg-red-600 text-white rounded-2xl font-black text-lg hover:bg-red-700 transition-all shadow-xl hover:-translate-y-1">Return to Controller</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
