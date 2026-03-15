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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4F6A64] via-[#82A094] to-[#A2B9AF] p-6 sm:p-8 shadow-2xl shadow-[#82A094]/20 group">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10 hidden sm:block">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />
        
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative p-4 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform hover:rotate-3">
              <Users className="w-8 h-8 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#A2B9AF] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                Sync Master
                <span className="px-3 py-1 text-xs font-bold bg-white/20 rounded-lg backdrop-blur-md border border-white/30 uppercase">Enterprise</span>
              </h1>
              <p className="text-white/70 text-sm mt-1 font-medium max-w-xl">
                Bulk-synchronize your customer database with intelligent validation and automated invoice mapping.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white font-bold text-xs uppercase tracking-wide hover:bg-white/25 transition-all active:scale-95 shadow-lg"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
            <button 
              onClick={() => router.push('/finance/ar/customers')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#4F6A64] font-bold text-xs uppercase tracking-wide hover:shadow-xl hover:shadow-white/30 transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Exit
            </button>
          </div>
        </div>
      </div>

      {/* Modern Steps Section */}
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center p-2 rounded-2xl bg-white border-2 border-[#6F8A9D]/30 shadow-lg backdrop-blur-sm">
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
                <div className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-500 ${
                  isActive ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-xl shadow-[#82A094]/30 scale-105' : 'text-[#92A2A5]'
                }`}>
                  <Icon className={`w-5 h-5 ${isPast ? 'text-[#82A094]' : ''}`} />
                  <span className="text-sm font-bold tracking-tight">{s.label}</span>
                </div>
                {index < 2 && <div className="mx-2 w-8 h-0.5 bg-[#AEBFC3]/30" />}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label 
                  className={`relative flex flex-col items-center justify-center cursor-pointer min-h-[500px] border-2 border-dashed rounded-2xl transition-all duration-700 group overflow-hidden bg-white hover:bg-[#82A094]/5 ${
                    dragActive ? 'border-[#82A094] bg-[#82A094]/10 scale-[1.01]' : 'border-[#6F8A9D]/30 hover:border-[#82A094]'
                  }`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
                  
                  <div className={`relative w-28 h-28 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center mb-8 shadow-2xl shadow-[#82A094]/30 transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 ${dragActive ? 'scale-125 rotate-6' : ''}`}>
                    <UploadCloud className="w-14 h-14 text-white" />
                  </div>
                  
                  <div className="text-center px-8 z-10">
                    <h2 className="text-[#546A7A] font-bold text-2xl mb-3">Drop your database here</h2>
                    <p className="text-[#92A2A5] text-base font-medium leading-relaxed max-w-sm mx-auto">
                      Support for standard Excel formats (.xlsx, .xls) for automated master record ingestion.
                    </p>
                    
                    <div className="mt-10 p-3 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 border-2 border-[#CE9F6B]/30">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20">
                        <Info className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs text-[#976E44] font-bold uppercase tracking-wide text-left pr-4">
                        Mandatory: BP Code & Name
                      </span>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>

              {/* Sidebar Info/History */}
              <div className="space-y-6">
                <div className="relative bg-gradient-to-br from-[#4F6A64] via-[#82A094] to-[#A2B9AF] rounded-2xl p-6 text-white shadow-2xl shadow-[#82A094]/20 overflow-hidden group">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-white/30 via-white/50 to-white/30" />
                  <Sparkles className="absolute top-4 right-4 text-white/20 w-12 h-12" />
                  <h3 className="text-lg font-bold mb-4">Quick Guide</h3>
                  <ul className="space-y-4">
                    {[
                      { icon: FileCheck, text: "Use our certified template for zero errors." },
                      { icon: AlertTriangle, text: "Ensure unique BP codes for consistency." },
                      { icon: Grid3X3, text: "System auto-maps columns to record fields." }
                    ].map((item, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-white/90">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={downloadTemplate} className="w-full mt-6 py-3 bg-white text-[#4F6A64] rounded-xl font-bold text-sm uppercase tracking-wide hover:shadow-xl hover:shadow-white/30 hover:-translate-y-0.5 transition-all">Get Template</button>
                </div>

                {result && (
                  <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-6 shadow-xl animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center shadow-lg shadow-[#82A094]/30"><CheckCircle className="w-6 h-6 text-white" /></div>
                      <div>
                        <h4 className="font-bold text-[#546A7A]">Last Sync</h4>
                        <p className="text-xs font-bold text-[#82A094]">{result.success} records processed</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 rounded-xl border border-[#82A094]/20">
                        <span className="text-sm font-bold text-[#4F6A64]">Success</span>
                        <span className="text-lg font-bold text-[#82A094]">{result.success}</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 rounded-xl border border-[#E17F70]/20">
                        <span className="text-sm font-bold text-[#9E3B47]">Failed</span>
                        <span className="text-lg font-bold text-[#E17F70]">{result.failed}</span>
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
              <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-5 shadow-lg hover:shadow-xl hover:border-[#6F8A9D] hover:scale-[1.02] transition-all overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg shadow-[#6F8A9D]/30"><FileSpreadsheet className="w-6 h-6 text-white" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-[#6F8A9D] uppercase tracking-wide">Total Rows</p>
                    <p className="text-2xl font-bold text-[#546A7A]">{totalRows}</p>
                  </div>
                </div>
              </div>
              <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-5 shadow-lg hover:shadow-xl hover:border-[#82A094] hover:scale-[1.02] transition-all overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center shadow-lg shadow-[#82A094]/30"><CheckCircle className="w-6 h-6 text-white" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-[#82A094] uppercase tracking-wide">Valid Rows</p>
                    <p className="text-2xl font-bold text-[#4F6A64]">{preview.validRows}</p>
                  </div>
                </div>
              </div>
              <div className="relative bg-white rounded-2xl border-2 border-[#E17F70]/30 p-5 shadow-lg hover:shadow-xl hover:border-[#E17F70] hover:scale-[1.02] transition-all overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center shadow-lg shadow-[#E17F70]/30"><AlertTriangle className="w-6 h-6 text-white" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-[#E17F70] uppercase tracking-wide">At Risk</p>
                    <p className="text-2xl font-bold text-[#9E3B47]">{preview.invalidRows}</p>
                  </div>
                </div>
              </div>
              <div className="relative bg-gradient-to-br from-[#4F6A64] via-[#82A094] to-[#A2B9AF] rounded-2xl p-5 shadow-xl shadow-[#82A094]/20 hover:shadow-2xl hover:scale-[1.02] transition-all overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-white/30 via-white/50 to-white/30" />
                <div className="flex items-center gap-4 text-white">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm"><Users className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide">Selected</p>
                    <p className="text-2xl font-bold">{selectedRows.size}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Control Bar */}
            <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
                <input 
                  type="text" placeholder="Search preview data..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-gradient-to-r from-[#96AEC2]/5 to-[#6F8A9D]/5 border-2 border-[#6F8A9D]/30 focus:bg-white focus:ring-4 focus:ring-[#6F8A9D]/20 focus:border-[#6F8A9D] transition-all text-sm font-medium text-[#546A7A] placeholder:text-[#92A2A5]"
                />
              </div>
              
              <div className="flex items-center gap-2">
                {(['ALL', 'VALID', 'INVALID'] as FilterType[]).map((f) => (
                  <button 
                    key={f} onClick={() => setFilterType(f)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                      filterType === f ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/30' : 'bg-[#AEBFC3]/10 text-[#92A2A5] hover:bg-[#AEBFC3]/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Premium Table Container */}
            <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
              <div className="px-6 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#6F8A9D]/10 via-[#96AEC2]/5 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-2 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/30"><Eye className="w-5 h-5 text-white" /></div>
                   <h3 className="text-lg font-bold text-[#546A7A]">Synchronization Preview</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={toggleAllRows} className="px-4 py-2 rounded-xl border-2 border-[#AEBFC3]/40 text-xs font-bold uppercase text-[#5D6E73] hover:bg-[#AEBFC3]/10 hover:border-[#92A2A5] transition-all">Toggle All</button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/5 to-transparent">
                      <th className="px-6 py-4 w-20"></th>
                      <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide">Customer Entity</th>
                      <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide">Security & Credit</th>
                      <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide">Contact Info</th>
                      <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#AEBFC3]/20">
                    {currentRows.length > 0 ? currentRows.map((row: any, i: number) => {
                      const globalIndex = preview.preview.indexOf(row);
                      const isSelected = selectedRows.has(globalIndex);
                      const isValid = row._isValid !== false;
                      
                      return (
                        <tr key={i} className={`group ${!isValid ? 'bg-[#E17F70]/5' : isSelected ? 'bg-[#82A094]/5' : 'hover:bg-[#96AEC2]/5'} transition-all`}>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => toggleRowSelection(globalIndex)}
                              disabled={!isValid}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isSelected ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] border-[#82A094] shadow-lg shadow-[#82A094]/30 scale-110' : 'border-[#AEBFC3]/40'
                              } disabled:opacity-30`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#546A7A]">{row.customerName || 'Undefined Customer'}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-[#6F8A9D] uppercase bg-[#6F8A9D]/10 px-2 py-0.5 rounded-lg border border-[#6F8A9D]/20">{row.bpCode || 'NO-CODE'}</span>
                                {row.region && <span className="text-[10px] font-bold text-[#92A2A5] flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {row.region}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#976E44] tracking-tight">{row.creditLimit ? `₹${row.creditLimit.toLocaleString()}` : '₹0'}</span>
                              <span className="text-[10px] font-bold text-[#CE9F6B] uppercase tracking-wide mt-1">Allocation Limit</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 text-xs font-medium text-[#5D6E73]"><Mail className="w-3 h-3 text-[#82A094]" /> {row.emailId || '-'}</div>
                              <div className="flex items-center gap-2 text-xs font-medium text-[#5D6E73]"><Phone className="w-3 h-3 text-[#82A094]" /> {row.contactNo || '-'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             {isValid ? (
                               <div className="inline-flex items-center gap-2 text-[#82A094] bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 px-3 py-1.5 rounded-xl border border-[#82A094]/20">
                                 <CheckCircle className="w-3 h-3" />
                                 <span className="text-[10px] font-bold uppercase">Verified</span>
                               </div>
                             ) : (
                               <div className="inline-flex items-center gap-2 text-[#9E3B47] bg-gradient-to-r from-[#E17F70]/15 to-[#9E3B47]/10 px-3 py-1.5 rounded-xl border border-[#E17F70]/20 relative group">
                                 <AlertCircle className="w-3 h-3" />
                                 <span className="text-[10px] font-bold uppercase">Defective</span>
                                 <div className="absolute right-0 bottom-full mb-3 hidden group-hover:block z-50 p-4 bg-[#546A7A] text-white rounded-xl w-64 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                                    <p className="text-[10px] font-bold uppercase mb-2 text-[#E17F70] tracking-wide">Error Breakdown</p>
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
                      <tr><td colSpan={5} className="py-32 text-center text-[#92A2A5] font-bold">No records match your current sync filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Footbar */}
              <div className="px-6 py-4 border-t-2 border-[#6F8A9D]/20 flex items-center justify-between bg-gradient-to-r from-[#96AEC2]/5 via-transparent to-white">
                 <p className="text-xs font-bold text-[#92A2A5] uppercase tracking-wide">Viewing {startIndex + 1}-{Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} entries</p>
                 <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-white border-2 border-[#AEBFC3]/40 flex items-center justify-center hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] transition-all disabled:opacity-30 shadow-sm"><ChevronLeft className="w-4 h-4 text-[#546A7A]" /></button>
                    <span className="text-sm font-bold px-4 text-[#546A7A]">{currentPage} / {totalPages || 1}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage >= totalPages} className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center hover:shadow-lg hover:shadow-[#6F8A9D]/30 transition-all disabled:opacity-30 shadow-md"><ChevronRight className="w-4 h-4 text-white" /></button>
                 </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="relative bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A] rounded-2xl p-6 shadow-2xl shadow-[#546A7A]/30 flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10 animate-in slide-in-from-bottom-8 duration-700 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-white/30 to-[#82A094]" />
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-sm"><SyncIcon className="w-7 h-7 text-white animate-pulse" /></div>
                <div>
                  <h3 className="text-white font-bold text-xl tracking-tight leading-none">Execute Database Sync</h3>
                  <p className="text-white/70 text-sm font-bold mt-2">Ready to patch <span className="text-[#A2B9AF] font-bold">{selectedRows.size}</span> customer master records into live environment.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button onClick={handleClear} className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-white/10 text-white font-bold uppercase tracking-wide text-xs hover:bg-white/20 border border-white/20 transition-all">Reset Sync</button>
                <button 
                  onClick={handleImport} disabled={selectedRows.size === 0}
                  className="flex-1 sm:flex-initial px-8 py-3 bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-[#82A094]/30 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-30"
                >
                  Confirm Sync <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Importing Progress State */}
        {step === 'importing' && (
          <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-16 text-center shadow-2xl animate-in zoom-in duration-700 flex flex-col items-center overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
             <div className="relative w-40 h-40 mb-10">
                <svg className="w-full h-full -rotate-90">
                   <circle cx="80" cy="80" r="72" className="fill-none stroke-[#AEBFC3]/20 stroke-[8]" />
                   <circle cx="80" cy="80" r="72" className="fill-none stroke-[#82A094] stroke-[8] transition-all duration-300 drop-shadow-lg" 
                     strokeDasharray={452.39} strokeDashoffset={452.39 - (452.39 * importProgress) / 100} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <div className="p-3 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg shadow-[#82A094]/30">
                     <SyncIcon className="w-8 h-8 text-white animate-spin" />
                   </div>
                   <span className="text-2xl font-bold text-[#546A7A] mt-2">{importProgress}%</span>
                </div>
             </div>
             <h3 className="text-[#546A7A] text-2xl font-bold mb-3">Synchronizing Master</h3>
             <p className="text-[#92A2A5] font-bold text-base max-w-sm">Please do not disconnect. Updating secure customer records and mapping associated invoices.</p>
          </div>
        )}

        {/* Result Outcome - Premium Success */}
        {result && (
          <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-8 lg:p-12 shadow-2xl animate-in zoom-in slide-in-from-bottom-8 duration-700 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
            <div className="flex flex-col lg:flex-row items-center gap-10">
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center shadow-2xl shadow-[#82A094]/30 rotate-3"><CheckCircle className="w-14 h-14 text-white" /></div>
                <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-xl flex items-center justify-center shadow-lg shadow-[#CE9F6B]/30 -rotate-12"><Sparkles className="w-5 h-5 text-white" /></div>
              </div>
              
              <div className="flex-1 text-center lg:text-left">
                <h3 className="font-bold text-3xl lg:text-4xl text-[#546A7A] tracking-tight mb-3">Sync Success!</h3>
                <p className="text-[#92A2A5] font-bold text-lg lg:text-xl leading-relaxed">System has successfully reconciled <span className="text-[#4F6A64] font-bold">{result.success}</span> customer entities across our ecosystem.</p>
                
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative p-6 rounded-xl bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/5 border-2 border-[#96AEC2]/20 text-center overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                    <p className="text-[#6F8A9D] text-[10px] font-bold uppercase tracking-wide mb-2">Processed</p>
                    <p className="text-3xl font-bold text-[#546A7A]">{result.total}</p>
                  </div>
                  <div className="relative p-6 rounded-xl bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 border-2 border-[#82A094]/30 text-center overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
                    <p className="text-[#82A094] text-[10px] font-bold uppercase tracking-wide mb-2">Synchronized</p>
                    <p className="text-3xl font-bold text-[#4F6A64]">{result.success}</p>
                  </div>
                  <div className="relative p-6 rounded-xl bg-gradient-to-r from-[#E17F70]/15 to-[#9E3B47]/10 border-2 border-[#E17F70]/30 text-center overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
                    <p className="text-[#E17F70] text-[10px] font-bold uppercase tracking-wide mb-2">Warnings</p>
                    <p className="text-3xl font-bold text-[#9E3B47]">{result.failed}</p>
                  </div>
                </div>

                {/* Database Metrics */}
                <div className="mt-6 p-5 bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/5 rounded-xl border-2 border-[#96AEC2]/20">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full bg-[#82A094]" />
                      <h4 className="text-xs font-bold uppercase text-[#5D6E73] tracking-wide">Database Sync Metrics</h4>
                   </div>
                   <div className="flex items-center justify-between py-2 border-b border-[#AEBFC3]/30">
                      <span className="text-sm font-bold text-[#5D6E73]">Invoices Patched</span>
                      <span className="text-sm font-bold text-[#546A7A]">{result.totalInvoicesUpdated || 0} invoices</span>
                   </div>
                   {result.unmatchedCustomers && result.unmatchedCustomers.length > 0 && (
                     <div className="mt-4">
                        <div className="flex items-center gap-2 text-[#E17F70] mb-2">
                           <AlertCircle className="w-4 h-4" />
                           <span className="text-xs font-bold uppercase">Skipped Customers (No Invoices Found)</span>
                        </div>
                        <div className="max-h-24 overflow-y-auto pr-2">
                           <p className="text-[11px] text-[#92A2A5] leading-relaxed font-medium">
                              These BP Codes were not found as active entities in the AR system. New customers must be added via Invoice Import: 
                              <span className="ml-1 text-[#E17F70] font-bold">{result.unmatchedCustomers.join(', ')}</span>
                           </p>
                        </div>
                     </div>
                   )}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                  <button onClick={() => router.push('/finance/ar/customers')} className="px-8 py-3 bg-gradient-to-r from-[#4F6A64] to-[#82A094] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-[#82A094]/30 hover:-translate-y-0.5 transition-all active:scale-95">Go to Master Table</button>
                  <button onClick={handleClear} className="px-6 py-3 bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] rounded-xl font-bold text-base hover:bg-[#AEBFC3]/10 hover:border-[#92A2A5] transition-all">New Import</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Fallback */}
        {error && !result && (
          <div className="relative bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/40 rounded-2xl p-12 flex flex-col items-center text-center animate-in shake-in duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center mb-6 shadow-2xl shadow-[#E17F70]/30"><XCircle className="w-10 h-10 text-white" /></div>
            <h3 className="text-[#546A7A] font-bold text-2xl tracking-tight mb-3">{error.message}</h3>
            <p className="text-[#9E3B47] font-bold text-lg max-w-lg mb-8 leading-relaxed">{error.details}</p>
            <button onClick={handleClear} className="px-8 py-3 bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-[#E17F70]/30 hover:-translate-y-0.5 transition-all">Return to Controller</button>
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
