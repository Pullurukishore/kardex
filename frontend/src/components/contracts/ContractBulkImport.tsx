'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, ArrowLeft,
  Trash2, Sparkles, Download, Check, RefreshCw, AlertCircle, HelpCircle, Plus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { apiService } from '@/services/api';

interface ExcelRow {
  'Customer Name'?: string;
  'Place'?: string;
  'SLA Type'?: string;
  'No of Machines'?: string | number;
  'Contract Amount'?: string | number;
  'No of Visits'?: string | number;
  'Start Date'?: string;
  'End Date'?: string;
  'PO Number'?: string;
  'PO Date'?: string;
  'Responsible Engineer'?: string;
  'Zone Name'?: string;
  'Payment Terms'?: string;
  'Software Support'?: string;
}

interface ParsedContract {
  id: string; // Temp client-side UUID
  customerName: string;
  place: string;
  mcType: string;
  noOfMachine: number;
  amount: number;
  noOfVisits: number;
  startDate: string;
  endDate: string;
  poNo: string;
  poDate: string;
  responsible: string;
  zoneName: string;
  paymentTerms: string;
  softwareSupport: boolean;
  bdCount: number;
  pmSchedules?: any[];
  contractNumber?: string;

  // Resolution mappings
  customerId?: number;
  zoneId?: number;

  // Validation status
  errors: string[];
}

interface ContractBulkImportProps {
  role: string;
}

export default function ContractBulkImport({ role }: ContractBulkImportProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workbookRef = useRef<ExcelJS.Workbook | null>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [dbZones, setDbZones] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedContract[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [hiddenSheetsCount, setHiddenSheetsCount] = useState(0);
  const [showHiddenSheets, setShowHiddenSheets] = useState(false);
  const allWorkbookSheetsRef = useRef<{ visible: string[]; hidden: string[]; all: string[] }>({ visible: [], hidden: [], all: [] });
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterMode, setFilterMode] = useState<'all' | 'warnings' | 'valid'>('all');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [quickCreateModalOpen, setQuickCreateModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scrolling when either modal is open
  useEffect(() => {
    if (confirmModalOpen || quickCreateModalOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [confirmModalOpen, quickCreateModalOpen]);

  // Quick Create Customer Modal State
  const [targetRowForCustomer, setTargetRowForCustomer] = useState<ParsedContract | null>(null);
  const [qcCompanyName, setQcCompanyName] = useState('');
  const [qcAddress, setQcAddress] = useState('');
  const [qcZoneId, setQcZoneId] = useState('');
  const [qcContactName, setQcContactName] = useState('Primary Contact');
  const [qcContactPhone, setQcContactPhone] = useState('9999999999');
  const [qcContactEmail, setQcContactEmail] = useState('');
  const [qcCreating, setQcCreating] = useState(false);

  // Load dependencies for mapping and validation
  useEffect(() => {
    const loadData = async () => {
      try {
        const [cData, zData, uData] = await Promise.all([
          apiService.getCustomers({ limit: 1000 }),
          apiService.getZones(),
          apiService.getUsers()
        ]);
        const rawCust = Array.isArray(cData) ? cData : (cData?.customers || cData?.data || []);
        const preprocessed = rawCust.map((c: any) => ({
          ...c,
          _cleanedName: cleanName(c.companyName || c.name || '')
        }));
        setDbCustomers(preprocessed);
        setDbZones(Array.isArray(zData) ? zData : (zData?.data || []));
        setDbUsers(uData.users || uData || []);
      } catch (err) {
        console.error('Failed to load import prerequisites:', err);
        toast.error('Failed to load customer list for mapping');
      }
    };
    loadData();
  }, []);

  const getBaseRoute = () => {
    if (role === 'Admin') return '/admin';
    if (role === 'Zone Manager') return '/zone-manager';
    return '/admin';
  };

  // Memoize customer options with pre-formatted labels and zone names
  const customerOptions = useMemo(() => {
    const zoneMap = new Map((dbZones || []).map((z: any) => [Number(z.id), z.name]));
    return (dbCustomers || []).map((cust: any) => {
      const zName = cust.serviceZone?.name || zoneMap.get(Number(cust.serviceZoneId));
      const placeStr = cust.address ? ` - ${cust.address}` : '';
      return {
        id: cust.id,
        label: `${cust.companyName || cust.name}${placeStr}${zName ? ` (${zName} Zone)` : ''}`
      };
    });
  }, [dbCustomers, dbZones]);

  const rowsWithWarnings = useMemo(() => (parsedData || []).filter(r => r.errors.length > 0), [parsedData]);
  const rowsWithWarningsCount = rowsWithWarnings.length;
  const rowsValidCount = (parsedData || []).length - rowsWithWarningsCount;

  const filteredData = useMemo(() => {
    if (filterMode === 'warnings') return rowsWithWarnings;
    if (filterMode === 'valid') return (parsedData || []).filter(r => r.errors.length === 0);
    return parsedData;
  }, [parsedData, filterMode, rowsWithWarnings]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Generate and download a sample Excel file
  const handleDownloadTemplate = () => {
    const headers = [
      'Contract No',
      'Customer Name',
      'Place',
      'MC Type',
      'No of Machine',
      'Amount',
      'No of Visits',
      'Start ',
      'End',
      'PO No',
      'PO Date',
      'Payment Terms',
      'Responsible',
      'Zone',
      'Software Support',
      'BD',
      '1st PM',
      '1st PM Date',
      '2nd PM',
      '2nd PM Date',
      '3rd PM',
      '3rd PM Date',
      '4th PM',
      '4th PM Date',
      '5th PM',
      '5th PM Date',
      '6th PM',
      '6th PM Date',
      '7th PM',
      '7th PM Date',
      '8th PM',
      '8th PM Date',
      '9th PM',
      '9th PM Date',
      '10th PM',
      '10th PM Date',
      '11th PM',
      '12th PM'
    ];

    const sampleRows: any[] = [];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ContractsTemplate');

    // Auto-adjust column widths
    const colWidths = headers.map(header => ({
      wch: Math.max(header.length + 3, 15)
    }));
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, 'fsm_contracts_import_template.xlsx');
    toast.success('Sample import template downloaded!');
  };

  const formatDateISO = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse dates flexibly
  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      return formatDateISO(val);
    }

    // If Excel number serial format
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return formatDateISO(date);
    }

    const str = String(val).trim();
    if (!str) return '';

    // Try direct date parsing first
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return formatDateISO(d);
    }

    // Fallback: Handle DD/MM/YYYY
    const partsDMY = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (partsDMY) {
      const day = partsDMY[1].padStart(2, '0');
      const month = partsDMY[2].padStart(2, '0');
      const year = partsDMY[3];
      return `${year}-${month}-${day}`;
    }

    // Handle YYYY-MM-DD
    const partsYMD = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
    if (partsYMD) {
      const year = partsYMD[1];
      const month = partsYMD[2].padStart(2, '0');
      const day = partsYMD[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return '';
  };

  const monthsMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4, apri: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8, ag: 8, ug: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  const extractDateFromRange = (rangeStr: any): string => {
    if (!rangeStr || typeof rangeStr !== 'string') return '';
    const matches = [...rangeStr.matchAll(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/g)];
    if (matches.length > 0) {
      const m = matches.length >= 2 ? matches[1] : matches[0];
      const day = String(m[1]).padStart(2, '0');
      const month = String(m[2]).padStart(2, '0');
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const parseCompletionDate = (val: any, rangeVal?: any, fallbackYear?: number): string => {
    if (!val) {
      return extractDateFromRange(rangeVal);
    }
    if (val instanceof Date) {
      return formatDateISO(val);
    }

    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return !isNaN(date.getTime()) ? formatDateISO(date) : '';
    }

    const str = String(val).trim();
    if (!str) return extractDateFromRange(rangeVal);

    // Standardize common patterns (remove st, nd, rd, th, tth)
    const cleanStr = str.replace(/(\d+)(st|nd|rd|th|tth)/gi, '$1');

    const d = new Date(cleanStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2035) {
      return formatDateISO(d);
    }

    // Match DD Month YY/YYYY anywhere in sentences (e.g. '29th Aug 25,Inv generated', '14th Aug ,raise in July', '8th MAy 26')
    const match1 = str.match(/(\d{1,2})(?:st|nd|rd|th|tth)?\s+([A-Za-z]+)(?:\s*[, -]?\s*(\d{2,4}))?/i);
    if (match1) {
      const day = parseInt(match1[1], 10);
      const mStr = match1[2].toLowerCase();
      let year = match1[3] ? parseInt(match1[3].replace(/\s+/g, ''), 10) : (fallbackYear || 2025);
      if (year < 100) year = 2000 + year;
      const matchedKey = Object.keys(monthsMap).find(k => mStr.startsWith(k));
      const mNum = monthsMap[mStr] || (matchedKey ? monthsMap[matchedKey] : null);
      if (mNum && day >= 1 && day <= 31) {
        return `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Match Month DD YY (e.g. 'Aug 14th 26')
    const match2 = str.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th|tth)?(?:\s*[, -]?\s*(\d{2,4}))?/i);
    if (match2) {
      const mStr = match2[1].toLowerCase();
      const day = parseInt(match2[2], 10);
      let year = match2[3] ? parseInt(match2[3].replace(/\s+/g, ''), 10) : (fallbackYear || 2025);
      if (year < 100) year = 2000 + year;
      const matchedKey = Object.keys(monthsMap).find(k => mStr.startsWith(k));
      const mNum = monthsMap[mStr] || (matchedKey ? monthsMap[matchedKey] : null);
      if (mNum && day >= 1 && day <= 31) {
        return `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Fallback: match DD/MM/YYYY or DD-MM-YYYY
    const partsDMY = cleanStr.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})/);
    if (partsDMY) {
      const day = partsDMY[1].padStart(2, '0');
      const month = partsDMY[2].padStart(2, '0');
      let year = partsDMY[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    return extractDateFromRange(rangeVal);
  };

  const getCellCleanValue = (cell: any): any => {
    if (!cell) return '';
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if (val instanceof Date) return val;
      if ('result' in val) return val.result;
      if ('text' in val) return val.text;
      if ('richText' in val && Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text).join('');
      }
    }
    return val;
  };

  const checkArgbIsGreen = (argbRaw: any): boolean => {
    if (!argbRaw) return false;
    const str = String(argbRaw).toUpperCase().trim();
    if (!str) return false;

    // Direct matches for common Excel / Google Sheets green hexes
    const knownGreenHexes = [
      '92D050', // Standard Light Green
      '00B050', // Standard Green
      '70AD47', // Office Green Accent 6
      '548235', // Accent 6 - 25% darker
      '385723', // Accent 6 - 50% darker
      '375623',
      'A9D08E', // Accent 6 - 40% lighter
      'C6EFCE', // Light Green Fill (Conditional Formatting)
      'E2EFDA', // Accent 6 - 80% lighter (soft green)
      '006100', // Dark Green Text (Conditional Formatting)
      'A4B388', // Sage green
      '82A094', // Kardex sage green
      'D9EAD3', // Google Sheets soft green 1
      'B6D7A8', // Google Sheets green 2
      '274E13', // Google Sheets dark green
      '34A853', // Material green
      '22C55E', // Tailwind green-500
      '16A34A', // Tailwind green-600
      '15803D', // Tailwind green-700
      '4CAF50',
      '8BC34A',
      '57BB8A',
      'B7E1CD'
    ];
    if (knownGreenHexes.some(k => str.includes(k))) {
      return true;
    }

    // Hex RGB dominant-green analysis
    const clean = str.replace(/^#/, '');
    const hex = clean.length === 8 ? clean.slice(2) : clean;
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        // Green dominates Red and Blue
        if (g > 60 && g > r && g > b) {
          // Soft/light greens (high RGB, e.g. E2EFDA)
          if (g > 200 && (g - r >= 5 || g - b >= 5)) return true;
          // Normal/vibrant/dark greens
          if (g > r * 1.05 && g > b * 1.05) return true;
        }
      }
    }
    return false;
  };

  const isCellGreen = (cell: any): boolean => {
    if (!cell) return false;

    // Check cell fill (fgColor, bgColor, styles)
    const fills = [cell.fill, cell.style?.fill].filter(Boolean);
    for (const fill of fills) {
      const fg = fill.fgColor;
      const bg = fill.bgColor;
      if (fg?.argb && checkArgbIsGreen(fg.argb)) return true;
      if (bg?.argb && checkArgbIsGreen(bg.argb)) return true;
      // Excel theme 9 is typically Accent 6 (Green)
      if (fg?.theme === 9 || bg?.theme === 9) return true;
    }

    // Check cell font color (e.g. conditional formatting green text 006100)
    const fonts = [cell.font, cell.style?.font].filter(Boolean);
    for (const font of fonts) {
      if (font?.color?.argb && checkArgbIsGreen(font.color.argb)) return true;
      if (font?.color?.theme === 9) return true;
    }

    return false;
  };

  const isCompletedText = (val: any): boolean => {
    if (!val) return false;
    const s = String(val).toLowerCase().trim();
    return /\b(done|completed|complete|attended|closed|finished|yes|ok)\b/i.test(s);
  };

  const cleanName = (str: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/\b(pvt|ltd|private|limited|co|corp|corporation|company|india|ltd\.|pvt\.)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const getDistance = (s1: string, s2: string): number => {
    const m = s1.length;
    const n = s2.length;
    if (Math.abs(m - n) > 2) return 999;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Int32Array(n + 1);
    let curr = new Int32Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      const c1 = s1.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        if (c1 === s2.charCodeAt(j - 1)) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = Math.min(prev[j], curr[j - 1], prev[j - 1]) + 1;
        }
      }
      const temp = prev;
      prev = curr;
      curr = temp;
    }
    return prev[n];
  };

  const normalizePlaceForComparison = (place: string): string => {
    const norm = place.trim().toLowerCase();

    // Bangalore synonyms
    if (norm === 'bangalore' || norm === 'bengaluru' || norm === 'bng' || norm === 'blr' || norm.includes('bangalore') || norm.includes('bengaluru')) {
      return 'bengaluru';
    }

    // Belgaum synonyms
    if (norm === 'belgum' || norm === 'belgam' || norm === 'belgaum') {
      return 'belgaum';
    }

    // Kolkata synonyms
    if (norm === 'kolkota' || norm === 'kolkata') {
      return 'kolkata';
    }

    // Nashik synonyms
    if (norm === 'nasik' || norm === 'nashik') {
      return 'nashik';
    }

    // Akurdi synonyms
    if (norm === 'akrudi' || norm === 'akurdi') {
      return 'akurdi';
    }

    // Hoshiarpur synonyms
    if (norm === 'hosiarpur-punjab' || norm === 'hoshiarpur- punjab' || norm === 'hoshiarpur' || norm.includes('hoshiarpur') || norm.includes('hosiarpur')) {
      return 'hoshiarpur';
    }

    // Dapodi synonyms
    if (norm === 'dapodi' || norm === 'dapodi pune' || norm === 'dapodi, pune' || norm === 'dapodi-pune') {
      return 'dapodi';
    }

    // Chinchwad synonyms
    if (norm === 'chinchwad pune' || norm === 'chinhwad - pune' || norm === 'chinchwad-pune' || norm.includes('chinchwad') || norm.includes('chinhwad')) {
      return 'chinchwad';
    }

    // Bidadi synonyms
    if (norm === 'bidaddi' || norm === 'bidadi') {
      return 'bidadi';
    }

    // Kothrud/Pune
    if (norm === 'kothrud') {
      return 'pune';
    }

    return norm;
  };

  const isPlaceMatch = (p1: string, p2: string): boolean => {
    if (!p1 || !p2) return true;
    const n1 = normalizePlaceForComparison(p1);
    const n2 = normalizePlaceForComparison(p2);
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  };

  const isFuzzyMatch = (dbName: string, excelName: string, preCleanDb?: string, preCleanEx?: string): boolean => {
    if (!dbName || !excelName) return false;

    const dName = dbName.trim().toLowerCase();
    const eName = excelName.trim().toLowerCase();

    if (dName === eName) return true;

    if (dName.includes('electro optical') && eName.includes('electro optics')) return true;

    const cDb = preCleanDb !== undefined ? preCleanDb : cleanName(dbName);
    const cEx = preCleanEx !== undefined ? preCleanEx : cleanName(excelName);
    if (!cDb || !cEx) return false;
    if (cDb === cEx) return true;

    // Cleaned prefix match (first 10 chars)
    if (cDb.length >= 10 && cEx.length >= 10) {
      if (cDb.substring(0, 10) === cEx.substring(0, 10)) return true;
    }

    // Substring match with minimum length of 3
    if (cDb.length >= 3 && cEx.length >= 3) {
      if (cDb.includes(cEx) || cEx.includes(cDb)) return true;

      // Edit distance check for small typos
      if (Math.abs(cDb.length - cEx.length) <= 2) {
        const dist = getDistance(cDb, cEx);
        if (dist <= 2) return true;
      }
    }

    return false;
  };

  // Validate single contract row
  const validateContract = (contract: Partial<ParsedContract>): string[] => {
    const errs: string[] = [];

    if (!contract.customerName) errs.push('Customer Name is required');
    if (!contract.place) errs.push('Place is required');
    if (!contract.poNo) errs.push('PO Number is required');
    if (contract.amount === undefined || isNaN(contract.amount) || contract.amount < 0) errs.push('Amount must be a non-negative number');
    if (!contract.noOfVisits || contract.noOfVisits < 1 || contract.noOfVisits > 12) errs.push('Visits must be between 1 and 12');

    if (!contract.startDate) {
      errs.push('Start Date is required or has invalid format');
    }
    if (!contract.endDate) {
      errs.push('End Date is required or has invalid format');
    }

    if (contract.startDate && contract.endDate) {
      const sDate = new Date(contract.startDate);
      const eDate = new Date(contract.endDate);
      if (sDate.getTime() >= eDate.getTime()) {
        errs.push('End Date must be after Start Date');
      }
    }

    if (!contract.zoneName) errs.push('Zone Name is required');
    if (!contract.zoneId) errs.push('Zone Name does not match service zone database');

    return errs;
  };

  // Parse a specific sheet from the workbook
  const parseWorkbookSheet = (workbook: ExcelJS.Workbook, sheetName: string, custs = dbCustomers, zones = dbZones) => {
    try {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        toast.error(`Sheet "${sheetName}" not found in workbook.`);
        return;
      }

      // Find header row index
      let headerRowIndex = -1;
      const headerColMap: { [colIndex: number]: string } = {};

      worksheet.eachRow((row, rowNumber) => {
        if (headerRowIndex !== -1 || rowNumber > 15) return;
        let isHeader = false;
        row.eachCell({ includeEmpty: true }, (cell) => {
          const str = String(getCellCleanValue(cell) || '').trim().toLowerCase();
          if (
            str === 'customer name' ||
            str === 'name of the customer' ||
            str === 'customer' ||
            (str.includes('customer') && str.length < 25 && !str.includes('invoice') && !str.includes('territory') && !str.includes('release'))
          ) {
            isHeader = true;
          }
        });
        if (isHeader) {
          headerRowIndex = rowNumber;
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headerColMap[colNumber] = String(getCellCleanValue(cell) || '').trim().toLowerCase();
          });
        }
      });

      if (headerRowIndex === -1) {
        toast.error(`Could not find header row in sheet "${sheetName}". Make sure you have a "Customer Name" column.`);
        return;
      }

      // Find column indices
      const getColIndex = (aliases: string[]) => {
        for (const [colStr, headerText] of Object.entries(headerColMap)) {
          if (aliases.some(alias => headerText.includes(alias.toLowerCase()))) {
            return Number(colStr);
          }
        }
        return -1;
      };

      const custCol = getColIndex(['customer name', 'customername', 'company', 'name of the customer']);
      const placeCol = getColIndex(['place', 'location', 'city']);
      const mcCol = getColIndex(['mc type', 'mc_type', 'mctype', 'sla type', 'slatype', 'care level']);
      const machinesCol = getColIndex(['no of machine', 'no of machines', 'noofmachine', 'noofmachines', 'number of machines', 'number of machine', 'machines']);
      const amountCol = getColIndex(['amount', 'contract amount', 'contractamount', 'value', 'price']);
      const visitsCol = getColIndex(['no of visits', 'noofvisits', 'number of visits', 'visits']);
      const startCol = getColIndex(['start', 'start ', 'start date', 'startdate']);
      const endCol = getColIndex(['end', 'end date', 'enddate']);
      const poCol = getColIndex(['po no', 'po no.', 'po number', 'pono', 'ponumber']);
      const poDateCol = getColIndex(['po date', 'podate']);
      const respCol = getColIndex(['responsible', 'responsible engineer', 'engineer', 'technician']);
      const zoneCol = getColIndex(['zone', 'zone name', 'zonename']);
      const swCol = getColIndex(['software support', 'softwaresupport', 'sw support']);
      const bdCol = getColIndex(['bd', 'bd count', 'bdcount', 'buffer days', 'breakdown visits']);
      const pm1Col = getColIndex(['1st pm', 'pm1', 'pm 1']);
      const contractNoCol = getColIndex(['contract no', 'contract number', 'contract_no', 'contractnumber', 'agreement no', 'agreement number']);
      const paymentCol = getColIndex(['payment terms', 'paymentterms', 'payment term', 'paymentterm', 'payment']);

      // Track recent zone by customer name or PO to auto-inherit across multi-year split rows
      const poZoneMap = new Map<string, any>();
      const custZoneMap = new Map<string, any>();
      const parsedRows: ParsedContract[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return;

        const rawCustName = custCol !== -1 ? String(getCellCleanValue(row.getCell(custCol)) || '').trim() : '';
        if (!rawCustName) return; // Skip empty rows

        const cleanedRowCustName = cleanName(rawCustName);
        const rawContractNo = contractNoCol !== -1 ? String(getCellCleanValue(row.getCell(contractNoCol)) || '').trim() : '';
        const rawPaymentTerms = paymentCol !== -1 ? String(getCellCleanValue(row.getCell(paymentCol)) || '').trim() : '';
        const rawZoneName = zoneCol !== -1 ? String(getCellCleanValue(row.getCell(zoneCol)) || '').trim() : '';
        const rawMcType = mcCol !== -1 ? String(getCellCleanValue(row.getCell(mcCol)) || '').trim() : '';
        const rawSoftware = swCol !== -1 ? String(getCellCleanValue(row.getCell(swCol)) || '').trim().toLowerCase() : '';
        const rawPlaceStr = placeCol !== -1 ? String(getCellCleanValue(row.getCell(placeCol)) || '').trim().toLowerCase() : '';
        const rawPoNo = poCol !== -1 ? String(getCellCleanValue(row.getCell(poCol)) || '').trim() : '';

        // Normalize zone string & common typos (e.g. "Easr" -> "East")
        let cleanZoneName = rawZoneName.trim();
        const lowerZ = cleanZoneName.toLowerCase();
        if (lowerZ === 'easr' || lowerZ === 'est') cleanZoneName = 'East';
        else if (lowerZ === 'sout' || lowerZ === 'st') cleanZoneName = 'South';
        else if (lowerZ === 'nrth' || lowerZ === 'nth') cleanZoneName = 'North';
        else if (lowerZ === 'wst' || lowerZ === 'wset') cleanZoneName = 'West';

        // Match database Zone directly from Excel
        let matchedZone = zones && Array.isArray(zones)
          ? zones.find(z => z?.name && String(z.name).toLowerCase() === cleanZoneName.toLowerCase())
          : undefined;

        // Match database Customer
        const matchedCust = custs && Array.isArray(custs)
          ? custs.find(c => {
            if (!c?.companyName) return false;
            // Check zone FIRST if resolved to eliminate false positive candidates
            if (matchedZone && c.serviceZoneId && c.serviceZoneId !== matchedZone.id) return false;
            if (!isFuzzyMatch(c.companyName, rawCustName, c._cleanedName, cleanedRowCustName)) return false;

            // Match address/place if provided in both Excel and DB
            if (rawPlaceStr && c.address) {
              return isPlaceMatch(rawPlaceStr, c.address);
            }
            return true;
          })
          : undefined;

        // Smart Zone Fallbacks:
        if (!matchedZone && matchedCust) {
          if (matchedCust.serviceZoneId) {
            matchedZone = zones.find(z => Number(z.id) === Number(matchedCust.serviceZoneId));
          } else if (matchedCust.serviceZone?.name) {
            matchedZone = zones.find(z => String(z.name).toLowerCase() === String(matchedCust.serviceZone.name).toLowerCase());
          }
        }

        if (!matchedZone && rawPoNo && poZoneMap.has(rawPoNo)) {
          matchedZone = poZoneMap.get(rawPoNo);
        }
        if (!matchedZone && cleanedRowCustName && custZoneMap.has(cleanedRowCustName)) {
          matchedZone = custZoneMap.get(cleanedRowCustName);
        }

        if (!matchedZone) {
          const placeToCheck = (rawPlaceStr || matchedCust?.address || '').toLowerCase();
          if (placeToCheck.includes('bangalore') || placeToCheck.includes('bengaluru') || placeToCheck.includes('chennai') || placeToCheck.includes('hyderabad')) {
            matchedZone = zones.find(z => z.name.toLowerCase() === 'south');
          } else if (placeToCheck.includes('pune') || placeToCheck.includes('mumbai') || placeToCheck.includes('aurangabad') || placeToCheck.includes('gujarat') || placeToCheck.includes('vadodara') || placeToCheck.includes('ahmedabad')) {
            matchedZone = zones.find(z => z.name.toLowerCase() === 'west');
          } else if (placeToCheck.includes('delhi') || placeToCheck.includes('noida') || placeToCheck.includes('gurgaon') || placeToCheck.includes('ghaziabad') || placeToCheck.includes('faridabad')) {
            matchedZone = zones.find(z => z.name.toLowerCase() === 'north');
          } else if (placeToCheck.includes('kolkata') || placeToCheck.includes('jamshedpur') || placeToCheck.includes('ranchi') || placeToCheck.includes('orissa') || placeToCheck.includes('odisha') || placeToCheck.includes('koraput')) {
            matchedZone = zones.find(z => z.name.toLowerCase() === 'east');
          }
        }

        if (matchedZone) {
          if (rawPoNo) poZoneMap.set(rawPoNo, matchedZone);
          if (cleanedRowCustName) custZoneMap.set(cleanedRowCustName, matchedZone);
        }

        let startDateParsed = startCol !== -1 ? parseExcelDate(getCellCleanValue(row.getCell(startCol))) : '';
        let endDateParsed = endCol !== -1 ? parseExcelDate(getCellCleanValue(row.getCell(endCol))) : '';
        const poDateParsed = poDateCol !== -1 ? parseExcelDate(getCellCleanValue(row.getCell(poDateCol))) : '';

        if (!startDateParsed && poDateParsed) {
          startDateParsed = poDateParsed;
          const sD = new Date(startDateParsed);
          if (!isNaN(sD.getTime())) {
            const eD = new Date(sD);
            eD.setFullYear(eD.getFullYear() + 1);
            eD.setDate(eD.getDate() - 1);
            endDateParsed = formatDateISO(eD);
          }
        }

        if (startDateParsed && !endDateParsed) {
          const sD = new Date(startDateParsed);
          if (!isNaN(sD.getTime())) {
            const eD = new Date(sD);
            eD.setFullYear(eD.getFullYear() + 1);
            eD.setDate(eD.getDate() - 1);
            endDateParsed = formatDateISO(eD);
          }
        }

        const bdRaw = bdCol !== -1 ? String(getCellCleanValue(row.getCell(bdCol)) || '').trim() : '';
        let parsedBdCount = 0;
        if (bdRaw.toLowerCase() === 'unlimited' || bdRaw.toLowerCase() === 'ul') {
          parsedBdCount = 999;
        } else {
          parsedBdCount = parseInt(bdRaw, 10) || 0;
        }

        const parsedVisits = visitsCol !== -1 ? Math.min(12, Math.max(1, Number(getCellCleanValue(row.getCell(visitsCol))) || 3)) : 3;

        const startYear = startDateParsed ? new Date(startDateParsed).getFullYear() : 2025;

        // PM Visits Parsing with GREEN COLOR DETECTION & FULL SENTENCE/TEXT PRESERVATION
        const pmSchedules: any[] = [];
        if (pm1Col !== -1) {
          for (let p = 1; p <= Math.min(12, parsedVisits); p++) {
            let rCol = -1;
            let dCol = -1;
            if (p <= 10) {
              rCol = pm1Col + (p - 1) * 2;
              dCol = rCol + 1;
            } else if (p === 11) {
              rCol = pm1Col + 20;
              dCol = rCol + 1;
            } else if (p === 12) {
              rCol = pm1Col + 21;
              dCol = rCol + 1;
            }

            const rangeCell = row.getCell(rCol);
            const dateCell = dCol !== -1 ? row.getCell(dCol) : null;

            // Check if either range or date cell has green fill
            const isGreen = isCellGreen(rangeCell) || (dateCell ? isCellGreen(dateCell) : false);

            const rawRangeVal = getCellCleanValue(rangeCell);
            let pRange = '';
            if (rawRangeVal instanceof Date) {
              pRange = formatDateISO(rawRangeVal);
            } else if (typeof rawRangeVal === 'number' && rawRangeVal > 25569 && rawRangeVal < 60000) {
              const d = new Date((rawRangeVal - 25569) * 86400 * 1000);
              pRange = !isNaN(d.getTime()) ? formatDateISO(d) : String(rawRangeVal).trim();
            } else {
              pRange = (rawRangeVal !== null && rawRangeVal !== undefined) ? String(rawRangeVal).trim() : '';
            }

            const rawDateVal = dateCell ? getCellCleanValue(dateCell) : null;
            let dateValStr = '';
            if (rawDateVal instanceof Date) {
              const cellText = dateCell?.text ? String(dateCell.text).trim() : '';
              dateValStr = cellText || formatDateISO(rawDateVal);
            } else if (typeof rawDateVal === 'number' && rawDateVal > 25569 && rawDateVal < 60000) {
              const cellText = dateCell?.text ? String(dateCell.text).trim() : '';
              const d = new Date((rawDateVal - 25569) * 86400 * 1000);
              dateValStr = cellText || (!isNaN(d.getTime()) ? formatDateISO(d) : String(rawDateVal).trim());
            } else {
              dateValStr = (rawDateVal !== null && rawDateVal !== undefined) ? String(rawDateVal).trim() : '';
            }

            const completionDate = parseCompletionDate(dateValStr || rawDateVal, pRange, startYear);
            const textIndicatesDone = isCompletedText(dateValStr) || isCompletedText(pRange);

            // BUSINESS RULE: IF GREEN COLOR OR COMPLETION DATE FOUND OR "DONE" TEXT -> COMPLETED
            const isCompleted = isGreen || Boolean(completionDate) || textIndicatesDone;
            const finalCompletedAt = completionDate || (isCompleted ? (startDateParsed || formatDateISO(new Date())) : null);

            // Preserve full sentence/text from pRange and dateValStr (including text + date and notes)
            let finalRange = '';
            const cleanRange = pRange.trim();
            const cleanDateVal = dateValStr.trim();

            if (cleanRange && cleanDateVal) {
              if (/^(?:Done:|done:)/i.test(cleanDateVal)) {
                finalRange = `${cleanRange} | ${cleanDateVal}`;
              } else if (isCompleted) {
                finalRange = `${cleanRange} | Done: ${cleanDateVal}`;
              } else {
                finalRange = `${cleanRange} | ${cleanDateVal}`;
              }
            } else if (cleanRange) {
              if (isCompleted && !/^(?:Done:|done:)/i.test(cleanRange) && isCompletedText(cleanRange)) {
                finalRange = `Done: ${cleanRange}`;
              } else {
                finalRange = cleanRange;
              }
            } else if (cleanDateVal) {
              if (/^(?:Done:|done:)/i.test(cleanDateVal)) {
                finalRange = cleanDateVal;
              } else if (isCompleted) {
                finalRange = `Done: ${cleanDateVal}`;
              } else {
                finalRange = cleanDateVal;
              }
            } else if (isCompleted) {
              finalRange = 'Completed';
            }

            // Push PM schedule if any text/range exists OR if cell is completed/green
            if (finalRange || isCompleted) {
              pmSchedules.push({
                pmNumber: p,
                range: finalRange,
                status: isCompleted ? 'Completed' : 'Pending',
                completedAt: finalCompletedAt
              });
            }
          }
        }

        const rawAmountVal = amountCol !== -1 ? getCellCleanValue(row.getCell(amountCol)) : '';
        const amtStr = String(rawAmountVal || '').trim();
        const cleanAmt = (!amtStr || amtStr === '-') ? 0 : (parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0);

        const rawMachinesVal = machinesCol !== -1 ? getCellCleanValue(row.getCell(machinesCol)) : 0;
        const noOfMachineParsed = (rawMachinesVal !== '' && rawMachinesVal !== null && rawMachinesVal !== undefined) ? (Number(rawMachinesVal) || 0) : 0;

        const contractItem: Partial<ParsedContract> = {
          id: `row-${rowNumber}-${Date.now()}`,
          customerName: rawCustName || 'Blank Customer',
          place: placeCol !== -1 ? String(getCellCleanValue(row.getCell(placeCol)) || '').trim() : '',
          mcType: rawMcType,
          noOfMachine: noOfMachineParsed,
          amount: cleanAmt,
          noOfVisits: parsedVisits,
          startDate: startDateParsed,
          endDate: endDateParsed,
          poNo: (rawPoNo && rawPoNo !== 'N/A' && rawPoNo !== '-') ? rawPoNo : 'PO-AWAITED',
          poDate: poDateParsed || startDateParsed,
          responsible: respCol !== -1 ? String(getCellCleanValue(row.getCell(respCol)) || '').trim() : '',
          zoneName: matchedZone?.name || cleanZoneName || rawZoneName || '',
          paymentTerms: rawPaymentTerms || undefined,
          softwareSupport: rawSoftware === 'yes' || rawSoftware === 'true' || rawSoftware === '1',
          bdCount: parsedBdCount,
          pmSchedules: pmSchedules,
          customerId: matchedCust?.id,
          zoneId: matchedZone?.id,
          contractNumber: rawContractNo || undefined
        };

        contractItem.errors = validateContract(contractItem);
        parsedRows.push(contractItem as ParsedContract);
      });

      // Filter out empty rows
      const validParsedRows = parsedRows.filter(r => r.customerName && r.customerName !== 'Blank Customer');

      // Post-process: Propagate "No of Machine" within multi-year contract groups.
      const mcGroupMap = new Map<string, number>();
      for (const r of validParsedRows) {
        if (r.noOfMachine > 0) {
          const gKey = `${r.customerName.toLowerCase().trim()}::${(r.place || '').toLowerCase().trim()}::${(r.poNo || '').toLowerCase().trim()}`;
          mcGroupMap.set(gKey, Math.max(mcGroupMap.get(gKey) || 0, r.noOfMachine));
        }
      }
      for (const r of validParsedRows) {
        if (r.noOfMachine <= 0) {
          const gKey = `${r.customerName.toLowerCase().trim()}::${(r.place || '').toLowerCase().trim()}::${(r.poNo || '').toLowerCase().trim()}`;
          r.noOfMachine = mcGroupMap.get(gKey) || 1;
        }
      }

      setParsedData(validParsedRows);
      setCurrentPage(1);
      toast.success(`Loaded ${validParsedRows.length} contract agreements from sheet "${sheetName}".`);
    } catch (err) {
      console.error(`Failed parsing excel sheet "${sheetName}":`, err);
      toast.error(`Failed to parse sheet "${sheetName}".`);
    }
  };

  // Helper to convert SheetJS parsed workbook to ExcelJS Workbook when ExcelJS fails on shared/legacy workbooks
  const convertXlsxToExcelJS = (rawBuffer: ArrayBuffer): ExcelJS.Workbook => {
    const wbXlsx = XLSX.read(rawBuffer, { type: 'array', cellDates: true });
    const ejWb = new ExcelJS.Workbook();
    for (let idx = 0; idx < wbXlsx.SheetNames.length; idx++) {
      const sName = wbXlsx.SheetNames[idx];
      const sObj = wbXlsx.Sheets[sName];
      const isHidden = !!(wbXlsx.Workbook?.Sheets?.[idx]?.Hidden);
      const ejWs = ejWb.addWorksheet(sName);
      if (isHidden) ejWs.state = 'hidden';
      const rows = XLSX.utils.sheet_to_json<any[]>(sObj, { header: 1, raw: false, defval: '' });
      rows.forEach(r => ejWs.addRow(r));
    }
    return ejWb;
  };

  // Handle excel file parsing with sheet detection using ExcelJS for styling & color inspection
  const processExcelFile = async (file: File) => {
    try {
      setLoading(true);
      const buffer = await file.arrayBuffer();
      let workbook = new ExcelJS.Workbook();
      let isSharedWorkbook = false;

      try {
        await workbook.xlsx.load(buffer);
        setIsSharedMode(false);
      } catch (loadErr) {
        console.warn('ExcelJS failed to parse directly (likely Shared/Legacy workbook). Attempting SheetJS fallback conversion...', loadErr);
        workbook = convertXlsxToExcelJS(buffer);
        isSharedWorkbook = true;
        setIsSharedMode(true);
        toast.info('Loaded shared/legacy Excel workbook in compatibility mode.');
      }
      workbookRef.current = workbook;

      // Filter worksheets based on visibility (ExcelJS ws.state: 'visible' | 'hidden' | 'veryHidden')
      const visibleWorksheets = workbook.worksheets.filter(w => !w.state || w.state === 'visible');
      const hiddenWorksheets = workbook.worksheets.filter(w => w.state === 'hidden' || w.state === 'veryHidden');

      const visibleNames = (visibleWorksheets.length > 0 ? visibleWorksheets : workbook.worksheets).map(w => w.name);
      const hiddenNames = hiddenWorksheets.map(w => w.name);
      const allNames = workbook.worksheets.map(w => w.name) || [];

      allWorkbookSheetsRef.current = {
        visible: visibleNames,
        hidden: hiddenNames,
        all: allNames
      };

      setHiddenSheetsCount(hiddenNames.length);
      setShowHiddenSheets(false);

      if (allNames.length === 0) {
        toast.error('The uploaded Excel file contains no worksheets.');
        setLoading(false);
        return;
      }

      // Default: only show visible worksheets in sheet picker
      setAvailableSheets(visibleNames);

      // Smart multi-sheet auto-detection (scan only visible worksheets first):
      const candidateWorksheets = visibleWorksheets.length > 0 ? visibleWorksheets : workbook.worksheets;
      let defaultSheet = '';
      for (const ws of candidateWorksheets) {
        let hasCustomerHeader = false;
        ws.eachRow((row, rowNumber) => {
          if (rowNumber > 20 || hasCustomerHeader) return;
          row.eachCell((cell) => {
            const str = String(getCellCleanValue(cell) || '').trim().toLowerCase();
            if (
              str === 'customer name' ||
              str === 'name of the customer' ||
              str === 'customer' ||
              str === 'company' ||
              (str.includes('customer') && str.length < 25 && !str.includes('invoice') && !str.includes('territory') && !str.includes('release'))
            ) {
              hasCustomerHeader = true;
            }
          });
        });
        if (hasCustomerHeader) {
          defaultSheet = ws.name;
          break;
        }
      }

      // Fallback to name pattern match within visible sheets
      if (!defaultSheet) {
        defaultSheet = visibleNames.find(s => /amc\s*list/i.test(s)) || '';
        if (!defaultSheet) {
          const yearSheets = visibleNames.filter(s => /2026|2025|2027/i.test(s));
          if (yearSheets.length > 0) {
            defaultSheet = yearSheets[yearSheets.length - 1];
          }
        }
      }
      if (!defaultSheet) {
        defaultSheet = visibleNames.find(s => /contract|amc|machine|detail/i.test(s)) || visibleNames[0] || allNames[0] || '';
      }

      setSelectedSheet(defaultSheet);
      parseWorkbookSheet(workbook, defaultSheet, dbCustomers, dbZones);
    } catch (err) {
      console.error('Failed parsing excel file:', err);
      toast.error('Failed to parse Excel file. Make sure file format is valid.');
    } finally {
      setLoading(false);
    }
  };

  // Inline correction handlers
  const handleUpdateRowCustomer = (rowId: string, custId: number) => {
    const customer = dbCustomers.find(c => c.id === custId);
    if (!customer) return;

    setParsedData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = {
          ...row,
          customerId: custId,
          customerName: customer.name
        };
        updated.errors = validateContract(updated);
        return updated;
      }
      return row;
    }));
  };

  const handleUpdateRowZone = (rowId: string, zoneId: number) => {
    const zone = dbZones.find(z => z.id === zoneId);
    if (!zone) return;

    setParsedData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = {
          ...row,
          zoneId: zoneId,
          zoneName: zone.name
        };
        updated.errors = validateContract(updated);
        return updated;
      }
      return row;
    }));
  };

  const handleUpdateRowDates = (rowId: string, startDate?: string, endDate?: string) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = {
          ...row,
          startDate: startDate !== undefined ? startDate : row.startDate,
          endDate: endDate !== undefined ? endDate : row.endDate,
          poDate: row.poDate || startDate || row.startDate
        };
        updated.errors = validateContract(updated);
        return updated;
      }
      return row;
    }));
  };

  const handleUpdateRowAmount = (rowId: string, amount: number) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = {
          ...row,
          amount
        };
        updated.errors = validateContract(updated);
        return updated;
      }
      return row;
    }));
  };

  const handleUpdateRowPo = (rowId: string, poNo: string) => {
    setParsedData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updated = {
          ...row,
          poNo
        };
        updated.errors = validateContract(updated);
        return updated;
      }
      return row;
    }));
  };

  const handleRemoveRow = (rowId: string) => {
    setParsedData(prev => prev.filter(r => r.id !== rowId));
    toast.info('Row removed from import preview list');
  };

  const handleOpenQuickCreateCustomer = (row: ParsedContract) => {
    setTargetRowForCustomer(row);
    setQcCompanyName(row.customerName);
    setQcAddress(row.place || '');
    setQcZoneId(String(row.zoneId || ''));
    setQcContactName('Primary Contact');
    setQcContactPhone('9999999999');
    setQcContactEmail('');
    setQuickCreateModalOpen(true);
  };

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcCompanyName.trim() || !qcContactName.trim() || !qcContactPhone.trim()) {
      toast.error('Company Name, Contact Person, and Phone are required.');
      return;
    }

    setQcCreating(true);
    try {
      const response = await apiService.createCustomer({
        companyName: qcCompanyName,
        address: qcAddress,
        serviceZoneId: qcZoneId ? Number(qcZoneId) : null,
        isActive: true,
        contactName: qcContactName,
        contactPhone: qcContactPhone,
        contactEmail: qcContactEmail || null
      });

      const newCust = response.customer || response.data || response;
      if (!newCust || !newCust.id) {
        throw new Error('Customer ID not returned');
      }

      toast.success('Customer created successfully!');

      // Update dbCustomers list in state
      const preprocessedCust = {
        ...newCust,
        _cleanedName: cleanName(newCust.companyName || newCust.name || '')
      };
      setDbCustomers(prev => [...prev, preprocessedCust]);

      // Auto-assign to the row
      if (targetRowForCustomer) {
        setParsedData(prev => prev.map(row => {
          if (row.id === targetRowForCustomer.id) {
            const updated = {
              ...row,
              customerId: newCust.id,
              customerName: newCust.companyName || newCust.name
            };
            updated.errors = validateContract(updated);
            return updated;
          }
          return row;
        }));
      }

      setQuickCreateModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create customer:', err);
      toast.error(err.response?.data?.error || 'Failed to create customer.');
    } finally {
      setQcCreating(false);
    }
  };

  // Submit bulk payload to database
  const executeImport = async () => {
    const allErrors = parsedData.flatMap(r => r.errors);
    if (allErrors.length > 0) {
      toast.error(`Please correct all ${allErrors.length} validation errors before importing.`);
      return;
    }

    setConfirmModalOpen(false);
    setLoading(true);
    try {
      const response = await apiService.bulkImportContracts(parsedData, 'replace');
      if (response.success) {
        toast.success(`Successfully imported ${response.count} contract agreements! Database is now 100% in sync with Excel.`);
        router.push(`${getBaseRoute()}/contracts`);
      } else {
        toast.error(response.error || 'Failed importing agreements');
      }
    } catch (err: any) {
      console.error('Failed bulk importing:', err);
      const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Server error importing contracts';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = () => {
    const allErrors = parsedData.flatMap(r => r.errors);
    if (allErrors.length > 0) {
      toast.error(`Please correct all ${allErrors.length} validation errors before importing.`);
      return;
    }

    setConfirmModalOpen(true);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processExcelFile(file);
    } else {
      toast.error('Unsupported file format. Please upload Excel (.xlsx) or CSV.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const totalErrorsCount = parsedData.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div className="space-y-6 font-medium text-slate-800">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#E17F70]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#82A094]/10 rounded-full blur-3xl" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`${getBaseRoute()}/contracts`)}
              className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 active:scale-95 transition-all text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E17F70]/15 border border-[#E17F70]/30 mb-2">
                <Sparkles className="w-4 h-4 text-[#E17F70]" />
                <span className="text-[10px] font-bold text-[#E17F70] tracking-wider uppercase">Bulk Data Entry</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Bulk Import agreements</h1>
              <p className="text-white/60 text-xs mt-1">Import hundreds of service agreements with automated PM cycle generation instantly.</p>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop File Upload */}
      {parsedData.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 ${isDragOver
            ? 'border-[#82A094] bg-[#82A094]/5'
            : 'border-slate-200 hover:border-slate-400 bg-white hover:shadow-md'
            }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center rounded-2xl mx-auto mb-4 hover:scale-105 transition-transform duration-300">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">Drag & Drop Excel File</h3>
          <p className="text-slate-400 text-xs mt-1">Accepts .xlsx, .xls, and .csv formats.</p>
          <div className="mt-4 flex justify-center gap-4">
            <span className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Auto-generate PM Visits
            </span>
            <span className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-blue-600" />
              Dynamic Customer matching
            </span>
          </div>
        </div>
      ) : (
        /* Preview Dashboard */
        <div className="space-y-6">
          {/* Sheet Selector Banner */}
          {(availableSheets.length > 1 || hiddenSheetsCount > 0) && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#82A094]/15 text-[#82A094] flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span>Active Excel Sheet:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#82A094]/15 text-[#82A094] font-extrabold">{selectedSheet}</span>
                    {allWorkbookSheetsRef.current.hidden.includes(selectedSheet) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                        Hidden Tab
                      </span>
                    )}
                    {isSharedMode && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-100 text-sky-800 font-bold border border-sky-200" title="Parsed via Shared Workbook Compatibility Engine">
                        Shared Workbook Supported
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>
                      Found {availableSheets.length} {showHiddenSheets ? 'total' : 'active'} {availableSheets.length === 1 ? 'sheet' : 'sheets'} in workbook
                      {hiddenSheetsCount > 0 && !showHiddenSheets && ` (${hiddenSheetsCount} hidden tabs excluded)`}. Switch below to preview contracts from other tabs:
                    </span>
                    {hiddenSheetsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (showHiddenSheets) {
                            setAvailableSheets(allWorkbookSheetsRef.current.visible);
                            setShowHiddenSheets(false);
                          } else {
                            setAvailableSheets(allWorkbookSheetsRef.current.all);
                            setShowHiddenSheets(true);
                          }
                        }}
                        className="text-[10px] text-slate-600 hover:text-slate-900 font-bold underline transition-colors cursor-pointer"
                      >
                        {showHiddenSheets ? 'Hide hidden tabs' : `Show ${hiddenSheetsCount} hidden tabs`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableSheets.map(s => {
                  const isHidden = allWorkbookSheetsRef.current.hidden.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSelectedSheet(s);
                        if (workbookRef.current) {
                          parseWorkbookSheet(workbookRef.current, s);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${selectedSheet === s
                          ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20'
                          : isHidden
                            ? 'bg-slate-100/70 hover:bg-slate-200 text-slate-400 border border-dashed border-slate-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      title={isHidden ? `${s} (Hidden in Excel)` : s}
                    >
                      <span>{s}</span>
                      {isHidden && <span className="text-[9px] text-amber-600 font-semibold">(Hidden)</span>}
                      {s === selectedSheet && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Rows Card (Clickable Filter) */}
            <button
              type="button"
              onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
              className={`text-left rounded-2xl p-5 border transition-all cursor-pointer ${filterMode === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
                : 'bg-white hover:bg-slate-50 border-slate-100 shadow-sm text-slate-800'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${filterMode === 'all' ? 'text-white/60' : 'text-slate-400'}`}>Total Rows</p>
                  <h3 className={`text-2xl font-bold ${filterMode === 'all' ? 'text-white' : 'text-slate-700'}`}>{parsedData.length}</h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${filterMode === 'all' ? 'bg-white/10 text-white border-white/20' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
              <div className={`mt-2 text-[10px] font-medium flex items-center gap-1 ${filterMode === 'all' ? 'text-white/70' : 'text-slate-400'}`}>
                {filterMode === 'all' ? '✓ Showing all records' : 'Click to show all records'}
              </div>
            </button>

            {/* Validation Warnings Card (Clickable Filter to See All Warnings) */}
            <button
              type="button"
              onClick={() => { setFilterMode('warnings'); setCurrentPage(1); }}
              className={`text-left rounded-2xl p-5 border transition-all cursor-pointer ${filterMode === 'warnings'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white hover:bg-amber-50/40 border-slate-100 shadow-sm text-slate-800'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${filterMode === 'warnings' ? 'text-white/80' : 'text-slate-400'}`}>Validation status</p>
                  <h3 className={`text-2xl font-bold ${filterMode === 'warnings' ? 'text-white' : totalErrorsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {totalErrorsCount > 0 ? `${totalErrorsCount} Warnings` : 'All Valid'}
                  </h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${filterMode === 'warnings'
                    ? 'bg-white/20 text-white border-white/30'
                    : totalErrorsCount > 0
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}>
                  {totalErrorsCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </div>
              </div>
              <div className={`mt-2 text-[10px] font-medium flex items-center gap-1 ${filterMode === 'warnings' ? 'text-white/90 font-bold' : totalErrorsCount > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}`}>
                {filterMode === 'warnings' ? '✓ Filtered: showing warnings only' : totalErrorsCount > 0 ? `⚠️ Click to see all ${rowsWithWarningsCount} warning rows` : '✓ All rows valid'}
              </div>
            </button>

            {/* Database Matching / Ready Card (Clickable Filter) */}
            <button
              type="button"
              onClick={() => { setFilterMode('valid'); setCurrentPage(1); }}
              className={`text-left rounded-2xl p-5 border transition-all cursor-pointer ${filterMode === 'valid'
                ? 'bg-[#82A094] text-white border-[#82A094] shadow-md ring-2 ring-[#82A094]/20'
                : 'bg-white hover:bg-slate-50 border-slate-100 shadow-sm text-slate-800'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${filterMode === 'valid' ? 'text-white/80' : 'text-slate-400'}`}>Ready to Import</p>
                  <h3 className={`text-2xl font-bold ${filterMode === 'valid' ? 'text-white' : 'text-slate-700'}`}>
                    {rowsValidCount} / {parsedData.length} Valid
                  </h3>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${filterMode === 'valid' ? 'bg-white/20 text-white border-white/30' : 'bg-[#82A094]/10 text-[#82A094] border-[#82A094]/20'}`}>
                  <Check className="w-5 h-5" />
                </div>
              </div>
              <div className={`mt-2 text-[10px] font-medium flex items-center gap-1 ${filterMode === 'valid' ? 'text-white/90 font-bold' : 'text-slate-400'}`}>
                {filterMode === 'valid' ? '✓ Filtered: showing valid rows only' : 'Click to view ready rows'}
              </div>
            </button>
          </div>

          {/* Interactive corrections preview grid */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Parsed Agreement Records</h3>
                <p className="text-slate-400 text-xs">Verify matched IDs and resolve warnings directly below before submitting.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Filter Tabs */}
                <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'all'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    All ({parsedData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterMode('warnings'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === 'warnings'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : totalErrorsCount > 0
                          ? 'text-amber-700 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Warnings ({rowsWithWarningsCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterMode('valid'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === 'valid'
                        ? 'bg-[#82A094] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Valid ({rowsValidCount})</span>
                  </button>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-800">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Syncs 100% with Excel</span>
                </div>

                <button
                  onClick={() => {
                    setParsedData([]);
                    setCurrentPage(1);
                    setFilterMode('all');
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4 text-slate-400" />
                  Clear Import
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={loading || totalErrorsCount > 0}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg flex items-center gap-1.5 ${totalErrorsCount > 0
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-[#82A094] to-[#688579] hover:brightness-110 active:scale-[0.98]'
                    }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Import Contracts
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error banner if warnings exist */}
            {totalErrorsCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 rounded-xl text-xs flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  <span>
                    <strong>Data Warnings Found:</strong> {rowsWithWarningsCount} row{rowsWithWarningsCount !== 1 ? 's have' : ' has'} validation issues. Please assign customers or zones below before importing.
                  </span>
                </div>
                {filterMode !== 'warnings' ? (
                  <button
                    type="button"
                    onClick={() => { setFilterMode('warnings'); setCurrentPage(1); }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] self-start sm:self-auto transition-colors flex items-center gap-1 shadow-sm shrink-0"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    See All Warnings ({rowsWithWarningsCount})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
                    className="px-3 py-1 bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 rounded-lg font-bold text-[11px] self-start sm:self-auto transition-colors shadow-sm shrink-0"
                  >
                    Show All Records
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3 text-center">Row</th>
                    <th className="p-3">Customer Details</th>
                    <th className="p-3">Agreement</th>
                    <th className="p-3">Po Details</th>
                    <th className="p-3">Service Zone</th>
                    <th className="p-3">Validation status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        {filterMode === 'warnings' ? (
                          <div className="space-y-2 max-w-sm mx-auto">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                              <CheckCircle className="w-6 h-6" />
                            </div>
                            <p className="font-extrabold text-slate-700 text-sm">No warnings to display!</p>
                            <p className="text-xs text-slate-400">All agreements are valid and ready to be imported.</p>
                            <button
                              type="button"
                              onClick={() => { setFilterMode('all'); setCurrentPage(1); }}
                              className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                            >
                              Show All Records ({parsedData.length})
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs">No records found matching this view.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, relativeIndex) => {
                      const index = (currentPage - 1) * pageSize + relativeIndex;
                      const hasRowErrors = row.errors.length > 0;

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${hasRowErrors ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.05]' : 'hover:bg-slate-50/50'}`}
                        >
                          {/* Index */}
                          <td className="p-3 text-center font-bold text-slate-400">
                            {index + 1}
                          </td>

                          {/* Customer Match dropdown */}
                          <td className="p-3 max-w-[200px]">
                            <div className="space-y-1.5">
                              <div className="font-bold text-slate-700 text-xs truncate" title={row.customerName}>
                                {row.customerName}
                              </div>

                              {/* DB Customer Map Dropdown */}
                              <select
                                value={row.customerId || ''}
                                onChange={(e) => handleUpdateRowCustomer(row.id, Number(e.target.value))}
                                className={`w-full px-2 py-1 border rounded-lg text-[10px] bg-white focus:outline-none ${row.customerId
                                  ? 'border-slate-200 text-slate-600'
                                  : 'border-amber-500 text-amber-600 font-bold bg-amber-50/50'
                                  }`}
                              >
                                <option value="">-- Unresolved (Select Customer) --</option>
                                {customerOptions.map(opt => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {!row.customerId && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickCreateCustomer(row)}
                                  className="mt-1 text-[9px] font-extrabold text-[#CE9F6B] hover:text-[#b58557] flex items-center gap-0.5"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  Quick Create Customer
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Agreement details */}
                          <td className="p-3">
                            <div className="space-y-1 text-[11px] leading-tight">
                              <div>
                                <span className="font-bold text-slate-700">{row.mcType}</span>
                                <span className="text-slate-300 ml-1">•</span>
                                <span className="text-slate-500 ml-1">{row.noOfMachine} Machine(s)</span>
                              </div>
                              <div className="text-slate-400 text-[10px] flex items-center gap-1.5 flex-wrap">
                                <span>Visits: <strong className="text-slate-700">{row.noOfVisits} PMs</strong></span>
                                {row.pmSchedules && row.pmSchedules.length > 0 && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[9px] font-bold cursor-help ${
                                      row.pmSchedules.filter((p: any) => p.status === 'Completed').length > 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                    title={row.pmSchedules.map((p: any) => `PM ${p.pmNumber}: ${p.range || 'Scheduled'} [${p.status}]${p.completedAt ? ` (Done: ${p.completedAt})` : ''}`).join('\n')}
                                  >
                                    {row.pmSchedules.filter((p: any) => p.status === 'Completed').length}/{row.noOfVisits} Completed
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                Dates: <span className="text-slate-600 font-semibold">{row.startDate || '—'} TO {row.endDate || '—'}</span>
                              </div>
                              {(!row.startDate || !row.endDate) && (
                                <div className="flex flex-col gap-1 mt-1 p-1.5 bg-amber-50 rounded-lg border border-amber-200">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[9px] font-bold text-amber-700 uppercase">Set Dates:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateRowDates(row.id, '2026-04-01', '2027-03-31')}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-xs"
                                      title="Apply default financial year 2026-2027"
                                    >
                                      ⚡ Auto 2026–27
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="date"
                                      value={row.startDate || ''}
                                      onChange={(e) => handleUpdateRowDates(row.id, e.target.value, row.endDate)}
                                      className="px-1 py-0.5 border border-amber-300 rounded text-[10px] bg-white text-slate-700 focus:outline-none"
                                      title="Start Date"
                                    />
                                    <span className="text-[10px] text-amber-700 font-bold">to</span>
                                    <input
                                      type="date"
                                      value={row.endDate || ''}
                                      onChange={(e) => handleUpdateRowDates(row.id, row.startDate, e.target.value)}
                                      className="px-1 py-0.5 border border-amber-300 rounded text-[10px] bg-white text-slate-700 focus:outline-none"
                                      title="End Date"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* PO & Value details */}
                          <td className="p-3">
                            <div className="space-y-1 text-[11px] leading-tight">
                              <div className="font-bold text-slate-800">₹{Number(row.amount).toLocaleString('en-IN')}</div>
                              {(!row.amount || row.amount <= 0) && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[10px] text-slate-400">₹</span>
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={row.amount || ''}
                                    onChange={(e) => handleUpdateRowAmount(row.id, parseFloat(e.target.value) || 0)}
                                    className="w-24 px-1.5 py-0.5 border border-amber-300 rounded text-[10px] bg-amber-50/40 text-slate-800 focus:outline-none"
                                  />
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span>PO:</span>
                                <input
                                  type="text"
                                  placeholder="PO Number"
                                  value={row.poNo || ''}
                                  onChange={(e) => handleUpdateRowPo(row.id, e.target.value)}
                                  className={`w-28 px-1.5 py-0.5 border rounded font-mono text-[10px] focus:outline-none ${row.poNo === 'PO-AWAITED'
                                      ? 'border-amber-300 bg-amber-50 text-amber-800 font-bold'
                                      : 'border-slate-200 bg-white text-slate-700'
                                    }`}
                                  title={row.poNo === 'PO-AWAITED' ? 'PO is marked as Awaited/Pending. You can edit this anytime.' : 'PO Number'}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Engineer: <span className="text-slate-600 font-semibold">{row.responsible}</span>
                              </div>
                            </div>
                          </td>

                          {/* Zone match dropdown */}
                          <td className="p-3 max-w-[150px]">
                            <div className="space-y-1.5">
                              <div className="font-bold text-slate-600 text-xs">
                                {row.zoneName || 'No Zone'}
                              </div>

                              {/* DB Zone Map Dropdown */}
                              <select
                                value={row.zoneId || ''}
                                onChange={(e) => handleUpdateRowZone(row.id, Number(e.target.value))}
                                className={`w-full px-2 py-1 border rounded-lg text-[10px] bg-white focus:outline-none ${row.zoneId
                                  ? 'border-slate-200 text-slate-600'
                                  : 'border-amber-500 text-amber-600 font-bold bg-amber-50/50'
                                  }`}
                              >
                                <option value="">-- Select Zone --</option>
                                {dbZones.map(z => (
                                  <option key={z.id} value={z.id}>{z.name} Zone</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Warnings / Errors */}
                          <td className="p-3 max-w-[200px]">
                            {hasRowErrors ? (
                              <div className="space-y-1">
                                {row.errors.map((err, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 break-words w-full"
                                  >
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    <span>{err}</span>
                                  </span>
                                ))}
                              </div>
                            ) : !row.customerId ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#CE9F6B] bg-[#CE9F6B]/5 px-2 py-0.5 rounded border border-[#CE9F6B]/25">
                                <Sparkles className="w-3 h-3 animate-pulse" />
                                Auto-create Customer
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                <CheckCircle className="w-3 h-3" />
                                Ready to Import
                              </span>
                            )}
                          </td>

                          {/* Delete Row Action */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors active:scale-95"
                              title="Remove row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredData.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Showing</span>
                  <span className="font-bold text-slate-700">
                    {(currentPage - 1) * pageSize + 1}
                  </span>
                  <span>to</span>
                  <span className="font-bold text-slate-700">
                    {Math.min(currentPage * pageSize, filteredData.length)}
                  </span>
                  <span>of</span>
                  <span className="font-bold text-slate-700">{filteredData.length}</span>
                  <span>records {filterMode !== 'all' ? `(${filterMode === 'warnings' ? 'Warnings only' : 'Valid only'} • ${parsedData.length} total)` : ''}</span>

                  <div className="ml-4 flex items-center gap-1.5">
                    <span className="text-slate-400">Rows per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="px-3 py-1 font-semibold text-slate-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={loading || totalErrorsCount > 0}
                    className={`ml-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 ${totalErrorsCount > 0
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-[#82A094] to-[#688579] hover:brightness-110 active:scale-[0.98]'
                      }`}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Import Contracts ({parsedData.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Create Customer Modal — Portal attached to document.body */}
      {mounted && quickCreateModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-extrabold text-[#546A7A]">Quick Create Customer</h3>
              <p className="text-slate-400 text-xs mt-0.5">Register a new customer on-the-fly to link this contract.</p>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  required
                  value={qcCompanyName}
                  onChange={(e) => setQcCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address / Place</label>
                  <input
                    type="text"
                    value={qcAddress}
                    onChange={(e) => setQcAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zone</label>
                  <select
                    value={qcZoneId}
                    onChange={(e) => setQcZoneId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                  >
                    <option value="">-- Select Zone --</option>
                    {dbZones.map(z => (
                      <option key={z.id} value={z.id}>{z.name} Zone</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-[10px] font-extrabold text-[#CE9F6B] uppercase tracking-wider">Primary Contact (Required)</h4>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Person</label>
                  <input
                    type="text"
                    required
                    value={qcContactName}
                    onChange={(e) => setQcContactName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                    <input
                      type="text"
                      required
                      value={qcContactPhone}
                      onChange={(e) => setQcContactPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email (Optional)</label>
                    <input
                      type="email"
                      value={qcContactEmail}
                      onChange={(e) => setQcContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold text-[#546A7A]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 text-xs font-extrabold hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={qcCreating}
                  className="px-5 py-2 rounded-xl text-white text-xs font-extrabold bg-[#CE9F6B] hover:bg-[#b58557] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {qcCreating ? 'Creating...' : 'Create & Link'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Clean Import Confirmation Modal — Portal attached to document.body */}
      {mounted && confirmModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">
                Confirm Import & Sync
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                This will clear previous regular contracts and save <strong>only the {parsedData.length} contracts</strong> from this Excel file so your database matches Excel 100%.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 text-[11px] text-emerald-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Annual Contracts are 100% untouched</span>
              </div>
              <p className="text-emerald-700/80">
                Customer accounts and Sheet 2 (Annual Machine Contracts) will remain intact.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-500 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="px-5 py-2 rounded-xl text-white text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Yes, Sync & Import ({parsedData.length} contracts)</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
