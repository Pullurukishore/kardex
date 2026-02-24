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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/finance/bank-accounts"
            className="p-2.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:text-[#546A7A] hover:border-[#CE9F6B]/30 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#546A7A] flex items-center gap-2">
              Bulk Import Vendor Bank Accounts
              <Sparkles className="w-5 h-5 text-[#CE9F6B]" />
            </h1>
            <p className="text-[#92A2A5] text-sm mt-1 font-medium">
              Upload Excel file to add multiple records at once
            </p>
          </div>
        </div>

        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] font-semibold hover:bg-[#F8FAFB] transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download Template
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
        <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg p-10">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#CE9F6B]/10 flex items-center justify-center mx-auto">
              <Upload className="w-10 h-10 text-[#CE9F6B]" />
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-[#546A7A]">Select File</h2>
              <p className="text-[#92A2A5] text-sm mt-2">
                Supported formats: .xlsx, .xls, .csv. Max file size: 10MB.
              </p>
            </div>

            <label className="block">
              <span className="sr-only">Choose file</span>
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-[#92A2A5]
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-xl file:border-0
                  file:text-sm file:font-bold
                  file:bg-[#CE9F6B]/10 file:text-[#976E44]
                  hover:file:bg-[#CE9F6B]/20
                  cursor-pointer transition-all"
              />
            </label>

            {file && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-[#ce9f6b] to-[#976e44] text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-[#CE9F6B]/30 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                Analyze and Preview Data
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {stats && (
        <div className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#AEBFC3]/20 shadow-sm">
              <p className="text-[#92A2A5] text-sm font-medium">Total Rows</p>
              <p className="text-2xl font-bold text-[#546A7A] mt-1">{stats.total}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#82A094]/20 shadow-sm border-l-4 border-l-[#82A094]">
              <p className="text-[#82A094] text-sm font-medium">Valid Records</p>
              <p className="text-2xl font-bold text-[#4F6A64] mt-1">{stats.valid}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#E17F70]/20 shadow-sm border-l-4 border-l-[#E17F70]">
              <p className="text-[#E17F70] text-sm font-medium">Invalid / Conflicts</p>
              <p className="text-2xl font-bold text-[#9E3B47] mt-1">{stats.invalid}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#AEBFC3]/20 overflow-hidden shadow-lg">
            <div className="p-5 border-b border-[#AEBFC3]/10 bg-[#F8FAFB] flex items-center justify-between">
              <h3 className="font-bold text-[#546A7A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#CE9F6B]" />
                Data Preview
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStats(null); setPreview([]); }}
                  className="px-4 py-2 rounded-lg text-[#5D6E73] font-bold hover:bg-[#AEBFC3]/10 transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || stats.valid === 0}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#82A094] text-white font-bold hover:bg-[#4F6A64] transition-all disabled:opacity-50 shadow-md shadow-[#82A094]/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Import {stats.valid} Valid Records
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
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

      {/* Instructions Card */}
      {!stats && (
        <div className="bg-[#CE9F6B]/5 rounded-2xl border border-[#CE9F6B]/20 p-6 space-y-4">
          <h3 className="font-bold text-[#976E44] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Import Instructions
          </h3>
          <ul className="space-y-2 text-sm text-[#5D6E73]">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CE9F6B] mt-2 flex-shrink-0" />
              Use the provided template for the best results.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CE9F6B] mt-2 flex-shrink-0" />
              <strong>Account Numbers</strong> must be unique and not already exist in the system.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CE9F6B] mt-2 flex-shrink-0" />
              The system will automatically validate each row for missing fields and formatting.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CE9F6B] mt-2 flex-shrink-0" />
              Only valid rows will be imported. Rows with errors will be highlighted in red.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
