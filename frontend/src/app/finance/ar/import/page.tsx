'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { arApi } from '@/lib/ar-api';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, Sparkles, UploadCloud, FileCheck, Eye, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, List, Grid3X3, AlertTriangle, Info, XCircle } from 'lucide-react';

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

export default function ARImportPage() {
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
    setFile(selectedFile);
    setResult(null);
    setError(null);

    try {
      const previewData = await arApi.previewExcel(selectedFile);
      
      if (previewData.isMilestone) {
        throw { 
          response: { 
            data: { 
              message: 'Invalid File Format', 
              details: 'This page only supports Regular Invoice imports. Milestone files cannot be imported here.' 
            } 
          } 
        };
      }

      setPreview(previewData);
      const allRows = new Set<number>();
      for (let i = 0; i < (previewData.preview?.length || 0); i++) {
        allRows.add(i);
      }
      setSelectedRows(allRows);
      setStep('preview');
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Preview error:', err);
      setPreview({ totalRows: '?', headers: [], preview: [] });
      
      const errorData = err.response?.data || err;
      setError({
        message: errorData.message || 'Failed to read file',
        details: errorData.details || 'Please check that the file is a valid Excel format (.xlsx or .xls)',
        error: errorData.error || err.message,
        missingColumns: errorData.missingColumns
      });
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
      // Convert selected row indices to array and pass to import API
      const selectedIndicesArray = Array.from(selectedRows);
      const importResult = await arApi.importExcel(file, selectedIndicesArray);
      setResult(importResult);
      setFile(null);
      setPreview(null);
      setStep('upload');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Import error:', err);
      const errorData = err.response?.data || err;
      setError({
        message: errorData.message || 'Import failed',
        details: errorData.details || 'Please check your file format and try again',
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
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === (preview?.preview?.length || 0)) {
      setSelectedRows(new Set());
    } else {
      const allRows = new Set<number>();
      for (let i = 0; i < (preview?.preview?.length || 0); i++) {
        allRows.add(i);
      }
      setSelectedRows(allRows);
    }
  };

  const totalRows = preview?.preview?.length || 0;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const currentRows = preview?.preview?.slice(startIndex, endIndex) || [];

  return (
    <div className="space-y-6 w-full relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#CE9F6B]/10 to-[#976E44]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Step Indicator */}
      <div className="relative flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-2">
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
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-gradient-to-r from-[#82A094]/20 to-[#82A094]/10 border-2 border-[#82A094]/40' 
                  : isPast 
                    ? 'bg-[#82A094]/10 border border-[#82A094]/20'
                    : 'bg-white border-2 border-[#AEBFC3]/30'
              }`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
                  isActive 
                    ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64]' 
                    : isPast 
                      ? 'bg-[#82A094]'
                      : 'bg-[#AEBFC3]/30'
                }`}>
                  {isPast ? (
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  ) : (
                    <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-[#92A2A5]'}`} />
                  )}
                </div>
                <span className={`text-xs sm:text-sm font-medium ${
                  isActive ? 'text-[#4F6A64]' : isPast ? 'text-[#82A094]' : 'text-[#92A2A5]'
                }`}>{s.label}</span>
              </div>
              {index < 2 && (
                <ArrowRight className={`w-3 h-3 sm:w-4 sm:h-4 ${isPast ? 'text-[#82A094]' : 'text-[#AEBFC3]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Premium Header - Green Import Theme */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF] p-5 sm:p-8 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-12 w-32 h-32 border-4 border-white rounded-full" />
          <div className="absolute -bottom-8 right-32 w-48 h-48 border-4 border-white rounded-full" />
        </div>

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30 transition-all duration-300 hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 shadow-lg">
              <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              Import Invoices
              <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white/80" />
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate max-w-[200px] xs:max-w-none">
                {step === 'upload' && 'Upload Excel files to import invoice data'}
                {step === 'preview' && 'Review all records before importing'}
                {step === 'importing' && 'Importing your data...'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Upload Area */}
      {step === 'upload' && (
        <div className="relative bg-white rounded-[2rem] border-2 border-[#82A094]/30 p-4 sm:p-8 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
          <label 
            className={`flex flex-col items-center justify-center cursor-pointer py-12 sm:py-16 border-2 border-dashed rounded-2xl transition-all duration-300 group relative overflow-hidden ${
              dragActive 
                ? 'border-[#82A094] bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/10' 
                : 'border-[#AEBFC3]/50 hover:border-[#82A094]/50 hover:bg-gradient-to-r hover:from-[#82A094]/5 hover:to-[#4F6A64]/5'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-[#82A094]/40 ${dragActive ? 'scale-110 rotate-3' : ''}`}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]" />
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div className="text-center relative z-10 px-4">
              <p className="text-[#546A7A] font-semibold text-base sm:text-lg mb-1 sm:mb-2 text-center">
                {dragActive ? 'Drop your file here' : 'Drop your Excel file here'}
              </p>
              <p className="text-[#92A2A5] text-xs sm:text-sm text-center">or click to browse from your device</p>
              <p className="text-[#AEBFC3] text-[10px] sm:text-xs mt-3 uppercase font-bold tracking-wider">Supports .xlsx and .xls</p>
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
        <div className="space-y-6">
          {/* File Info & Actions */}
          <div className="relative bg-white rounded-[2rem] border-2 border-[#82A094]/30 p-4 sm:p-6 shadow-lg overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center shadow-lg shadow-[#82A094]/30 flex-shrink-0">
                  <FileCheck className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[#546A7A] font-semibold text-sm sm:text-base truncate">{file?.name}</p>
                  <p className="text-[#92A2A5] text-xs sm:text-sm">
                    {totalRows} rows found • {selectedRows.size} selected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  onClick={handleBackToUpload}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-[#5D6E73] hover:bg-[#AEBFC3]/10 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Upload More</span>
                </button>
                <button 
                  onClick={handleClear}
                  className="p-2.5 rounded-xl bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#E17F70]/10 hover:border-[#E17F70]/40 hover:text-[#E17F70] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Validation Summary */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="relative bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/5 rounded-xl p-3 sm:p-4 border-2 border-[#AEBFC3]/20 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]" />
                <p className="text-[#92A2A5] text-[10px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Total Rows</p>
                <p className="text-[#546A7A] text-xl sm:text-2xl font-bold">{totalRows}</p>
              </div>
              <div className="relative bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 rounded-xl p-3 sm:p-4 border-2 border-[#82A094]/30 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#82A094] to-[#4F6A64]" />
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                  <div className="p-0.5 rounded bg-gradient-to-br from-[#82A094] to-[#4F6A64]"><CheckCircle className="w-2.5 h-2.5 text-white" /></div>
                  <p className="text-[#82A094] text-[10px] sm:text-xs uppercase tracking-wider font-bold">Valid</p>
                </div>
                <p className="text-[#4F6A64] text-xl sm:text-2xl font-bold">{preview.validRows || totalRows}</p>
              </div>
              <div className={`relative rounded-xl p-3 sm:p-4 border-2 overflow-hidden ${(preview.invalidRows || 0) > 0 ? "bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-[#E17F70]/30" : "bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/5 border-[#AEBFC3]/20"}`}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] to-[#9E3B47]" />
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                  <div className={`p-0.5 rounded ${(preview.invalidRows || 0) > 0 ? "bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" : "bg-[#AEBFC3]"}`}><AlertTriangle className="w-2.5 h-2.5 text-white" /></div>
                  <p className={(preview.invalidRows || 0) > 0 ? "text-[#E17F70] text-[10px] sm:text-xs uppercase tracking-wider font-bold" : "text-[#92A2A5] text-[10px] sm:text-xs uppercase tracking-wider font-bold"}>Invalid</p>
                </div>
                <p className={(preview.invalidRows || 0) > 0 ? "text-[#9E3B47] text-xl sm:text-2xl font-bold" : "text-[#92A2A5] text-xl sm:text-2xl font-bold"}>{preview.invalidRows || 0}</p>
              </div>
            </div>

            {/* Missing Columns Warning */}
            {preview.missingColumns && preview.missingColumns.length > 0 && (
              <div className="relative mb-6 p-4 bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 border-2 border-[#CE9F6B]/30 rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><AlertTriangle className="w-4 h-4 text-white flex-shrink-0" /></div>
                  <div>
                    <p className="text-[#976E44] font-bold">Missing Required Columns</p>
                    <p className="text-[#976E44]/70 text-sm mt-1">
                      The following columns are missing from your file: {preview.missingColumns.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Preview Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-[#546A7A] font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#6F8A9D]" />
                  Data Preview
                </h3>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <button 
                    onClick={toggleAllRows}
                    className="px-3 py-1.5 rounded-lg bg-[#AEBFC3]/10 hover:bg-[#AEBFC3]/20 text-[#5D6E73] text-sm transition-all"
                  >
                    {selectedRows.size === totalRows ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-[#92A2A5] text-xs sm:text-sm">
                    {startIndex + 1}-{endIndex} of {totalRows}
                  </span>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-xl border-2 border-[#AEBFC3]/30 max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#82A094]/5 border-b-2 border-[#AEBFC3]/30">
                      <th className="text-left py-3 px-4 text-[#5D6E73] font-bold text-xs uppercase tracking-wider w-12">
                        #
                      </th>
                      {preview.headers?.map((header: string, i: number) => (
                        <th key={i} className="text-left py-3 px-4 text-[#5D6E73] font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row: any, i: number) => {
                      const globalIndex = startIndex + i;
                      const isSelected = selectedRows.has(globalIndex);
                      const isValid = row._isValid !== false;
                      const rowErrors: FieldError[] = row._errors || [];
                      
                      return (
                        <tr 
                          key={globalIndex}
                          onClick={() => toggleRowSelection(globalIndex)}
                          className={`border-t border-[#AEBFC3]/20 cursor-pointer transition-all duration-200 ${
                            !isValid 
                              ? 'bg-[#E17F70]/10 hover:bg-[#E17F70]/15' 
                              : isSelected 
                                ? 'bg-[#82A094]/10 hover:bg-[#82A094]/15' 
                                : 'bg-white hover:bg-[#AEBFC3]/10 opacity-60'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                !isValid
                                  ? 'border-[#9E3B47] bg-[#E17F70]/30'
                                  : isSelected 
                                    ? 'border-[#82A094] bg-[#82A094]' 
                                    : 'border-[#AEBFC3] bg-transparent'
                              }`}>
                                {!isValid ? (
                                  <AlertTriangle className="w-3 h-3 text-[#9E3B47]" />
                                ) : isSelected ? (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                ) : null}
                              </div>
                              <span className="text-[#92A2A5] text-xs">{row._rowNumber || globalIndex + 2}</span>
                            </div>
                          </td>
                          {preview.headers?.filter((h: string) => !h.startsWith('_')).map((header: string, j: number) => {
                            const hasError = rowErrors.some((e: FieldError) => e.field === header);
                            
                            let cellValue: any = null;
                            const map: Record<string, string> = {
                              'Doc. No.': 'invoiceNumber',
                              'Customer Code': 'bpCode',
                              'Customer Name': 'customerName',
                              'Customer Ref. No.': 'poNo',
                              'Amount': 'totalAmount',
                              'Net': 'netAmount',
                              'Tax': 'taxAmount',
                              'Document Date': 'invoiceDate',
                              'Due Date': 'dueDate',
                              'Email ID': 'emailId',
                              'Contact No': 'contactNo',
                              'Region': 'region',
                              'Department': 'department',
                              'Person In-charge': 'personInCharge',
                              'Category': 'type',
                              'Delivery Details': 'modeOfDelivery',
                              'Handover Date': 'sentHandoverDate',
                              'Delivery Status': 'deliveryStatus',
                              'GRN/Delivered Date': 'impactDate'
                            };
                            cellValue = row[map[header]] ?? row[header];
                            
                            if (cellValue && (header === 'Invoice Date' || header === 'Document Date' || header === 'Handover Date' || header === 'GRN/Delivered Date')) {
                              try {
                                const d = new Date(cellValue);
                                if (!isNaN(d.getTime())) {
                                  cellValue = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                }
                              } catch(e) {}
                            }
                            
                            if (cellValue !== null && cellValue !== undefined && cellValue !== '' && 
                               (header === 'Amount' || header === 'Net' || header === 'Tax' || header === 'Total Amount' || header === 'Order Value' || header === 'GST') && 
                               !isNaN(Number(cellValue))) {
                                cellValue = Number(cellValue).toLocaleString('en-IN', { maximumFractionDigits: 2 });
                            }

                            return (
                              <td key={j} className={`py-3 px-4 whitespace-nowrap relative ${
                                hasError 
                                  ? 'text-[#9E3B47]' 
                                  : !isValid
                                    ? 'text-[#9E3B47]/70'
                                    : isSelected 
                                      ? 'text-[#546A7A]' 
                                      : 'text-[#92A2A5]'
                              }`}>
                                {hasError && (
                                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#E17F70] animate-pulse" />
                                )}
                                {cellValue !== null && cellValue !== undefined && cellValue !== '' ? cellValue : <span className={hasError ? 'text-[#E17F70] italic' : 'text-[#AEBFC3]'}>
                                  {hasError ? 'Missing' : '-'}
                                </span>}
                              </td>
                            );
                          })}
                          {rowErrors.length > 0 && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1" title={rowErrors.map((e: FieldError) => e.message).join(', ')}>
                                <AlertCircle className="w-4 h-4 text-[#E17F70]" />
                                <span className="text-[#E17F70] text-xs">{rowErrors.length} error{rowErrors.length > 1 ? 's' : ''}</span>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="text-[#92A2A5] text-xs sm:text-sm order-2 sm:order-1">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#5D6E73]" />
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="hidden xs:flex px-3 py-2 rounded-lg bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[#5D6E73] text-sm"
                    >
                      Prev
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        const maxVisible = 5;
                        if (totalPages <= maxVisible) {
                          pageNum = i + 1;
                        } else if (currentPage <= Math.ceil(maxVisible / 2)) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - Math.floor(maxVisible / 2)) {
                          pageNum = totalPages - maxVisible + 1 + i;
                        } else {
                          pageNum = currentPage - Math.floor(maxVisible / 2) + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                              currentPage === pageNum
                                ? "bg-[#82A094] text-white"
                                : "bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 text-[#5D6E73]"
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
                      className="hidden xs:flex px-3 py-2 rounded-lg bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[#5D6E73] text-sm"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4 text-[#5D6E73]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Import Confirmation */}
          <div className="relative bg-gradient-to-r from-[#82A094]/15 via-[#82A094]/10 to-transparent rounded-[2rem] border-2 border-[#82A094]/30 p-5 sm:p-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#82A094]/20">
                  <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <p className="text-[#546A7A] font-semibold text-sm sm:text-base">Ready to Import</p>
                  <p className="text-[#82A094] text-xs sm:text-sm">
                    {selectedRows.size} records will be imported
                  </p>
                </div>
              </div>
              <button
                onClick={handleImport}
                disabled={selectedRows.size === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white font-bold shadow-lg shadow-[#82A094]/20 hover:shadow-xl hover:shadow-[#82A094]/40 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Upload className="w-5 h-5" />
                <span>Confirm Import</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="relative bg-white rounded-[2rem] border-2 border-[#82A094]/30 p-12 flex flex-col items-center justify-center shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]" />
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center mb-6 shadow-2xl shadow-[#82A094]/40 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]" />
            <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <h3 className="text-[#546A7A] text-xl font-bold mb-2">Importing Records...</h3>
          <p className="text-[#92A2A5] text-sm font-medium">Please wait while we process your data</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="relative bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-2 border-[#E17F70]/30 rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#75242D]" />
          <div className="flex items-start gap-4 p-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#E17F70]/20">
              <XCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[#9E3B47] font-semibold text-lg">{error.message}</p>
              {error.details && (
                <p className="text-[#E17F70] text-sm mt-1">{error.details}</p>
              )}
              
              {error.missingColumns && error.missingColumns.length > 0 && (
                <div className="mt-4 p-4 bg-[#E17F70]/10 rounded-lg">
                  <p className="text-[#9E3B47] text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Missing Required Columns:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {error.missingColumns.map((col: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-[#E17F70]/20 text-[#9E3B47] text-sm rounded-lg">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {error.error && (
                <div className="mt-3 p-3 bg-[#AEBFC3]/10 rounded-lg">
                  <p className="text-[#92A2A5] text-xs uppercase tracking-wider mb-1">Technical Details</p>
                  <p className="text-[#E17F70] text-xs font-mono break-all">{error.error}</p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-2 rounded-lg hover:bg-[#E17F70]/20 transition-all"
            >
              <X className="w-4 h-4 text-[#E17F70]" />
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`relative p-6 rounded-[2rem] border-2 overflow-hidden ${
          result.failed === 0 
            ? 'bg-gradient-to-r from-[#82A094]/10 via-[#82A094]/5 to-transparent border-[#82A094]/30' 
            : 'bg-gradient-to-r from-[#CE9F6B]/10 via-[#CE9F6B]/5 to-transparent border-[#CE9F6B]/30'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${result.failed === 0 ? 'bg-gradient-to-r from-[#82A094] via-[#4F6A64] to-[#A2B9AF]' : 'bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]'}`} />
          <div className="flex items-start gap-5">
            <div 
              className={`relative w-14 h-14 rounded-xl flex items-center justify-center shadow-lg overflow-hidden ${
                result.failed === 0 
                  ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-[#82A094]/30' 
                  : 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] shadow-[#CE9F6B]/30'
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${result.failed === 0 ? 'bg-gradient-to-r from-[#A2B9AF] via-white/40 to-[#82A094]' : 'bg-gradient-to-r from-[#E17F70] via-white/40 to-[#CE9F6B]'}`} />
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className={`font-bold text-lg ${
                result.failed === 0 ? 'text-[#4F6A64]' : 'text-[#976E44]'
              }`}>
                Import {result.failed === 0 ? 'Completed Successfully!' : 'Partially Completed'}
              </h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                <div className="relative bg-gradient-to-r from-[#AEBFC3]/10 to-[#92A2A5]/5 rounded-xl p-3 sm:p-4 border-2 border-[#AEBFC3]/30 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5]" />
                  <p className="text-[#92A2A5] text-[10px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Total</p>
                  <p className="text-[#546A7A] text-xl sm:text-2xl font-bold">{result.total}</p>
                </div>
                <div className="relative bg-gradient-to-r from-[#82A094]/10 to-[#4F6A64]/5 rounded-xl p-3 sm:p-4 border-2 border-[#82A094]/30 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#82A094] to-[#4F6A64]" />
                  <p className="text-[#82A094] text-[10px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Success</p>
                  <p className="text-[#4F6A64] text-xl sm:text-2xl font-bold">{result.success}</p>
                </div>
                <div className="relative bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 rounded-xl p-3 sm:p-4 border-2 border-[#E17F70]/30 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] to-[#9E3B47]" />
                  <p className="text-[#E17F70] text-[10px] sm:text-xs uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Failed</p>
                  <p className="text-[#9E3B47] text-xl sm:text-2xl font-bold">{result.failed}</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-4 p-4 bg-[#AEBFC3]/10 rounded-xl max-h-32 overflow-y-auto">
                  <p className="text-[#92A2A5] text-xs uppercase tracking-wider mb-2">Errors</p>
                  {result.errors.slice(0, 5).map((err: string, i: number) => (
                    <p key={i} className="text-[#E17F70] text-sm">{err}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {step === 'upload' && (
        <div className="relative bg-white rounded-[2rem] border-2 border-[#CE9F6B]/30 p-5 sm:p-6 shadow-lg overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
          <h3 className="text-[#546A7A] font-bold text-sm sm:text-base mb-4 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"><Info className="w-4 h-4 text-white" /></div>
            Required SAP Format Columns
          </h3>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm font-medium">
            {['Doc. No.', 'Customer Code', 'Customer Name', 'Customer Ref. No.', 'Amount', 'Net', 'Tax', 'Document Date', 'Due Date (Optional)', 'Email ID (Optional)', 'Contact No (Optional)', 'Region (Optional)', 'Department (Optional)', 'Person In-charge (Optional)', 'Category (Optional)', 'Delivery Details (Optional)', 'Handover Date (Optional)', 'Delivery Status (Optional)', 'GRN/Delivered Date (Optional)'].map((col, i) => (
              <div key={i} className={`flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-[#CE9F6B]/5 to-[#976E44]/5 text-[#5D6E73] hover:from-[#CE9F6B]/10 hover:to-[#976E44]/10 border border-[#CE9F6B]/20 transition-colors ${col.includes('Optional') ? 'opacity-80' : ''}`}>
                <div className={`p-0.5 rounded ${col.includes('Optional') ? 'bg-[#AEBFC3]' : 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44]'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 block" />
                </div>
                <span className="font-bold">{col}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
