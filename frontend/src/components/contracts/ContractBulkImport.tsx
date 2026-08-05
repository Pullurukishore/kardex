'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, ArrowLeft,
  Trash2, Sparkles, Download, Check, RefreshCw, AlertCircle, HelpCircle, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
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

  // State
  const [loading, setLoading] = useState(false);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [dbZones, setDbZones] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<ParsedContract[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Quick Create Customer Modal State
  const [quickCreateModalOpen, setQuickCreateModalOpen] = useState(false);
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
        setDbCustomers(cData);
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

  // Generate and download a sample Excel file
  const handleDownloadTemplate = () => {
    const headers = [
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
      'Responsible',
      'Zone',
      'Software Support',
      'BD'
    ];

    const sampleRows = [
      {
        'Customer Name': dbCustomers[0]?.companyName || 'Example Customer Ltd',
        'Place': 'Mumbai',
        'MC Type': 'Flex Care',
        'No of Machine': 2,
        'Amount': 150000,
        'No of Visits': 3,
        'Start ': '01/08/2026',
        'End': '31/07/2027',
        'PO No': 'PO-88271',
        'PO Date': '25/07/2026',
        'Responsible': dbUsers[0]?.name || 'Rahul',
        'Zone': dbZones[0]?.name || 'West',
        'Software Support': 'Yes',
        'BD': 'Unlimited'
      },
      {
        'Customer Name': dbCustomers[1]?.companyName || 'Second Customer Pvt',
        'Place': 'Chennai',
        'MC Type': 'Full Care',
        'No of Machine': 1,
        'Amount': 320000,
        'No of Visits': 4,
        'Start ': '15/08/2026',
        'End': '14/08/2027',
        'PO No': 'PO-99281',
        'PO Date': '10/08/2026',
        'Responsible': dbUsers[1]?.name || 'Sanjay',
        'Zone': dbZones[1]?.name || 'South',
        'Software Support': 'No',
        'BD': '2'
      }
    ];

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

  const parseCompletionDate = (val: any): string => {
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

    // Standardize common patterns (remove st, nd, rd, th)
    const cleanStr = str.replace(/(\d+)(st|nd|rd|th)/i, '$1');

    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return formatDateISO(d);
    }

    // Fallback: match DD/MM/YYYY or YYYY-MM-DD
    const partsDMY = cleanStr.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})$/);
    if (partsDMY) {
      const day = partsDMY[1].padStart(2, '0');
      const month = partsDMY[2].padStart(2, '0');
      let year = partsDMY[3];
      if (year.length === 2) {
        year = '20' + year; // assume 20xx
      }
      return `${year}-${month}-${day}`;
    }

    return '';
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
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }
    return dp[m][n];
  };

  const isFuzzyMatch = (dbName: string, excelName: string): boolean => {
    if (!dbName || !excelName) return false;

    const dName = dbName.trim().toLowerCase();
    const eName = excelName.trim().toLowerCase();

    if (dName === eName) return true;

    if (dName.includes('electro optical') && eName.includes('electro optics')) return true;

    const cDb = cleanName(dbName);
    const cEx = cleanName(excelName);
    if (cDb === cEx) return true;

    // Cleaned prefix match (first 10 chars)
    if (cDb.length >= 10 && cEx.length >= 10) {
      if (cDb.substring(0, 10) === cEx.substring(0, 10)) return true;
    }

    // Substring match with minimum length of 3
    if (cDb.length >= 3 && cEx.length >= 3) {
      if (cDb.includes(cEx) || cEx.includes(cDb)) return true;

      // Edit distance check for small typos
      const dist = getDistance(cDb, cEx);
      if (dist <= 2) return true;
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

  // Handle excel parsing
  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use 2D array header: 1 to support dynamic / merged columns reliably
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

        if (rows.length === 0) {
          toast.error('The uploaded Excel sheet contains no rows.');
          return;
        }

        // Find header row index
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(15, rows.length); i++) {
          const row = rows[i];
          if (row && row.some(cell => {
            const str = String(cell || '').toLowerCase();
            return str.includes('customer name') || str.includes('customer');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error('Could not find header row in the spreadsheet. Make sure you have a "Customer Name" column.');
          return;
        }

        const headers = rows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());

        // Find column indices
        const getColIndex = (aliases: string[]) => {
          return headers.findIndex(h => aliases.some(alias => h.includes(alias.toLowerCase())));
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

        const dataRows = rows.slice(headerRowIndex + 1);

        const parsedRows = dataRows.map((row, index) => {
          const rawCustName = custCol !== -1 && custCol < row.length ? String(row[custCol] || '').trim() : '';
          const rawZoneName = zoneCol !== -1 && zoneCol < row.length ? String(row[zoneCol] || '').trim() : '';
          const rawMcType = mcCol !== -1 && mcCol < row.length ? String(row[mcCol] || 'Flex Care').trim() : 'Flex Care';
          const rawSoftware = swCol !== -1 && swCol < row.length ? String(row[swCol] || '').trim().toLowerCase() : '';

          // Match database Customer
          const matchedCust = dbCustomers && Array.isArray(dbCustomers)
            ? dbCustomers.find(c => c?.companyName && isFuzzyMatch(c.companyName, rawCustName))
            : undefined;

          // Match database Zone
          const matchedZone = dbZones && Array.isArray(dbZones)
            ? dbZones.find(z => z?.name && String(z.name).toLowerCase() === rawZoneName.toLowerCase())
            : undefined;

          const startDateParsed = startCol !== -1 && startCol < row.length ? parseExcelDate(row[startCol]) : '';
          const endDateParsed = endCol !== -1 && endCol < row.length ? parseExcelDate(row[endCol]) : '';
          const poDateParsed = poDateCol !== -1 && poDateCol < row.length ? parseExcelDate(row[poDateCol]) : '';

          // Parse BD / bdCount
          const bdRaw = bdCol !== -1 && bdCol < row.length ? String(row[bdCol] || '').trim() : '';
          let parsedBdCount = 0;
          if (bdRaw.toLowerCase() === 'unlimited' || bdRaw.toLowerCase() === 'ul') {
            parsedBdCount = 999;
          } else {
            parsedBdCount = parseInt(bdRaw, 10) || 0;
          }

          // Parse PMs (Cycles 1 to 12)
          const pmSchedules: any[] = [];
          if (pm1Col !== -1) {
            // Cycles 1 to 10
            for (let p = 1; p <= 10; p++) {
              const rCol = pm1Col + (p - 1) * 2;
              const dCol = rCol + 1;
              const pRange = rCol < row.length ? String(row[rCol] || '').trim() : '';
              const pDateVal = dCol < row.length ? row[dCol] : null;
              const pDate = pDateVal ? parseCompletionDate(pDateVal) : null;
              if (pRange || pDate) {
                pmSchedules.push({
                  pmNumber: p,
                  range: pRange,
                  completedAt: pDate
                });
              }
            }
            // Cycles 11 and 12 (single columns in Dummy data.xlsx)
            const rCol11 = pm1Col + 20;
            const rCol12 = pm1Col + 21;
            if (rCol11 < row.length && row[rCol11]) {
              pmSchedules.push({
                pmNumber: 11,
                range: String(row[rCol11]).trim(),
                completedAt: null
              });
            }
            if (rCol12 < row.length && row[rCol12]) {
              pmSchedules.push({
                pmNumber: 12,
                range: String(row[rCol12]).trim(),
                completedAt: null
              });
            }
          }

          const contractItem: Partial<ParsedContract> = {
            id: `row-${index}-${Date.now()}`,
            customerName: rawCustName || 'Blank Customer',
            place: placeCol !== -1 && placeCol < row.length ? String(row[placeCol] || '').trim() : '',
            mcType: rawMcType,
            noOfMachine: machinesCol !== -1 && machinesCol < row.length ? Number(row[machinesCol] || 1) : 1,
            amount: (() => {
              const amtRaw = amountCol !== -1 && amountCol < row.length ? String(row[amountCol]).trim() : '';
              if (!amtRaw || amtRaw === '-') return 0;
              const cleanAmt = amtRaw.replace(/[^0-9.]/g, '');
              return parseFloat(cleanAmt) || 0;
            })(),
            noOfVisits: visitsCol !== -1 && visitsCol < row.length ? Number(row[visitsCol] || 3) : 3,
            startDate: startDateParsed,
            endDate: endDateParsed,
            poNo: poCol !== -1 && poCol < row.length ? String(row[poCol] || '').trim() : '',
            poDate: poDateParsed || startDateParsed,
            responsible: respCol !== -1 && respCol < row.length ? String(row[respCol] || 'Rahul').trim() : 'Rahul',
            zoneName: matchedZone?.name || rawZoneName || '',
            paymentTerms: '30 Days Net',
            softwareSupport: rawSoftware === 'yes' || rawSoftware === 'true' || rawSoftware === '1',
            bdCount: parsedBdCount,
            pmSchedules: pmSchedules,
            customerId: matchedCust?.id,
            zoneId: matchedZone?.id
          };

          contractItem.errors = validateContract(contractItem);
          return contractItem as ParsedContract;
        });

        // Filter out empty rows (e.g. rows where customer name is empty)
        const validParsedRows = parsedRows.filter(r => r.customerName && r.customerName !== 'Blank Customer');

        setParsedData(validParsedRows);
        toast.success(`Successfully parsed ${validParsedRows.length} contract agreements.`);
      } catch (err) {
        console.error('Failed parsing excel file:', err);
        toast.error('Failed to parse Excel file. Make sure headers are correct.');
      }
    };

    reader.readAsBinaryString(file);
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
      setDbCustomers(prev => [...prev, newCust]);
      
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
  const handleImportSubmit = async () => {
    const allErrors = parsedData.flatMap(r => r.errors);
    if (allErrors.length > 0) {
      toast.error(`Please correct all ${allErrors.length} validation errors before importing.`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.bulkImportContracts(parsedData);
      if (response.success) {
        toast.success(`Successfully imported ${response.count} contract agreements!`);
        router.push(`${getBaseRoute()}/contracts`);
      } else {
        toast.error(response.error || 'Failed importing agreements');
      }
    } catch (err: any) {
      console.error('Failed bulk importing:', err);
      toast.error(err.response?.data?.error || err.message || 'Server error importing contracts');
    } finally {
      setLoading(false);
    }
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Rows</p>
                <h3 className="text-2xl font-bold text-slate-700">{parsedData.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validation status</p>
                <h3 className={`text-2xl font-bold ${totalErrorsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {totalErrorsCount > 0 ? `${totalErrorsCount} Warnings` : 'All Valid'}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${totalErrorsCount > 0
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                {totalErrorsCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database matching</p>
                <h3 className="text-2xl font-bold text-slate-700">
                  {parsedData.filter(r => r.customerId).length} / {parsedData.length} Matched
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#82A094]/10 flex items-center justify-center text-[#82A094] border border-[#82A094]/20">
                <Check className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Interactive corrections preview grid */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Parsed Agreement Records</h3>
                <p className="text-slate-400 text-xs">Verify matched IDs and resolve warnings directly below before submitting.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setParsedData([])}
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
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 rounded-xl text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Data Warnings Found:</strong> Some rows could not match customers or zones to database values. Please select them manually from the dropdowns below to resolve them.
                </span>
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
                  {parsedData.map((row, index) => {
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
                              {dbCustomers.map(cust => {
                                const zName = cust.serviceZone?.name || dbZones.find((z: any) => Number(z.id) === Number(cust.serviceZoneId))?.name;
                                return (
                                  <option key={cust.id} value={cust.id}>
                                    {cust.companyName || cust.name}{zName ? ` (${zName} Zone)` : ''}
                                  </option>
                                );
                              })}
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
                            <div className="text-slate-400 text-[10px]">
                              Visits: <span className="font-bold text-slate-700">{row.noOfVisits} PMs</span>
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              Dates: <span className="text-slate-600 font-semibold">{row.startDate} TO {row.endDate}</span>
                            </div>
                          </div>
                        </td>

                        {/* PO & Value details */}
                        <td className="p-3">
                          <div className="space-y-1 text-[11px] leading-tight">
                            <div className="font-bold text-slate-800">₹{Number(row.amount).toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-slate-400">
                              PO: <span className="font-mono text-slate-600">{row.poNo || 'N/A'}</span>
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
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Quick Create Customer Modal */}
      {quickCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
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
        </div>
      )}
    </div>
  );
}
