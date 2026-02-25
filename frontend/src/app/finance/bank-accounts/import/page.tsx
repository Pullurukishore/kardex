'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { 
  ArrowLeft, Upload, FileText, Download, CheckCircle2, 
  AlertCircle, XCircle, Loader2, Sparkles, Building2,
  Trash2, Save
} from 'lucide-react';

export default function VendorAccountImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError('');
      setPreview([]);
      setStats(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const data = await arApi.previewBankAccountImport(file);
      setPreview(data.preview);
      setStats({
        total: data.totalRows,
        valid: data.validRows,
        invalid: data.invalidRows
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to preview file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const validRows = preview.filter(r => r._isValid).map(r => r._parsed);
    if (validRows.length === 0) return;

    setLoading(true);
    try {
      const response = await arApi.importBankAccountsFromExcel(validRows);
      setSuccess(response.message || `Successfully processed ${validRows.length} accounts!`);
      const targetPath = response.isRequest ? '/finance/bank-accounts/requests' : '/finance/bank-accounts';
      setTimeout(() => router.push(targetPath), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    arApi.downloadBankAccountTemplate();
  };

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 lg:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/finance/bank-accounts"
            className="p-2 lg:p-2.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:text-[#546A7A] hover:border-[#CE9F6B]/30 transition-all shadow-sm shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl lg:text-3xl font-black text-[#546A7A] flex items-center gap-2 truncate">
              Bulk Import
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-[#CE9F6B] shrink-0" />
            </h1>
            <p className="text-[#92A2A5] text-[11px] lg:text-sm mt-1.5 font-bold truncate">
              Upload Excel to add multiple records
            </p>
          </div>
        </div>

        <button
          onClick={downloadTemplate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 lg:py-3.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] text-sm font-bold hover:bg-[#F8FAFB] transition-all shadow-sm w-full sm:w-auto active:scale-95"
        >
          <Download className="w-4 h-4 text-[#CE9F6B]" />
          <span>Download Template</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#E17F70]/10 border border-[#E17F70]/20 flex items-center gap-3 text-[#E17F70]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-[#82A094]/10 border border-[#82A094]/20 flex items-center gap-3 text-[#4F6A64]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Upload Box */}
      {!stats && (
        <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-2xl p-6 lg:p-12">
          <div className="max-w-xl mx-auto text-center space-y-8">
            <div className="relative inline-block">
              <div className="absolute -inset-2 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] rounded-full blur opacity-20" />
              <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-[#CE9F6B]/10 flex items-center justify-center mx-auto ring-4 ring-white">
                <Upload className="w-8 h-8 lg:w-10 lg:h-10 text-[#CE9F6B]" />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg lg:text-2xl font-black text-[#546A7A]">Select Excel File</h2>
              <p className="text-[#92A2A5] text-xs lg:text-sm mt-2 px-4 font-medium uppercase tracking-widest leading-relaxed">
                Supported: .xlsx, .xls, .csv<br/>Max 10MB file size
              </p>
            </div>

            <div className="relative">
              <input 
                type="file" 
                id="file-upload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
              />
              <label 
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full px-4 py-10 border-2 border-dashed border-[#AEBFC3]/40 rounded-3xl bg-[#F8FAFB] hover:bg-[#CE9F6B]/5 hover:border-[#CE9F6B]/60 transition-all cursor-pointer group shadow-inner"
              >
                <div className="flex flex-col items-center gap-3 text-[#5D6E73]">
                  <div className="p-3 rounded-full bg-white shadow-md group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-[#CE9F6B]" />
                  </div>
                  <span className="font-black text-sm lg:text-base break-all">{file ? file.name : 'Tap to select file'}</span>
                </div>
                {!file && <span className="text-[10px] uppercase font-black text-[#AEBFC3] mt-2 tracking-[0.2em]">Quick Upload</span>}
              </label>
            </div>

            {file && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 lg:py-5 rounded-2xl bg-gradient-to-r from-[#ce9f6b] to-[#976e44] text-white font-black text-sm lg:text-base uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-[#CE9F6B]/40 disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                <span>Analyze and Preview Data</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {stats && (
        <div className="space-y-6">
          {/* Stats Summary - Best Mobile View */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
            <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#AEBFC3]/30 shadow-sm col-span-2 lg:col-span-1">
              <p className="text-[#92A2A5] text-[10px] lg:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Total Rows
              </p>
              <p className="text-2xl lg:text-4xl font-black text-[#546A7A] mt-2 leading-none">{stats.total}</p>
            </div>
            <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#82A094]/30 shadow-sm border-l-[6px] border-l-[#82A094]">
              <p className="text-[#82A094] text-[10px] lg:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid
              </p>
              <p className="text-2xl lg:text-4xl font-black text-[#4F6A64] mt-2 leading-none">{stats.valid}</p>
            </div>
            <div className="bg-white p-5 lg:p-6 rounded-3xl border border-[#E17F70]/30 shadow-sm border-l-[6px] border-l-[#E17F70]">
              <p className="text-[#E17F70] text-[10px] lg:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Invalid
              </p>
              <p className="text-2xl lg:text-4xl font-black text-[#9E3B47] mt-2 leading-none">{stats.invalid}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#AEBFC3]/20 overflow-hidden shadow-2xl">
            <div className="p-5 lg:p-6 border-b border-[#AEBFC3]/10 bg-[#F8FAFB] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <h3 className="font-black text-[#546A7A] flex items-center gap-2 tracking-tight">
                <FileText className="w-5 h-5 text-[#CE9F6B] shrink-0" />
                <span className="uppercase text-xs lg:text-sm tracking-widest">Data Preview</span>
              </h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => { setStats(null); setPreview([]); }}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-[#5D6E73] font-black text-xs uppercase tracking-widest border border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 transition-all active:scale-95"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || stats.valid === 0}
                  className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#82A094] text-white font-black text-xs uppercase tracking-widest hover:bg-[#4F6A64] transition-all disabled:opacity-50 shadow-lg shadow-[#82A094]/40 active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Import {stats.valid} Records</span>
                </button>
              </div>
            </div>

            {/* Mobile-Friendly Data Cards (Hidden on Desktop) */}
            <div className="lg:hidden divide-y divide-[#AEBFC3]/10 px-5">
              {preview.map((row, idx) => (
                <div key={idx} className={`py-6 space-y-4 ${!row._isValid ? 'bg-[#E17F70]/5 -mx-5 px-5' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-[#AEBFC3] font-mono shrink-0 bg-[#F8FAFB] px-2 py-1 rounded">#{row._rowNumber}</span>
                      <div className="min-w-0">
                        <h4 className="font-black text-[#546A7A] truncate text-sm max-w-[180px] tracking-tight">{row._parsed.vendorName || '-'}</h4>
                        <p className="text-[10px] font-bold text-[#92A2A5] font-mono mt-0.5">{row._parsed.bpCode || 'NO BP CODE'}</p>
                      </div>
                    </div>
                    {row._isValid ? (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest ${row._isUpdate ? 'bg-[#CE9F6B]/20 text-[#976E44]' : 'bg-[#82A094]/20 text-[#4F6A64]'}`}>
                        {row._isUpdate ? <Sparkles className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {row._isUpdate ? 'UPDATE' : 'READY'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E17F70]/20 text-[#E17F70] text-[10px] font-black tracking-widest">
                        <XCircle className="w-3.5 h-3.5" />
                        ERROR
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F8FAFB] p-3 rounded-xl border border-[#AEBFC3]/15">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-[#AEBFC3] font-black block mb-1">Account Number</span>
                      <span className="font-mono font-bold text-xs text-[#CE9F6B] truncate block">{row._parsed.accountNumber || '-'}</span>
                    </div>
                    <div className="bg-[#F8FAFB] p-3 rounded-xl border border-[#AEBFC3]/15">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-[#AEBFC3] font-black block mb-1">Bank & IFSC</span>
                      <span className="font-bold text-xs text-[#5D6E73] truncate block uppercase">{row._parsed.ifscCode || '-'}</span>
                    </div>
                  </div>

                  {!row._isValid && (
                    <div className="bg-white/80 rounded-2xl p-4 border border-[#E17F70]/30 shadow-sm">
                      <p className="text-[10px] font-black text-[#E17F70] mb-2 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Validation Failed
                      </p>
                      <ul className="space-y-2">
                        {row._errors.map((err: any, eIdx: number) => (
                          <li key={eIdx} className="text-[10px] text-[#546A7A] flex gap-2 font-bold leading-relaxed">
                            <span className="text-[#E17F70] shrink-0">•</span>
                            <span><span className="text-[#92A2A5] font-black uppercase text-[8px] tracking-widest">[{err.field}]</span> {err.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFB] text-[#92A2A5] text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Row</th>
                    <th className="px-6 py-4">BP Code</th>
                    <th className="px-6 py-4">Vendor Name</th>
                    <th className="px-6 py-4">Bank Name</th>
                    <th className="px-6 py-4 text-center">Currency</th>
                    <th className="px-6 py-4">Account Number</th>
                    <th className="px-6 py-4">IFSC Code / SWIFT Code</th>
                    <th className="px-6 py-4">GST / PAN / MSME</th>
                    <th className="px-6 py-4">Beneficiary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/10">
                  {preview.map((row, idx) => (
                    <tr key={idx} className={`hover:bg-[#F8FAFB] transition-colors ${!row._isValid ? 'bg-[#E17F70]/5' : ''}`}>
                      <td className="px-6 py-4">
                        {row._isValid ? (
                          <div className={`flex items-center gap-1.5 ${row._isUpdate ? 'text-[#CE9F6B]' : 'text-[#82A094]'}`}>
                            {row._isUpdate ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span className="text-[11px] font-bold tracking-wider">{row._statusText || 'READY'}</span>
                          </div>
                        ) : (
                          <div className="group relative cursor-help flex items-center gap-1.5 text-[#E17F70]">
                            <XCircle className="w-4 h-4" />
                            <span className="text-[11px] font-bold">ERROR</span>
                            {/* Error Tooltip */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-white border border-[#E17F70]/30 rounded-xl shadow-2xl z-10">
                              <p className="text-xs font-bold text-[#E17F70] mb-1">Validation Errors:</p>
                              <ul className="space-y-1">
                                {row._errors.map((err: any, eIdx: number) => (
                                  <li key={eIdx} className="text-[10px] text-[#546A7A]">[{err.field}] {err.message}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-[11px] font-bold text-[#92A2A5]">
                        {row._rowNumber}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] font-bold text-[#546A7A] uppercase tracking-wider">
                        {row._parsed.bpCode || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#546A7A] text-sm">{row._parsed.vendorName || '-'}</span>
                          {row._parsed.nickName && <span className="text-[10px] text-[#92A2A5]">"{row._parsed.nickName}"</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[#5D6E73] text-sm font-medium">{row._parsed.beneficiaryBankName || '-'}</span>
                          {row._parsed.accountType && <span className="text-[10px] text-[#92A2A5]">{row._parsed.accountType}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded bg-[#82A094]/10 text-[#82A094] text-[10px] font-bold">
                          {row._parsed.currency || 'INR'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[#CE9F6B] truncate max-w-[150px]">{row._parsed.accountNumber || '-'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-[#5D6E73]">{row._parsed.ifscCode || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[#92A2A5] font-bold">GST: {row._parsed.gstNumber || '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] font-bold">PAN: {row._parsed.panNumber || '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] font-bold">
                            MSME: {row._parsed.isMSME ? 'YES' : 'NO'} 
                            {row._parsed.udyamRegNum ? ` (${row._parsed.udyamRegNum})` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#92A2A5] text-xs">{row._parsed.beneficiaryName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Card - Responsive & Premium */}
      {!stats && (
        <div className="bg-white/50 backdrop-blur-xl rounded-3xl border border-[#CE9F6B]/30 p-6 lg:p-8 space-y-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#CE9F6B]/10 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <h3 className="font-black text-[#976E44] flex items-center gap-2 uppercase text-xs lg:text-sm tracking-widest">
            <AlertCircle className="w-5 h-5" />
            Import Guidelines
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {[
              { icon: CheckCircle2, color: '#82A094', text: 'Use the official template for 100% success rate.' },
              { icon: Building2, color: '#6F8A9D', text: 'All Vendor Names & Bank Details must be clearly stated.' },
              { icon: XCircle, color: '#E17F70', text: 'Duplicate Account Numbers will trigger an automatic error.' },
              { icon: Sparkles, color: '#CE9F6B', text: 'Only valid records will be committed to the database.' }
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#CE9F6B]/10 shadow-sm active:scale-95 transition-all">
                <item.icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: item.color }} />
                <span className="text-[11px] lg:text-sm text-[#546A7A] font-bold leading-relaxed">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
