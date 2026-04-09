'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { arApi } from '@/lib/ar-api';
import { 
  Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, 
  Sparkles, UploadCloud, FileCheck, Eye, ArrowRight, ArrowLeft, 
  ChevronLeft, ChevronRight, AlertTriangle, XCircle, Loader2,
  Trash2, Grid3X3, Info, Calendar, User, DollarSign, Receipt,
  ClipboardList, MessageSquare, Briefcase, Hash, Plus
} from 'lucide-react';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

interface FieldError {
  field: string;
  message: string;
}

interface ErrorDetails {
  message: string;
  details?: string;
  error?: string;
  missingColumns?: string[];
}

type Step = 'upload' | 'preview' | 'importing';

export default function MilestoneImportPage() {
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
  const rowsPerPage = 20;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      setError({
        message: 'Invalid file type',
        details: 'Please upload an Excel file (.xlsx or .xls)'
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setError(null);
    setImporting(true); // Show loader while previewing

    try {
      const previewData = await arApi.previewExcel(selectedFile);
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
        message: errorData.message || 'Failed to read file',
        details: errorData.details || 'Please check that the file is a valid Excel format (.xlsx or .xls)',
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
    if (!file) return;

    setImporting(true);
    setStep('importing');
    setError(null);

    try {
      const selectedIndicesArray = Array.from(selectedRows);
      const importResult = await arApi.importExcel(file, selectedIndicesArray);
      
      // The API returns { success: number } or { success: false, message: string }
      if (importResult.success !== false) {
        setResult({
          total: selectedIndicesArray.length,
          success: importResult.success,
          failed: selectedIndicesArray.length - importResult.success,
          errors: []
        });
        setFile(null);
        setPreview(null);
        setStep('upload');
      } else {
        throw new Error(importResult.message || 'Import failed');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      const errorData = err.response?.data || err;
      setError({
        message: errorData.message || 'Import failed',
        details: errorData.details || 'An error occurred during the database commit',
        error: errorData.error || err.message
      });
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep('upload');
    setCurrentPage(1);
    setSelectedRows(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBackToUpload = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setCurrentPage(1);
    setSelectedRows(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      // Only allow selecting valid rows
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

  const totalRows = preview?.preview?.length || 0;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const currentRows = preview?.preview?.slice(startIndex, endIndex) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      {/* Step Indicator */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-2">
        {[
          { key: 'upload', label: 'Upload', icon: UploadCloud },
          { key: 'preview', label: 'Review', icon: Eye },
          { key: 'importing', label: 'Import', icon: CheckCircle }
        ].map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isPast = (step === 'preview' && s.key === 'upload') || 
                         (step === 'importing' && (s.key === 'upload' || s.key === 'preview'));
          
          return (
            <div key={s.key} className="flex items-center gap-2 sm:gap-3">
              <div className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all duration-300 overflow-hidden ${
                isActive 
                  ? 'bg-gradient-to-r from-[#CE9F6B]/15 to-[#976E44]/10 border-2 border-[#CE9F6B]/40 shadow-lg shadow-[#CE9F6B]/10' 
                  : isPast 
                    ? 'bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 border-2 border-[#82A094]/30'
                    : 'bg-white border-2 border-[#AEBFC3]/30'
              }`}>
                {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#CE9F6B] to-[#976E44]" />}
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all shadow-lg ${
                  isActive 
                    ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-[#CE9F6B]/30' 
                    : isPast 
                      ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-[#82A094]/20'
                      : 'bg-[#AEBFC3]/30'
                }`}>
                  {isPast ? (
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  ) : (
                    <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-[#92A2A5]'}`} />
                  )}
                </div>
                <span className={`text-xs sm:text-sm font-bold ${
                  isActive ? 'text-[#976E44]' : isPast ? 'text-[#4F6A64]' : 'text-[#92A2A5]'
                }`}>{s.label}</span>
              </div>
              {index < 2 && (
                <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 ${isPast ? 'text-[#82A094]' : 'text-[#AEBFC3]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Premium Header - Milestone Gold Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#E17F70] p-6 sm:p-8 shadow-2xl shadow-[#CE9F6B]/20 group">
        {/* Animated Pattern Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-8 left-12 w-56 h-56 border-4 border-white/30 rounded-full" />
          <div className="absolute top-12 left-1/4 w-20 h-20 border-2 border-white/40 rounded-full" />
        </div>
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer-slide_4s_ease-in-out_infinite]" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative p-4 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl transition-transform hover:rotate-3">
              <FileSpreadsheet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#A2B9AF] rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
                Import Milestones
                <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-white/80 animate-pulse" />
              </h1>
              <p className="text-white/70 text-sm sm:text-base mt-1 font-medium flex items-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>
                  {step === 'upload' && 'Upload Excel files to bulk import milestone receivables'}
                  {step === 'preview' && 'Review milestone data and validate records'}
                  {step === 'importing' && 'Processing database upserts...'}
                </span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white text-sm font-bold hover:bg-white/25 transition-all shadow-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Field Requirements - Added as per USER request */}
      {step === 'upload' && (
        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-[#AEBFC3]/30 p-6 shadow-xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#546A7A]">Data Format Requirements</h3>
                <p className="text-xs text-[#92A2A5]">Ensure your Excel contains these columns for successful mapping</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] text-[10px] font-black uppercase border border-[#E17F70]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E17F70]" /> Mandatory
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#82A094]/10 text-[#4F6A64] text-[10px] font-black uppercase border border-[#82A094]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#82A094]" /> Optional
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mandatory Fields */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#546A7A] uppercase tracking-widest flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-[#E17F70]" /> Required Columns
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Customer', alias: 'BP Name, Sold-To' },
                  { label: 'Total Amount', alias: 'Incl. Taxes' },
                  { label: 'Order Value', alias: 'Net Amount' },
                  { label: 'Invoice Date', alias: 'Doc Date' },
                ].map((f) => (
                  <div key={f.label} className="p-3 rounded-xl bg-gradient-to-br from-[#E17F70]/5 to-[#9E3B47]/5 border border-[#E17F70]/20 group hover:border-[#E17F70]/40 transition-all">
                    <p className="text-sm font-bold text-[#9E3B47]">{f.label}</p>
                    <p className="text-[10px] text-[#9E3B47]/60 mt-0.5 truncate italic">Alias: {f.alias}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-[#546A7A] uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3 h-3 text-[#82A094]" /> Enrichment Columns
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  'SO no.', 'PO No.', 'Booking Month', 'Status', 'TSP', 'Due Date', 'Comments', 'Payment Terms'
                ].map((f) => (
                  <div key={f} className="p-3 rounded-xl bg-gradient-to-br from-[#82A094]/5 to-[#4F6A64]/5 border border-[#82A094]/20 group hover:border-[#82A094]/40 transition-all flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4F6A64]">{f}</span>
                    <Plus className="w-2.5 h-2.5 text-[#82A094] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Upload Area */}
      {step === 'upload' && (
        <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 p-4 sm:p-8 shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <label 
            className={`relative flex flex-col items-center justify-center cursor-pointer py-16 sm:py-24 border-2 border-dashed rounded-2xl transition-all duration-500 group overflow-hidden ${
              dragActive 
                ? 'border-[#CE9F6B] bg-gradient-to-br from-[#CE9F6B]/10 to-[#976E44]/5 scale-[1.02]' 
                : 'border-[#AEBFC3]/40 hover:border-[#CE9F6B]/60 hover:bg-gradient-to-br hover:from-[#CE9F6B]/5 hover:to-[#976E44]/5'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {dragActive && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] animate-pulse" />}
            <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl shadow-[#CE9F6B]/30 ${dragActive ? 'scale-110 rotate-6' : ''}`}>
              <UploadCloud className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
            </div>
            <div className="text-center relative z-10 px-6 max-w-lg">
              <p className="text-[#546A7A] font-bold text-xl sm:text-3xl mb-3">
                {dragActive ? 'Drop file to process' : 'Choose your Milestone file'}
              </p>
              <p className="text-[#92A2A5] text-sm sm:text-lg font-medium leading-relaxed">
                Drag and drop your Excel sheet here or click to browse. We'll automatically detect the format.
              </p>
              <div className="mt-8 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 text-[#976E44] text-xs font-bold uppercase tracking-wide">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  .xlsx / .xls
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#CE9F6B]/30" />
                <div className="flex items-center gap-2 text-[#976E44] text-xs font-bold uppercase tracking-wide">
                  <ArrowRight className="w-4 h-4" />
                  Max 5k Rows
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Step 2: Preview Step */}
      {step === 'preview' && preview && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
          {/* File Info & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 p-6 shadow-xl flex items-center justify-between overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-xl shadow-[#CE9F6B]/20 shrink-0">
                  <FileCheck className="w-7 h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[#546A7A] font-bold text-lg truncate">{file?.name}</p>
                  <p className="text-[#92A2A5] text-sm font-bold mt-1">
                    Sheet: <span className="text-[#CE9F6B]">"{preview.sheetName}"</span> • {totalRows} records found
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleClear}
                  className="p-3 rounded-xl bg-[#E17F70]/10 text-[#9E3B47] hover:bg-[#E17F70]/20 transition-all border border-[#E17F70]/20"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="relative bg-white rounded-2xl border-2 border-[#82A094]/30 p-6 shadow-xl flex flex-col justify-center overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#92A2A5] uppercase tracking-wide">Data Status</p>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#82A094] shadow-[0_0_6px_#82A094]" />
                  <div className="w-2 h-2 rounded-full bg-[#E17F70] shadow-[0_0_6px_#E17F70]" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-[#4F6A64]">{preview.validRows || 0}</p>
                  <p className="text-xs font-bold text-[#82A094] mt-1">Valid Records</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[#9E3B47]">{preview.invalidRows || 0}</p>
                  <p className="text-xs font-bold text-[#E17F70] mt-1">Need Fix</p>
                </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-[#CE9F6B] via-[#976E44] to-[#E17F70] rounded-2xl p-6 shadow-xl shadow-[#CE9F6B]/20 flex flex-col justify-center text-white overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" />
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide mb-2">Selection</p>
              <p className="text-4xl font-bold">{selectedRows.size}</p>
              <p className="text-xs font-bold text-white/80 mt-1 uppercase tracking-wide">Rows to Import</p>
            </div>
          </div>

          {/* Missing Columns Warning */}
          {preview.missingColumns && preview.missingColumns.length > 0 && (
            <div className="relative p-5 rounded-xl bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 flex items-center gap-5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70]" />
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[#976E44] font-bold text-lg">Format Recommendation</p>
                <p className="text-[#976E44]/80 text-sm font-medium mt-0.5">
                  We couldn't find these recommended columns: <span className="font-bold">{preview.missingColumns.join(', ')}</span>. The import will still proceed with available data.
                </p>
              </div>
            </div>
          )}

          {/* Data Preview Table */}
          <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <div className="p-5 sm:p-6 border-b-2 border-[#6F8A9D]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-white/15 border border-white/20">
                  <Grid3X3 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg">Milestone Preview</h3>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleAllRows}
                  className="px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white text-sm font-bold hover:bg-white/25 transition-all shadow-lg"
                >
                  {selectedRows.size === preview?.preview?.filter((r:any)=>r._isValid!==false).length ? 'Unselect All' : 'Select All Valid'}
                </button>
                <div className="h-8 w-px bg-white/20 mx-1 hidden sm:block" />
                <span className="text-white/80 text-sm font-bold">
                  {startIndex + 1}—{endIndex} <span className="text-white/50 text-xs">of</span> {totalRows}
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/5 to-transparent border-b-2 border-[#6F8A9D]/20">
                    <th className="px-6 py-4 w-16">
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 rounded-lg border-2 border-[#6F8A9D]/30 bg-white" />
                      </div>
                    </th>
                    {/* Primary Importance Columns */}
                    <th className="px-6 py-4 text-xs font-bold text-[#6F8A9D] uppercase tracking-wide whitespace-nowrap">
                      <div className="flex items-center gap-2"><Hash className="w-3 h-3" /> Invoice / SO</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide whitespace-nowrap">
                      <div className="flex items-center gap-2"><User className="w-3 h-3" /> Customer</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#976E44] uppercase tracking-wide whitespace-nowrap">
                      <div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Period</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#82A094] uppercase tracking-wide whitespace-nowrap">
                      <div className="flex items-center gap-2"><Briefcase className="w-3 h-3" /> Status</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2"><DollarSign className="w-3 h-3" /> Values</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#CE9F6B] uppercase tracking-wide whitespace-nowrap">
                      <div className="flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Comments</div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-[#546A7A] uppercase tracking-wide">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/20">
                  {currentRows.map((row: any, i: number) => {
                    const globalIndex = startIndex + i;
                    const isSelected = selectedRows.has(globalIndex);
                    const isValid = row._isValid !== false;
                    const rowErrors: FieldError[] = row._errors || [];
                    
                    return (
                      <tr 
                        key={globalIndex}
                        onClick={() => isValid && toggleRowSelection(globalIndex)}
                        className={`group transition-all duration-300 ${
                          !isValid 
                            ? 'bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5 cursor-default' 
                            : isSelected 
                              ? 'bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 hover:from-[#CE9F6B]/15 hover:to-[#976E44]/10' 
                              : 'bg-white hover:bg-[#96AEC2]/5 opacity-100 cursor-pointer'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center relative">
                            <div 
                              onClick={(e) => isValid && e.stopPropagation()}
                              className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer ${
                                !isValid 
                                ? 'border-[#E17F70]/30 bg-[#E17F70]/10 cursor-not-allowed' 
                                : isSelected 
                                  ? 'border-[#CE9F6B] bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-lg shadow-[#CE9F6B]/20' 
                                  : 'border-[#AEBFC3]/40 bg-white group-hover:border-[#CE9F6B]/50'
                              }`}
                            >
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </div>
                          </div>
                        </td>

                        {/* Invoice & SO No. */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-[#546A7A]">#{row.invoiceNumber || 'N/A'}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#92A2A5]">SO: {row.soNo || 'N/A'}</span>
                              {row.actualPaymentTerms && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-[#CE9F6B]/40" />
                                  <span className="text-[10px] font-bold text-[#CE9F6B]">{row.actualPaymentTerms}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4">
                          <div className="max-w-[200px]">
                            <p className="text-sm font-bold text-[#546A7A] truncate">{row.customerName || 'N/A'}</p>
                            {row.poNo && <p className="text-[10px] font-bold text-[#976E44] truncate mt-0.5">PO: {row.poNo}</p>}
                          </div>
                        </td>

                        {/* Booking Month / Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#CE9F6B]/15 to-[#976E44]/10 border border-[#CE9F6B]/20 w-fit">
                              <Calendar className="w-3 h-3 text-[#976E44]" />
                              <span className="text-[10px] font-bold text-[#976E44] uppercase">{row.bookingMonth || 'N/A'}</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#92A2A5] ml-1">{row.invoiceDate || ''}</span>
                          </div>
                        </td>

                        {/* Accounting Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border-2 w-fit ${
                              row.accountingStatus?.toLowerCase().includes('revenue')
                                ? 'bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10 text-[#4F6A64] border-[#82A094]/30'
                                : 'bg-gradient-to-r from-[#CE9F6B]/15 to-[#976E44]/10 text-[#976E44] border-[#CE9F6B]/30'
                            }`}>
                              {row.accountingStatus || 'BACKLOG'}
                            </div>
                            {row.mailToTSP && (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-[#92A2A5]">
                                <UploadCloud className="w-2.5 h-2.5" />
                                <span>TSP: {row.mailToTSP}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Values (Amounts) */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-bold text-[#546A7A]">₹{row.totalAmount || '0'}</span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#92A2A5]">
                              <span>Net: ₹{row.netAmount || '0'}</span>
                              <span className="w-1 h-1 rounded-full bg-[#AEBFC3]/40" />
                              <span>GST: ₹{row.taxAmount || '0'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Finance Comments */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-[#92A2A5] max-w-[150px] truncate italic">
                            {row.financeComments || '---'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isValid ? (
                            <div className="flex items-center gap-2 text-[#82A094] group/status">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10 flex items-center justify-center border-2 border-[#82A094]/30">
                                <CheckCircle className="w-4 h-4" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wide">Ready</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 group/err relative">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 flex items-center justify-center border-2 border-[#E17F70]/30">
                                <AlertTriangle className="w-4 h-4 text-[#E17F70]" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#E17F70]">Invalid</span>
                              
                              <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 hidden group-hover/err:block z-[60] p-4 bg-[#546A7A] text-white text-xs rounded-xl w-64 shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-250">
                                <p className="font-bold text-[9px] uppercase tracking-wide text-[#CE9F6B] mb-2 border-b border-white/10 pb-2">Validation Errors</p>
                                {rowErrors.map((e, idx) => (
                                  <div key={idx} className="flex gap-2 mb-2 last:mb-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E17F70] mt-1 shrink-0" />
                                    <p className="font-bold opacity-90 leading-tight">{e.message}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="relative px-6 py-5 border-t-2 border-[#6F8A9D]/20 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-[#96AEC2]/5 via-transparent to-white overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                <p className="text-[#92A2A5] text-xs font-bold uppercase tracking-wide">
                  Showing <span className="text-[#546A7A]">{startIndex + 1}—{endIndex}</span> of {totalRows}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5 text-[#546A7A]" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1; // Simplified for MVP
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-sm ${
                            currentPage === pageNum
                              ? "bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/20"
                              : "bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#CE9F6B]/10 hover:border-[#CE9F6B]/30 text-[#546A7A]"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] disabled:opacity-30 transition-all shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5 text-[#546A7A]" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="relative bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Ready for Import</p>
                <p className="text-white/70 font-bold text-sm mt-0.5">
                  <span className="text-white">{selectedRows.size}</span> milestone records will be processed and upserted.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBackToUpload}
                className="px-6 py-3 rounded-xl bg-white/15 border border-white/20 text-white font-bold transition-all hover:bg-white/25"
              >
                Upload Different File
              </button>
              <button 
                onClick={handleImport}
                disabled={selectedRows.size === 0}
                className="px-8 py-3 bg-white text-[#976E44] rounded-xl font-bold text-lg flex items-center gap-3 hover:shadow-xl hover:shadow-white/30 disabled:opacity-30 transition-all active:scale-95"
              >
                Commit Import
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="relative bg-white rounded-2xl border-2 border-[#CE9F6B]/30 p-16 sm:p-24 flex flex-col items-center justify-center shadow-xl text-center overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <div className="relative mb-10">
            <div className="w-32 h-32 rounded-full border-8 border-[#CE9F6B]/10 border-t-[#CE9F6B] animate-spin shadow-xl shadow-[#CE9F6B]/20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg">
                <Upload className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
          </div>
          <h3 className="text-[#546A7A] text-3xl font-bold mb-4">Upserting Milestones...</h3>
          <p className="text-[#92A2A5] text-lg font-bold max-w-md mx-auto leading-relaxed">
            We are committing <span className="text-[#CE9F6B]">{selectedRows.size}</span> records to the database. This includes mapping customer codes and creating remarks.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="relative bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 rounded-2xl overflow-hidden shadow-xl animate-in shake duration-500">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#EEC1BF]" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center shrink-0 shadow-lg shadow-[#E17F70]/20">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-[#9E3B47] font-bold text-2xl">{error.message}</h3>
              {error.details && <p className="text-[#9E3B47]/70 font-bold text-lg mt-1">{error.details}</p>}
              
              {error.missingColumns && error.missingColumns.length > 0 && (
                <div className="mt-6 p-4 bg-white/50 rounded-xl border-2 border-[#E17F70]/20">
                  <p className="text-[#9E3B47] text-sm font-bold uppercase tracking-wide mb-3 flex items-center justify-center sm:justify-start gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Required Columns Missing
                  </p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    {error.missingColumns.map((col, i) => (
                      <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white text-xs font-bold rounded-lg shadow-lg shadow-[#E17F70]/20">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {error.error && (
                <div className="mt-6 p-4 bg-[#546A7A]/5 rounded-xl text-left border border-[#AEBFC3]/20">
                  <p className="text-[#92A2A5] text-[10px] font-bold uppercase tracking-wide mb-2">Technical Exception</p>
                  <p className="text-[#9E3B47] text-xs font-mono font-bold break-all leading-relaxed whitespace-pre-wrap">{error.error}</p>
                </div>
              )}
            </div>
            <button 
              onClick={handleClear}
              className="px-8 py-3 bg-gradient-to-r from-[#9E3B47] to-[#75242D] text-white rounded-xl font-bold transition-all hover:shadow-lg hover:shadow-[#E17F70]/20 active:scale-95 whitespace-nowrap"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Result Outcome */}
      {result && (
        <div className={`relative p-8 rounded-2xl border-2 overflow-hidden shadow-xl animate-in zoom-in duration-500 ${
          result.failed === 0 
            ? 'bg-gradient-to-br from-[#82A094]/10 via-white to-[#A2B9AF]/5 border-[#82A094]/30' 
            : 'bg-gradient-to-br from-[#CE9F6B]/10 via-white to-[#976E44]/5 border-[#CE9F6B]/30'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${
            result.failed === 0 
              ? 'bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]' 
              : 'bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]'
          }`} />
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
            <div 
              className={`w-20 h-20 rounded-xl flex items-center justify-center shadow-xl relative ${
                result.failed === 0 
                  ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-[#82A094]/30' 
                  : 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-[#CE9F6B]/30'
              }`}
            >
              <CheckCircle className="w-10 h-10 text-white" />
              {result.failed === 0 && <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#CE9F6B] animate-pulse" />}
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h3 className={`font-bold text-2xl sm:text-3xl ${
                result.failed === 0 ? 'text-[#4F6A64]' : 'text-[#976E44]'
              }`}>
                {result.failed === 0 ? 'Import Successful!' : 'Partial Import Complete'}
              </h3>
              <p className="text-[#92A2A5] font-bold text-lg mt-2">
                We've processed <span className="text-[#546A7A] font-bold">{result.total}</span> milestone records.
              </p>
              
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Total Rows', val: result.total, color: '#546A7A', bg: 'bg-gradient-to-r from-[#96AEC2]/15 to-[#6F8A9D]/10', border: 'border-[#6F8A9D]/20' },
                  { label: 'Imported', val: result.success, color: '#4F6A64', bg: 'bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/10', border: 'border-[#82A094]/20' },
                  { label: 'Failed', val: result.failed, color: '#9E3B47', bg: 'bg-gradient-to-r from-[#E17F70]/15 to-[#9E3B47]/10', border: 'border-[#E17F70]/20' }
                ].map((stat, idx) => (
                  <div key={idx} className={`${stat.bg} rounded-xl p-5 border-2 ${stat.border}`}>
                    <p className="text-[#92A2A5] text-[10px] font-bold uppercase tracking-wide mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
                <button 
                  onClick={() => router.push('/finance/ar/milestones')}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#546A7A]/20 transition-all active:scale-95"
                >
                  View Milestones
                </button>
                <button 
                  onClick={handleClear}
                  className="w-full sm:w-auto px-8 py-3 bg-white border-2 border-[#AEBFC3]/40 text-[#546A7A] rounded-xl font-bold text-lg hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] transition-all"
                >
                  Import Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Format Helper */}
      {step === 'upload' && (
        <div className="relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 p-6 sm:p-8 shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20">
              <Info className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-[#546A7A] font-bold text-xl">Required Milestone Columns</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'SO no.', desc: 'Sales Order Number', req: true },
              { label: 'Booking month', desc: 'Forecast/Booking Period', req: true },
              { label: 'Invoice Number', desc: 'Billing Doc Reference', req: false },
              { label: 'Customer', desc: 'Customer/BP Name', req: true },
              { label: 'Accounting status', desc: 'Current Stage Status', req: false },
              { label: 'Order Value', desc: 'Total Amount', req: true },
              { label: 'Invoice Date', desc: 'Billing Date', req: false },
              { label: 'Due Date', desc: 'Final Payment Deadline', req: false },
              { label: 'Finance Comments', desc: 'Internal Remarks', req: false }
            ].map((col, i) => (
              <div key={i} className="group p-4 rounded-xl bg-gradient-to-br from-[#96AEC2]/5 to-[#6F8A9D]/5 hover:from-white hover:to-white border-2 border-[#AEBFC3]/20 hover:border-[#CE9F6B]/30 hover:shadow-lg hover:shadow-[#CE9F6B]/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#546A7A] font-bold text-sm">{col.label}</span>
                  {col.req && <span className="text-[10px] font-bold text-[#CE9F6B] uppercase tracking-wide bg-[#CE9F6B]/10 px-2 py-0.5 rounded">Required</span>}
                </div>
                <p className="text-[#92A2A5] text-xs font-medium leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
