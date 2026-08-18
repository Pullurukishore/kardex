'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X,
  Download, Eye, Loader2, ArrowLeft, RefreshCw, AlertCircle,
  FileCheck, Layers, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

// ============================
// Types
// ============================
interface ParsedRow {
  slNo: number | null;
  customerName: string;
  engineerName: string;
  customerClass: string;
  place: string;
  department: string;
  zoneName: string;
  unitType: string;
  controlType: string;
  serialNumber: string;
  modelNumber?: string;
  softwareName: string | null;
  installationYear: string;
  contractType: string;
  mcPoNumber: string;
  poDate: string | null;
  mcStartDate: string | null;
  mcEndDate: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  softwarePoNo: string | null;
  softwareStartDate: string | null;
  softwareEndDate: string | null;
  remoteSupportStartDate: string | null;
  remoteSupportEndDate: string | null;
  pmVisitsCount: number;
  bdVisitsCount: number;
  mcValue: number | null;
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
}

interface ImportResult {
  created?: number;
  updated?: number;
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
}

interface DetailedContractImportProps {
  role: string;
}

// ============================
// Timezone-safe Excel Date Parser (preventing 1-day subtraction)
// ============================
const excelSerialToDateString = (serial: number): string | null => {
  if (!serial || serial < 1) return null;
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateValue = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && val > 25000 && val < 60000) {
    return excelSerialToDateString(val);
  }
  const str = String(val).trim();
  if (!str) return null;

  // Direct parse for MM/DD/YYYY or YYYY-MM-DD without timezone shifting
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // MM/DD/YYYY
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
};

const parseNumericValue = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
};

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildColumnMap = (headerRow: any[]) => {
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (!h) return;
    const cleanH = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');

    if (/sino|slno/i.test(cleanH) && colMap.slNo === undefined) colMap.slNo = idx;
    else if (/customer/i.test(cleanH) && colMap.customerName === undefined) colMap.customerName = idx;
    else if (/engineer|responsible/i.test(cleanH) && colMap.engineerName === undefined) colMap.engineerName = idx;
    else if (/abc|class|category/i.test(cleanH) && colMap.customerClass === undefined) colMap.customerClass = idx;
    else if (/place|city|location/i.test(cleanH) && colMap.place === undefined) colMap.place = idx;
    else if (/department|dept/i.test(cleanH) && colMap.department === undefined) colMap.department = idx;
    else if (/zone/i.test(cleanH) && colMap.zoneName === undefined) colMap.zoneName = idx;
    else if (/typeofunit|unittype|mctype/i.test(cleanH) && colMap.unitType === undefined) colMap.unitType = idx;
    else if (/control/i.test(cleanH) && colMap.controlType === undefined) colMap.controlType = idx;
    else if (/serial/i.test(cleanH) && colMap.serialNumber === undefined) colMap.serialNumber = idx;
    else if ((/software$/i.test(cleanH) || cleanH === 'software') && colMap.softwareName === undefined) colMap.softwareName = idx;
    else if (/model/i.test(cleanH) && colMap.modelNumber === undefined) colMap.modelNumber = idx;
    else if (/installation|install/i.test(cleanH) && colMap.installationYear === undefined) colMap.installationYear = idx;
    else if (/mcw|contracttype/i.test(cleanH) && colMap.contractType === undefined) colMap.contractType = idx;
    else if (/mcponumber|mcpno|ponumber|pono/i.test(cleanH) && colMap.mcPoNumber === undefined) colMap.mcPoNumber = idx;
    else if (/podate/i.test(cleanH) && colMap.poDate === undefined) colMap.poDate = idx;
    else if (/mcperiod/i.test(cleanH) && colMap.mcStartDate === undefined) {
      colMap.mcStartDate = idx;
      colMap.mcEndDate = idx + 1;
    }
    else if (/warantyperiod|warrantyperiod/i.test(cleanH) && colMap.warrantyStartDate === undefined) {
      colMap.warrantyStartDate = idx;
      colMap.warrantyEndDate = idx + 1;
    }
    else if (/softwarepono/i.test(cleanH) && colMap.softwarePoNo === undefined) colMap.softwarePoNo = idx;
    else if (/softwarecontract/i.test(cleanH) && colMap.softwareStartDate === undefined) {
      colMap.softwareStartDate = idx;
      colMap.softwareEndDate = idx + 1;
    }
    else if (/remotesupport/i.test(cleanH) && colMap.remoteSupportStartDate === undefined) {
      colMap.remoteSupportStartDate = idx;
      colMap.remoteSupportEndDate = idx + 1;
    }
    else if (/noofpm|pmvisit/i.test(cleanH) && colMap.pmVisitsCount === undefined) colMap.pmVisitsCount = idx;
    else if (/noofbd|bdvisit/i.test(cleanH) && colMap.bdVisitsCount === undefined) colMap.bdVisitsCount = idx;
    else if (/mcvalue|amount|value/i.test(cleanH) && colMap.mcValue === undefined) colMap.mcValue = idx;
  });

  return colMap;
};

// ============================
// Component
// ============================
export default function DetailedContractImport({ role }: DetailedContractImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [workbookData, setWorkbookData] = useState<any | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    if (role === 'Zone User') return '/zone';
    if (role === 'Expert Helpdesk') return '/expert';
    return '/admin';
  };

  const processSheet = useCallback((wb: any, sheetName: string) => {
    try {
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        toast.error(`Sheet "${sheetName}" not found`);
        return;
      }

      const rawData = wb.utils ? wb.utils.sheet_to_json(ws, { header: 1, raw: true }) : [];
      if (!rawData || rawData.length < 2) {
        toast.error('No data found in the selected sheet');
        setParsedRows([]);
        return;
      }

      const headerRow0 = (rawData[0] || []).map((c: any) => String(c || '').trim());
      const headerRow1 = (rawData[1] || []).map((c: any) => String(c || '').trim());

      const isRow1SubHeader = headerRow1.some((c: string) => /^(starts?|ends?)$/i.test(c));
      const dataStartRow = isRow1SubHeader ? 2 : 1;
      const colMap = buildColumnMap(headerRow0);

      const parsed: ParsedRow[] = [];

      for (let r = dataStartRow; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || !row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')) {
          continue;
        }

        const errors: string[] = [];
        const warnings: string[] = [];

        const customerName = colMap.customerName !== undefined && row[colMap.customerName] !== undefined
          ? String(row[colMap.customerName]).trim()
          : '';
        const serialNumber = colMap.serialNumber !== undefined && row[colMap.serialNumber] !== undefined
          ? String(row[colMap.serialNumber]).trim()
          : '';

        if (!customerName) errors.push('Missing customer name');
        if (!serialNumber) errors.push('Missing serial number');

        const zoneName = colMap.zoneName !== undefined && row[colMap.zoneName] !== undefined
          ? String(row[colMap.zoneName]).trim()
          : '';
        if (!zoneName) warnings.push('Missing zone');

        parsed.push({
          slNo: colMap.slNo !== undefined ? (parseNumericValue(row[colMap.slNo]) as number | null) : null,
          customerName,
          engineerName: colMap.engineerName !== undefined && row[colMap.engineerName] !== undefined
            ? String(row[colMap.engineerName]).trim() : '',
          customerClass: colMap.customerClass !== undefined && row[colMap.customerClass] !== undefined
            ? String(row[colMap.customerClass]).trim() : '',
          place: colMap.place !== undefined && row[colMap.place] !== undefined
            ? String(row[colMap.place]).trim() : '',
          department: colMap.department !== undefined && row[colMap.department] !== undefined
            ? String(row[colMap.department]).trim() : '',
          zoneName: zoneName || 'Unknown',
          unitType: colMap.unitType !== undefined && row[colMap.unitType] !== undefined
            ? String(row[colMap.unitType]).trim() : '',
          controlType: colMap.controlType !== undefined && row[colMap.controlType] !== undefined
            ? String(row[colMap.controlType]).trim() : '',
          serialNumber,
          modelNumber: colMap.modelNumber !== undefined && row[colMap.modelNumber] !== undefined
            ? String(row[colMap.modelNumber]).trim() : undefined,
          softwareName: colMap.softwareName !== undefined && row[colMap.softwareName] !== undefined
            ? String(row[colMap.softwareName]).trim() : null,
          installationYear: colMap.installationYear !== undefined && row[colMap.installationYear] !== undefined
            ? String(row[colMap.installationYear]).trim() : '',
          contractType: colMap.contractType !== undefined && row[colMap.contractType] !== undefined
            ? String(row[colMap.contractType]).trim() : '',
          mcPoNumber: colMap.mcPoNumber !== undefined && row[colMap.mcPoNumber] !== undefined
            ? String(row[colMap.mcPoNumber]).trim() : '',
          poDate: colMap.poDate !== undefined ? parseDateValue(row[colMap.poDate]) : null,
          mcStartDate: colMap.mcStartDate !== undefined ? parseDateValue(row[colMap.mcStartDate]) : null,
          mcEndDate: colMap.mcEndDate !== undefined ? parseDateValue(row[colMap.mcEndDate]) : null,
          warrantyStartDate: colMap.warrantyStartDate !== undefined ? parseDateValue(row[colMap.warrantyStartDate]) : null,
          warrantyEndDate: colMap.warrantyEndDate !== undefined ? parseDateValue(row[colMap.warrantyEndDate]) : null,
          softwarePoNo: colMap.softwarePoNo !== undefined && row[colMap.softwarePoNo] !== undefined
            ? String(row[colMap.softwarePoNo]).trim() : null,
          softwareStartDate: colMap.softwareStartDate !== undefined ? parseDateValue(row[colMap.softwareStartDate]) : null,
          softwareEndDate: colMap.softwareEndDate !== undefined ? parseDateValue(row[colMap.softwareEndDate]) : null,
          remoteSupportStartDate: colMap.remoteSupportStartDate !== undefined ? parseDateValue(row[colMap.remoteSupportStartDate]) : null,
          remoteSupportEndDate: colMap.remoteSupportEndDate !== undefined ? parseDateValue(row[colMap.remoteSupportEndDate]) : null,
          pmVisitsCount: colMap.pmVisitsCount !== undefined ? ((parseNumericValue(row[colMap.pmVisitsCount]) as number) || 0) : 0,
          bdVisitsCount: colMap.bdVisitsCount !== undefined ? ((parseNumericValue(row[colMap.bdVisitsCount]) as number) || 0) : 0,
          mcValue: colMap.mcValue !== undefined ? parseNumericValue(row[colMap.mcValue]) : null,
          _rowIndex: r + 1,
          _errors: errors,
          _warnings: warnings,
        });
      }

      setParsedRows(parsed);
      toast.success(`Parsed ${parsed.length} records from "${sheetName}"`);
    } catch (err) {
      console.error('Error processing sheet:', err);
      toast.error('Failed to parse sheet data');
    }
  }, []);

  const parseFile = useCallback(async (selectedFile: File) => {
    setParsing(true);
    setImportResult(null);
    setParsedRows([]);

    try {
      const XLSX = await import('xlsx');
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      setWorkbookData({ ...workbook, utils: XLSX.utils });
      setSheetNames(workbook.SheetNames);

      let chosenSheet = workbook.SheetNames.find(
        (n: string) => /detail|contract.*data|machine|dtls/i.test(n)
      );

      if (!chosenSheet) {
        chosenSheet = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0];
      }

      setSelectedSheet(chosenSheet);
      processSheet({ ...workbook, utils: XLSX.utils }, chosenSheet);
    } catch (error) {
      console.error('Failed to parse Excel file:', error);
      toast.error('Failed to parse Excel file. Please check the format.');
    } finally {
      setParsing(false);
    }
  }, [processSheet]);

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbookData) {
      processSheet(workbookData, newSheet);
    }
  };

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setFile(f);
    parseFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._errors.length === 0);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setImporting(true);
    try {
      const cleanRecords = validRows.map(({ _rowIndex, _errors, _warnings, ...rest }) => rest);
      const result = await apiService.bulkImportDetailedContracts(cleanRecords);
      setImportResult(result);
      if (result.success > 0) {
        toast.success(`Successfully imported ${result.success} records`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} records failed to import`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setWorkbookData(null);
    setSheetNames([]);
    setSelectedSheet('');
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedRows.filter(r => r._errors.length === 0).length;
  const errorCount = parsedRows.filter(r => r._errors.length > 0).length;
  const warningCount = parsedRows.filter(r => r._warnings.length > 0).length;

  return (
    <div className="space-y-6">
      {/* ─── Hero Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3D4F5C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#82A094]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-[#CE9F6B]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href={`${getBaseRoute()}/contracts/detailed`}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 mb-2 backdrop-blur-md">
                <Upload className="w-3.5 h-3.5 text-[#82A094]" />
                <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                  Excel Bulk Ingestion
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Import Annual Machine Contracts
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1">
                Upload machine inventory & contract sheets with auto-detection & preview
              </p>
            </div>
          </div>

          <a
            href={`${getBaseRoute()}/contracts/detailed`}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all self-start sm:self-auto backdrop-blur-sm"
          >
            <Eye className="w-4 h-4 text-[#82A094]" />
            <span>View Contracts</span>
          </a>
        </div>
      </div>

      {/* ─── Import Result Screen ──────────────────────────── */}
      {importResult && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              importResult.failed === 0 ? 'bg-[#82A094]/15 text-[#4E7D6D]' : 'bg-[#CE9F6B]/15 text-[#B8874E]'
            }`}>
              {importResult.failed === 0 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">Import Complete</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {importResult.created !== undefined && importResult.updated !== undefined
                  ? `${importResult.created} newly created, ${importResult.updated} updated/synchronized (${importResult.failed} failed).`
                  : `Successfully processed ${importResult.success} records into Annual Machine Contracts (${importResult.failed} failed).`}
              </p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 max-h-48 overflow-y-auto space-y-1.5">
              {importResult.errors.map((err, i) => (
                <div key={i} className="text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-rose-500" />
                  <span>Row {err.row}: {err.error}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-[#546A7A]" />
              <span>Import Another File</span>
            </button>
            <a
              href={`${getBaseRoute()}/contracts/detailed`}
              className="px-6 py-2.5 rounded-2xl bg-[#82A094] hover:bg-[#6e8a7f] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md"
            >
              <Eye className="w-4 h-4" />
              <span>View Annual Contracts</span>
            </a>
          </div>
        </div>
      )}

      {/* ─── Upload & Preview Area ─────────────────────────── */}
      {!importResult && (
        <>
          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed p-8 sm:p-12 cursor-pointer text-center transition-all duration-200 bg-white ${
              dragActive
                ? 'border-[#6F8A9D] bg-[#6F8A9D]/5 shadow-md'
                : file
                  ? 'border-[#82A094] bg-[#82A094]/5 shadow-sm'
                  : 'border-slate-300 hover:border-[#6F8A9D] hover:bg-slate-50/50 shadow-sm'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />

            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 text-[#82A094] animate-spin" />
                <p className="text-sm font-bold text-slate-800">Analyzing & parsing Excel columns...</p>
                <p className="text-xs text-slate-400">Auto-detecting header fields and serial number columns</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#82A094]/15 text-[#4E7D6D] flex items-center justify-center">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <p className="text-base font-extrabold text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500 font-medium">
                  {(file.size / 1024).toFixed(1)} KB · Click to replace file
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm sm:text-base font-extrabold text-slate-800">
                  Drag & drop your Excel file here, or click to browse
                </p>
                <p className="text-xs text-slate-500 max-w-md font-medium">
                  Supports .xlsx and .xls (e.g. machine Dtls Dummy.xlsx, Dummy contract Data (1).xlsx)
                </p>
              </div>
            )}
          </div>

          {/* Sheet Selector (if multiple sheets exist) */}
          {sheetNames.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-[#546A7A] uppercase tracking-wider">
                <FileCheck className="w-4 h-4 text-[#82A094]" />
                <span>Workbook Sheets:</span>
              </div>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D] cursor-pointer"
              >
                {sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Data Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#4E7D6D]">
                    <CheckCircle className="w-4 h-4 text-[#82A094]" />
                    <span>{validCount} valid records</span>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-rose-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errorCount} errors</span>
                    </div>
                  )}
                  {warningCount > 0 && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#B8874E]">
                      <AlertTriangle className="w-4 h-4 text-[#CE9F6B]" />
                      <span>{warningCount} warnings</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={reset}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || validCount === 0}
                    className="px-6 py-2.5 rounded-xl bg-[#82A094] hover:bg-[#6e8a7f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{importing ? 'Importing...' : `Import ${validCount} Records`}</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider z-10">
                      <tr>
                        <th className="px-3 py-3 text-left">Row</th>
                        <th className="px-3 py-3 text-left">Status</th>
                        <th className="px-3 py-3 text-left">Customer</th>
                        <th className="px-3 py-3 text-left">Class</th>
                        <th className="px-3 py-3 text-left">Place</th>
                        <th className="px-3 py-3 text-left">Zone</th>
                        <th className="px-3 py-3 text-left">Engineer</th>
                        <th className="px-3 py-3 text-left">Serial No</th>
                        <th className="px-3 py-3 text-left">Unit / Model</th>
                        <th className="px-3 py-3 text-left">Control</th>
                        <th className="px-3 py-3 text-center">Type</th>
                        <th className="px-3 py-3 text-left">MC Start</th>
                        <th className="px-3 py-3 text-left">MC End</th>
                        <th className="px-3 py-3 text-right">MC Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((row, idx) => {
                        const hasError = row._errors.length > 0;
                        const hasWarning = row._warnings.length > 0;
                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              hasError
                                ? 'bg-rose-50/60 hover:bg-rose-50'
                                : hasWarning
                                  ? 'bg-amber-50/50 hover:bg-amber-50'
                                  : 'hover:bg-slate-50/80'
                            }`}
                            title={hasError ? row._errors.join(', ') : hasWarning ? row._warnings.join(', ') : ''}
                          >
                            <td className="px-3 py-2.5 font-bold text-slate-400">{row._rowIndex}</td>
                            <td className="px-3 py-2.5">
                              {hasError ? (
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                              ) : hasWarning ? (
                                <AlertTriangle className="w-4 h-4 text-[#CE9F6B]" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-[#82A094]" />
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-extrabold text-slate-800 max-w-[160px] truncate">
                              {row.customerName || '—'}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-700">{row.customerClass || '—'}</td>
                            <td className="px-3 py-2.5 text-slate-600">{row.place || '—'}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-700">{row.zoneName || '—'}</td>
                            <td className="px-3 py-2.5 text-slate-600">{row.engineerName || '—'}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{row.serialNumber || '—'}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-800">{row.unitType || '—'}</p>
                              {row.modelNumber && (
                                <p className="text-[10px] text-slate-400 font-mono">{row.modelNumber}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{row.controlType || '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30">
                                {row.contractType || 'UMC'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{formatDate(row.mcStartDate)}</td>
                            <td className="px-3 py-2.5 text-slate-700">{formatDate(row.mcEndDate)}</td>
                            <td className="px-3 py-2.5 text-right font-extrabold text-slate-800">
                              {row.mcValue !== null ? `₹${Number(row.mcValue).toLocaleString('en-IN')}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
