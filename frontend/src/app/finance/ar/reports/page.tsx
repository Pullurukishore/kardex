'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { arApi, formatARCurrency, formatARDate, formatARMonth } from '@/lib/ar-api';
import * as XLSX from 'xlsx';
import {
  FileText, Wallet, Search, RefreshCw, Download, AlertTriangle, Clock,
  CheckCircle2, TrendingUp, IndianRupee, Shield, ShieldAlert, ShieldCheck,
  Layers, ArrowUpRight, ChevronDown, ChevronUp, Filter, X, Calendar, Eye,
  BarChart3, PieChart, Tag, Package, PackageCheck, Truck, Timer, Receipt,
  Users, CreditCard, Activity, ChevronLeft, ChevronRight
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// REPORT TAB TYPE
// ═══════════════════════════════════════════════════════════════════════════
type ReportTab = 'invoice' | 'milestone' | 'customer' | 'aging' | 'trends' | 'payments';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS  
// ═══════════════════════════════════════════════════════════════════════════
const getStatusStyle = (s: string) => {
  switch (s) {
    case 'PAID': return 'bg-gradient-to-r from-[#4F6A64] to-[#82A094] text-white';
    case 'PARTIAL': return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white';
    case 'OVERDUE': return 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white';
    case 'PENDING': return 'bg-gradient-to-r from-[#96AEC2] to-[#6F8A9D] text-white';
    default: return 'bg-gradient-to-r from-[#92A2A5] to-[#5D6E73] text-white';
  }
};

const getRiskStyle = (r: string) => {
  switch (r) {
    case 'CRITICAL': return 'bg-[#9E3B47] text-white';
    case 'HIGH': return 'bg-[#E17F70] text-white';
    case 'MEDIUM': return 'bg-[#CE9F6B] text-white';
    case 'LOW': return 'bg-[#82A094] text-white';
    default: return 'bg-[#AEBFC3] text-white';
  }
};

const getAgingStyle = (days: number) => {
  if (days <= 0) return 'text-[#82A094]';
  if (days <= 30) return 'text-[#CE9F6B]';
  if (days <= 60) return 'text-[#976E44]';
  if (days <= 90) return 'text-[#E17F70]';
  return 'text-[#9E3B47] font-bold';
};

// ═══════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════════════
function KpiCard({ icon: Icon, label, value, sub, gradient }: {
  icon: any; label: string; value: string; sub: string; gradient: string;
}) {
  return (
    <div className={`${gradient} rounded-2xl p-4 sm:p-5 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-[10px] text-white/60 font-bold mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBUTION BAR
// ═══════════════════════════════════════════════════════════════════════════
function DistBar({ label, count, amount, total, color }: {
  label: string; count: number; amount: number; total: number; color: string;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 group hover:bg-[#F8FAFB] rounded-lg p-1.5 -mx-1.5 transition-colors">
      <div className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
      <span className="text-xs font-semibold text-[#546A7A] w-20">{label}</span>
      <div className="flex-1 h-5 bg-[#F0F4F5] rounded-lg overflow-hidden">
        <div className={`h-full ${color} rounded-lg transition-all duration-700`}
          style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '30px' : '0' }} />
      </div>
      <div className="text-right w-24">
        <div className="text-[10px] font-bold text-[#546A7A]">{formatARCurrency(amount)}</div>
        <div className="text-[9px] text-[#92A2A5]">{count} items</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT HELPER — auto sizing columns
// ═══════════════════════════════════════════════════════════════════════════
const fmtDate = (v: any) => { if (!v) return ''; try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };

function exportExcel(data: any[], filename: string, columns: { key: string; label: string; fmt?: 'date' | 'amount' | 'pct' | 'payments' | 'terms' | 'remarks' }[]) {
  // Only use valid columns (skip spacers)
  const validCols = columns.filter(c => c.key !== '__spacer');

  // Build rows, splitting payments and terms into multiple downward rows per record
  const excelData: any[] = [];
  data.forEach(row => {
    let maxSubRows = 1;

    validCols.forEach(c => {
      let val = row[c.key];
      if ((c.fmt === 'payments' || c.fmt === 'remarks') && Array.isArray(val)) {
        maxSubRows = Math.max(maxSubRows, val.length);
      }
      else if (c.fmt === 'terms' && typeof val === 'string') {
        const termsArr = val.split(',').map(s => s.trim()).filter(Boolean);
        maxSubRows = Math.max(maxSubRows, termsArr.length);
      }
    });

    for (let i = 0; i < maxSubRows; i++) {
        const rowObj: any = {};
        validCols.forEach(c => {
            let val = row[c.key];
            
            if (c.fmt === 'payments') {
                if (Array.isArray(val) && val[i]) {
                    const p = val[i];
                    rowObj[c.label] = `${i + 1}. ${p.paymentMode || 'Unknown'} - Rs. ${Number(p.amount || 0).toLocaleString('en-IN')} on ${fmtDate(p.paymentDate)}`;
                } else {
                    rowObj[c.label] = '';
                }
            }
            else if (c.fmt === 'remarks') {
                if (Array.isArray(val) && val[i]) {
                    const r = val[i];
                    rowObj[c.label] = `• [${fmtDate(r.createdAt)}] ${r.createdBy?.name || 'System'}: ${r.content}`;
                } else {
                    rowObj[c.label] = '';
                }
            }
            else if (c.fmt === 'terms') {
                if (typeof val === 'string') {
                    const termsArr = val.split(',').map(s => s.trim()).filter(Boolean);
                    rowObj[c.label] = termsArr[i] ? `• ${termsArr[i]}` : '';
                } else {
                    rowObj[c.label] = '';
                }
            }
            else {
                // Show core data only on the first row of this record's group
                if (i === 0) {
                    if (val === null || val === undefined) val = '';
                    if (c.fmt === 'date') val = fmtDate(val);
                    else if (c.fmt === 'amount') val = Number(val) || 0;
                    else if (c.fmt === 'pct') val = `${Math.round(Number(val) || 0)}%`;
                    rowObj[c.label] = val;
                } else {
                    rowObj[c.label] = '';
                }
            }
        });
        excelData.push(rowObj);
    }
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Auto-size columns
  const colWidths = validCols.map(c => {
    // Header width
    let maxWidth = c.label.length;
    // Data width
    excelData.forEach(row => {
      const cellVal = row[c.label];
      if (cellVal !== null && cellVal !== undefined) {
        // Calculate max line length if there are newlines
        const maxLineLen = String(cellVal).split('\n').reduce((m, line) => Math.max(m, line.length), 0);
        if (maxLineLen > maxWidth) maxWidth = maxLineLen;
      }
    });
    // Upper bound cap at 100 characters so columns don't get ridiculously wide for long comments/terms
    return { wch: Math.min(maxWidth + 2, 100) }; 
  });
  ws['!cols'] = colWidths;

  // Enable text wrap for cells containing newlines
  const range = XLSX.utils.decode_range(ws['!ref'] || "A1");
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'string' && cell.v.includes('\n')) {
        if (!cell.s) cell.s = {};
        if (!cell.s.alignment) cell.s.alignment = {};
        cell.s.alignment.wrapText = true;
      }
    }
  }

  // Create workbook and export
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

const getAgingBadge = (days: number, bucket?: string) => {
  if (days <= 0) return { label: 'Current', cls: 'bg-[#82A094]/15 text-[#4F6A64] border-[#82A094]/30' };
  if (days <= 30) return { label: bucket || '1-30d', cls: 'bg-[#6F8A9D]/15 text-[#546A7A] border-[#6F8A9D]/30' };
  if (days <= 60) return { label: bucket || '31-60d', cls: 'bg-[#CE9F6B]/15 text-[#976E44] border-[#CE9F6B]/30' };
  if (days <= 90) return { label: bucket || '61-90d', cls: 'bg-[#E17F70]/15 text-[#9E3B47] border-[#E17F70]/30' };
  return { label: bucket || '90+d', cls: 'bg-[#9E3B47]/15 text-[#9E3B47] border-[#9E3B47]/30' };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function ARReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('invoice');
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [milestoneData, setMilestoneData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [agingData, setAgingData] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [acctFilter, setAcctFilter] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setPage(0);
      if (activeTab === 'invoice') {
        const res = await arApi.getInvoiceDetailReport();
        setInvoiceData(res);
      } else if (activeTab === 'milestone') {
        const res = await arApi.getMilestoneDetailReport();
        setMilestoneData(res);
      } else if (activeTab === 'customer') {
        const res = await arApi.getTopOutstandingCustomers();
        setCustomerData(res);
      } else if (activeTab === 'aging') {
        const res = await arApi.getAgingSummary();
        setAgingData(res);
      } else if (activeTab === 'trends') {
        const res = await arApi.getCollectionTrends({ months: 12 });
        setTrendsData(res);
      } else if (activeTab === 'payments') {
        const res = await arApi.getPaymentModeAnalysis();
        setPaymentsData(res);
      }
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setRiskFilter(''); setTypeFilter('');
    setAcctFilter(''); setFromDate(''); setToDate('');
  };
  const hasFilters = search || statusFilter || riskFilter || typeFilter || acctFilter || fromDate || toDate;

  // Filter & sort invoice data
  const filteredInvoices = useMemo(() => {
    if (!invoiceData?.data) return [];
    let d = [...invoiceData.data];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((i: any) => i.invoiceNumber?.toLowerCase().includes(s) || i.customerName?.toLowerCase().includes(s) || i.bpCode?.toLowerCase().includes(s) || i.poNo?.toLowerCase().includes(s));
    }
    if (statusFilter) d = d.filter((i: any) => i.status === statusFilter);
    if (riskFilter) d = d.filter((i: any) => i.riskClass === riskFilter);
    if (typeFilter) d = d.filter((i: any) => i.type === typeFilter);
    if (fromDate) d = d.filter((i: any) => i.invoiceDate && new Date(i.invoiceDate) >= new Date(fromDate));
    if (toDate) d = d.filter((i: any) => i.invoiceDate && new Date(i.invoiceDate) <= new Date(toDate));

    if (sortField) {
      d.sort((a: any, b: any) => {
        const av = a[sortField], bv = b[sortField];
        const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [invoiceData, search, statusFilter, riskFilter, typeFilter, fromDate, toDate, sortField, sortDir]);

  // Filter & sort milestone data
  const filteredMilestones = useMemo(() => {
    if (!milestoneData?.data) return [];
    let d = [...milestoneData.data];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((i: any) => i.invoiceNumber?.toLowerCase().includes(s) || i.customerName?.toLowerCase().includes(s) || i.soNo?.toLowerCase().includes(s) || i.poNo?.toLowerCase().includes(s));
    }
    if (statusFilter) d = d.filter((i: any) => i.status === statusFilter);
    if (typeFilter) d = d.filter((i: any) => i.type === typeFilter);
    if (acctFilter) d = d.filter((i: any) => i.accountingStatus === acctFilter);
    if (fromDate) d = d.filter((i: any) => i.invoiceDate && new Date(i.invoiceDate) >= new Date(fromDate));
    if (toDate) d = d.filter((i: any) => i.invoiceDate && new Date(i.invoiceDate) <= new Date(toDate));

    if (sortField) {
      d.sort((a: any, b: any) => {
        const av = a[sortField], bv = b[sortField];
        const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [milestoneData, search, statusFilter, typeFilter, acctFilter, fromDate, toDate, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };
  const SortIcon = ({ field }: { field: string }) => sortField === field
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
    : null;

  // Summary data
  const invSummary = invoiceData?.summary;
  const msSummary = milestoneData?.summary;

  const handleExport = () => {
    if (activeTab === 'invoice') {
      exportExcel(filteredInvoices, 'Invoice_Detail_Report', [
        // Identity
        { key: 'invoiceNumber', label: 'Invoice No' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'bpCode', label: 'BP Code' },
        { key: 'poNo', label: 'PO No' },
        { key: 'region', label: 'Region' },
        { key: 'type', label: 'Type' },
        { key: '__spacer', label: '' },
        // Dates
        { key: 'invoiceDate', label: 'Invoice Date', fmt: 'date' },
        { key: 'dueDate', label: 'Due Date', fmt: 'date' },
        { key: 'lastPaymentDate', label: 'Last Payment Date', fmt: 'date' },
        { key: '__spacer', label: '' },
        // Financial
        { key: 'totalAmount', label: 'Total Amount', fmt: 'amount' },
        { key: 'netAmount', label: 'Net Amount', fmt: 'amount' },
        { key: 'taxAmount', label: 'Tax Amount', fmt: 'amount' },
        { key: 'totalReceipts', label: 'Total Collected', fmt: 'amount' },
        { key: 'balance', label: 'Outstanding Balance', fmt: 'amount' },
        { key: 'collectionPercentage', label: 'Collection %', fmt: 'pct' },
        { key: '__spacer', label: '' },
        // Aging & Risk
        { key: 'daysOverdue', label: 'Days Overdue' },
        { key: 'agingBucket', label: 'Aging Bucket' },
        { key: 'status', label: 'Payment Status' },
        { key: 'riskClass', label: 'Risk Class' },
        { key: '__spacer', label: '' },
        // Details
        { key: 'actualPaymentTerms', label: 'Payment Terms', fmt: 'terms' },
        { key: 'deliveryStatus', label: 'Delivery Status' },
        { key: 'paymentCount', label: 'Payment Count' },
        { key: 'lastPaymentMode', label: 'Last Payment Mode' },
        { key: 'paymentHistory', label: 'Payment History', fmt: 'payments' },
        { key: 'remarks', label: 'Remarks', fmt: 'remarks' },
      ]);
    } else {
      exportExcel(filteredMilestones, 'Milestone_Detail_Report', [
        // Identity
        { key: 'soNo', label: 'SO No' },
        { key: 'invoiceNumber', label: 'Invoice No' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'bpCode', label: 'BP Code' },
        { key: 'poNo', label: 'PO No' },
        { key: 'region', label: 'Region' },
        { key: 'type', label: 'Type' },
        { key: 'bookingMonth', label: 'Booking Month' },
        { key: '__spacer', label: '' },
        // Dates
        { key: 'invoiceDate', label: 'Invoice Date', fmt: 'date' },
        { key: '__spacer', label: '' },
        // Financial
        { key: 'totalAmount', label: 'Total Amount', fmt: 'amount' },
        { key: 'netAmount', label: 'Net Amount', fmt: 'amount' },
        { key: 'taxAmount', label: 'Tax Amount', fmt: 'amount' },
        { key: 'totalReceipts', label: 'Total Collected', fmt: 'amount' },
        { key: 'balance', label: 'Outstanding Balance', fmt: 'amount' },
        { key: 'collectionPercentage', label: 'Collection %', fmt: 'pct' },
        { key: '__spacer', label: '' },
        // Status & Details
        { key: 'status', label: 'Payment Status' },
        { key: 'milestoneStatus', label: 'Milestone Status' },
        { key: 'accountingStatus', label: 'Accounting Status' },
        { key: 'riskClass', label: 'Risk Class' },
        { key: 'actualPaymentTerms', label: 'Payment Terms', fmt: 'terms' },
        { key: 'paymentCount', label: 'Payment Count' },
        { key: 'paymentHistory', label: 'Payment History', fmt: 'payments' },
        { key: 'remarks', label: 'Remarks', fmt: 'remarks' },
      ]);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 relative p-4 sm:p-0">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#546A7A]/8 to-[#6F8A9D]/8 rounded-full blur-[8rem]" />
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-5 sm:p-6 shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-16 w-40 h-40 border-4 border-white/50 rounded-full animate-pulse" />
          <div className="absolute -bottom-12 right-40 w-56 h-56 border-4 border-white/30 rounded-full" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 border border-white/20 shadow-2xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">AR Reports</h1>
              <p className="text-white/70 text-sm">Invoice & Milestone Detail Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(f => !f)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white text-sm font-bold hover:bg-white/25 transition-all">
              <Filter className="w-4 h-4" /> Filters {hasFilters && <span className="w-2 h-2 rounded-full bg-[#E17F70] animate-pulse" />}
            </button>
            <button onClick={handleExport} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white text-sm font-bold hover:bg-white/25 transition-all">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#546A7A] text-sm font-bold hover:shadow-xl transition-all active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ TAB SWITCHER ═══ */}
      <div className="flex gap-1.5 bg-white rounded-xl border-2 border-[#AEBFC3]/30 p-1.5 shadow-sm overflow-x-auto">
        {[
          { key: 'invoice' as ReportTab, label: 'Invoice Detail', icon: FileText, color: 'from-[#546A7A] to-[#6F8A9D]' },
          { key: 'milestone' as ReportTab, label: 'Milestone Detail', icon: Wallet, color: 'from-[#CE9F6B] to-[#976E44]' },
          { key: 'customer' as ReportTab, label: 'Customer Outstanding', icon: Users, color: 'from-[#4F6A64] to-[#82A094]' },
          { key: 'aging' as ReportTab, label: 'Aging Summary', icon: Timer, color: 'from-[#9E3B47] to-[#E17F70]' },
          { key: 'trends' as ReportTab, label: 'Collection Trends', icon: Activity, color: 'from-[#6F8A9D] to-[#96AEC2]' },
          { key: 'payments' as ReportTab, label: 'Payment Analysis', icon: CreditCard, color: 'from-[#5D6E73] to-[#3D4E53]' },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); clearFilters(); setSortField(''); }}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.key ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` : 'text-[#5D6E73] hover:bg-[#F8FAFB]'
            }`}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ FILTERS ═══ */}
      {showFilters && (
        <div className="relative bg-[#F8FAFB] rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-inner overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-2">
            {/* Search Bar - Takes full width on mobile, 4 cols on desktop */}
            <div className="col-span-1 md:col-span-4 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-xl opacity-0 group-hover:opacity-10 transition duration-300 blur" />
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-[#6F8A9D] pointer-events-none" />
                <input type="text" placeholder={activeTab === 'invoice' ? 'Search invoice, customer, PO...' : 'Search SO, customer, PO...'}
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-medium focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none transition-all shadow-sm" />
              </div>
            </div>

            {/* Date Range - Takes 4 cols on desktop */}
            <div className="col-span-1 md:col-span-4 flex items-center gap-2">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="w-4 h-4 text-[#92A2A5] group-hover:text-[#6F8A9D] transition-colors" />
                </div>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-medium focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none transition-all shadow-sm [color-scheme:light]" title="From Date" />
              </div>
              <span className="text-[#92A2A5] font-bold">—</span>
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="w-4 h-4 text-[#92A2A5] group-hover:text-[#6F8A9D] transition-colors" />
                </div>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-medium focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none transition-all shadow-sm [color-scheme:light]" title="To Date" />
              </div>
            </div>

            {/* Clear Button */}
            <div className="col-span-1 md:col-span-4 flex items-center justify-end">
              {hasFilters && (
                <button onClick={clearFilters} className="h-11 px-5 rounded-xl text-sm font-bold text-[#E17F70] border-2 border-[#E17F70]/30 bg-white hover:bg-[#E17F70] hover:text-white hover:border-[#E17F70] transition-all flex items-center gap-2 shadow-sm active:scale-95">
                  <X className="w-4 h-4" /> Clear All Filters
                </button>
              )}
            </div>
          </div>

          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#AEBFC3]/30 to-transparent my-4" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group min-w-[140px] flex-1">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                <option value="">Status: All</option>
                <option value="PENDING">Pending</option><option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option><option value="OVERDUE">Overdue</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
            </div>

            {activeTab === 'invoice' && (
              <div className="relative group min-w-[140px] flex-1">
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                  <option value="">Risk: All</option>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
              </div>
            )}

            <div className="relative group min-w-[140px] flex-1">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                <option value="">Type: All</option>
                <option value="LCS">LCS</option><option value="NB">NB</option><option value="FINANCE">Finance</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
            </div>

            {activeTab === 'milestone' && (
              <div className="relative group min-w-[150px] flex-1">
                <select value={acctFilter} onChange={e => setAcctFilter(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                  <option value="">Accounting: All</option>
                  <option value="REVENUE_RECOGNISED">Revenue Recognised</option>
                  <option value="BACKLOG">Backlog</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse"><div className="h-4 bg-[#AEBFC3]/20 rounded w-24 mb-3" /><div className="h-8 bg-[#AEBFC3]/30 rounded w-32" /></div>
          ))}</div>
          <div className="bg-white rounded-2xl border p-6 animate-pulse"><div className="h-64 bg-[#AEBFC3]/10 rounded-xl" /></div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* INVOICE DETAIL REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'invoice' && invSummary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={IndianRupee} label="Total Invoiced" value={formatARCurrency(invSummary.totalAmount)} sub={`${invSummary.totalInvoices} invoices`} gradient="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53]" />
            <KpiCard icon={CheckCircle2} label="Collected" value={formatARCurrency(invSummary.totalCollected)} sub={`${invSummary.collectionRate}% rate`} gradient="bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
            <KpiCard icon={Clock} label="Outstanding" value={formatARCurrency(invSummary.totalOutstanding)} sub={`${invSummary.pendingCount + invSummary.partialCount} pending`} gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
            <KpiCard icon={AlertTriangle} label="Overdue" value={formatARCurrency(invSummary.agingDistribution?.['90+']?.amount || 0)} sub={`${invSummary.overdueCount} past due`} gradient="bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" />
            <KpiCard icon={TrendingUp} label="Collection Rate" value={`${invSummary.collectionRate}%`} sub={`${invSummary.paidCount} fully paid`} gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
          </div>

          {/* Distribution Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Aging Distribution */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-3 flex items-center gap-2"><Timer className="w-4 h-4 text-[#6F8A9D]" /> Aging Distribution</h3>
              <div className="space-y-2">
                {[
                  { k: 'current', l: 'Current', c: 'bg-[#82A094]' }, { k: '1-30', l: '1-30 Days', c: 'bg-[#6F8A9D]' },
                  { k: '31-60', l: '31-60 Days', c: 'bg-[#CE9F6B]' }, { k: '61-90', l: '61-90 Days', c: 'bg-[#E17F70]' },
                  { k: '90+', l: '90+ Days', c: 'bg-[#9E3B47]' },
                ].map(b => (
                  <DistBar key={b.k} label={b.l} count={invSummary.agingDistribution[b.k]?.count || 0}
                    amount={invSummary.agingDistribution[b.k]?.amount || 0} total={invSummary.totalOutstanding} color={b.c} />
                ))}
              </div>
            </div>
            {/* Risk Distribution */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-[#6F8A9D]" /> Risk Distribution</h3>
              <div className="space-y-2">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(r => {
                  const colors: Record<string,string> = { LOW: 'bg-[#82A094]', MEDIUM: 'bg-[#CE9F6B]', HIGH: 'bg-[#E17F70]', CRITICAL: 'bg-[#9E3B47]' };
                  return <DistBar key={r} label={r} count={invSummary.riskDistribution[r]?.count || 0}
                    amount={invSummary.riskDistribution[r]?.amount || 0} total={invSummary.totalOutstanding} color={colors[r]} />;
                })}
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <div className="px-5 py-3.5 border-b-2 border-[#546A7A]/20 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3"><FileText className="w-4 h-4" /><span className="text-sm font-bold">Invoice Detail Records</span></div>
                <span className="text-xs font-medium opacity-80">{filteredInvoices.length} records</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8FAFB]">
                    {[
                      { f: 'invoiceNumber', l: 'Invoice' }, { f: 'customerName', l: 'Customer' },
                      { f: 'type', l: 'Type' },
                      { f: 'totalAmount', l: 'Total' }, { f: 'balance', l: 'Balance' },
                      { f: 'collectionPercentage', l: 'Collection' },
                      { f: 'daysOverdue', l: 'Aging' },
                      { f: 'status', l: 'Status' },
                    ].map(col => (
                      <th key={col.f} onClick={() => handleSort(col.f)}
                        className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] cursor-pointer hover:bg-[#AEBFC3]/10 transition-colors whitespace-nowrap">
                        {col.l}<SortIcon field={col.f} />
                      </th>
                    ))}
                    <th className="py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] text-center w-16">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr><td colSpan={9} className="py-16 text-center text-[#92A2A5] font-bold">No invoices found</td></tr>
                  ) : filteredInvoices.map((inv: any, idx: number) => {
                    const agBadge = getAgingBadge(inv.daysOverdue, inv.agingBucket);
                    return (
                    <tr key={inv.id}
                      className={`border-b border-[#AEBFC3]/15 hover:bg-[#546A7A]/5 transition-all ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'
                      } ${inv.status === 'OVERDUE' ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#546A7A] text-xs">{inv.invoiceNumber}</div>
                        {inv.poNo && <div className="text-[9px] text-[#976E44] font-bold">PO: {inv.poNo}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs font-semibold truncate max-w-[140px]">{inv.customerName}</div>
                        <div className="text-[9px] text-[#92A2A5]">{inv.bpCode} {inv.region ? `• ${inv.region}` : ''}</div>
                      </td>
                      <td className="py-2.5 px-3"><span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#82A094]/15 text-[#4F6A64] rounded border border-[#82A094]/20">{inv.type || '-'}</span></td>
                      <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right whitespace-nowrap">{formatARCurrency(inv.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-[#E17F70] text-right whitespace-nowrap">{formatARCurrency(inv.balance)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-[#F0F4F5] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${inv.collectionPercentage >= 100 ? 'bg-[#82A094]' : inv.collectionPercentage >= 50 ? 'bg-[#CE9F6B]' : 'bg-[#6F8A9D]'}`}
                              style={{ width: `${Math.min(100, inv.collectionPercentage)}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-[#546A7A] w-8">{Math.round(inv.collectionPercentage)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${agBadge.cls} whitespace-nowrap`}>
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : 'Current'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getStatusStyle(inv.status)}`}>{inv.status}</span></td>
                      <td className="py-2.5 px-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setViewRecord({ ...inv, _type: 'invoice' }); }}
                          className="p-1.5 rounded-lg bg-[#546A7A]/10 hover:bg-[#546A7A]/20 text-[#546A7A] hover:scale-110 transition-all" title="View Details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PREMIUM VIEW DETAIL POPUP */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {viewRecord && (() => {
        const r = viewRecord;
        const isInv = r._type === 'invoice';
        const agBdg = getAgingBadge(r.daysOverdue || r.maxOverdueDays || 0, r.agingBucket);
        const goUrl = isInv ? `/finance/ar/invoices/${encodeURIComponent(r.invoiceNumber)}` : `/finance/ar/milestones/${r.id}`;
        const DetailRow = ({ label, value, color, bold }: { label: string; value: any; color?: string; bold?: boolean }) => (
          <div className="flex items-center justify-between py-2.5 border-b border-[#AEBFC3]/10 last:border-0">
            <span className="text-[11px] text-[#92A2A5] font-bold uppercase tracking-wider">{label}</span>
            <span className={`text-sm ${bold ? 'font-bold' : 'font-semibold'} ${color || 'text-[#546A7A]'}`}>{value || '-'}</span>
          </div>
        );
        const SectionHead = ({ icon: SI, title, grad }: { icon: any; title: string; grad: string }) => (
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r ${grad} mb-3`}>
            <SI className="w-4 h-4 text-white" /><span className="text-xs font-black text-white uppercase tracking-widest">{title}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewRecord(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className={`h-2 bg-gradient-to-r ${isInv ? 'from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]' : 'from-[#CE9F6B] via-[#976E44] to-[#E17F70]'}`} />
              <div className="px-6 pt-5 pb-4 border-b-2 border-[#AEBFC3]/15">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br shadow-lg ${isInv ? 'from-[#546A7A] to-[#6F8A9D]' : 'from-[#CE9F6B] to-[#976E44]'}`}>
                      {isInv ? <FileText className="w-6 h-6 text-white" /> : <Wallet className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[#546A7A]">{r.invoiceNumber || r.soNo || 'N/A'}</h2>
                      <p className="text-xs text-[#92A2A5] font-bold mt-0.5">{r.customerName} • {r.bpCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${getStatusStyle(r.status)}`}>{r.status}</span>
                    <button onClick={() => setViewRecord(null)} className="p-2 rounded-xl bg-[#AEBFC3]/10 hover:bg-[#E17F70]/10 text-[#92A2A5] hover:text-[#9E3B47] transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-200px)] space-y-5">
                <div>
                  <SectionHead icon={FileText} title="Identity" grad={isInv ? 'from-[#546A7A] to-[#6F8A9D]' : 'from-[#CE9F6B] to-[#976E44]'} />
                  <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-0">
                    {isInv && <DetailRow label="Invoice No" value={r.invoiceNumber} bold />}
                    {!isInv && <DetailRow label="SO No" value={r.soNo} bold />}
                    {!isInv && <DetailRow label="Invoice No" value={r.invoiceNumber || 'Pending'} />}
                    <DetailRow label="Customer" value={r.customerName} bold />
                    <DetailRow label="BP Code" value={r.bpCode} />
                    <DetailRow label="PO No" value={r.poNo} />
                    <DetailRow label="Region" value={r.region} />
                    <DetailRow label="Type" value={r.type} />
                    {!isInv && <DetailRow label="Booking Month" value={formatARMonth(r.bookingMonth)} />}
                  </div>
                </div>
                <div>
                  <SectionHead icon={IndianRupee} title="Financial" grad="from-[#82A094] to-[#4F6A64]" />
                  <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-0">
                    <DetailRow label="Total Amount" value={formatARCurrency(r.totalAmount)} color="text-[#4F6A64]" bold />
                    <DetailRow label="Net Amount" value={formatARCurrency(r.netAmount)} />
                    <DetailRow label="Tax Amount" value={formatARCurrency(r.taxAmount)} color="text-[#976E44]" />
                    <DetailRow label="Total Collected" value={formatARCurrency(r.totalReceipts)} color="text-[#82A094]" bold />
                    <DetailRow label="Outstanding Balance" value={formatARCurrency(r.balance)} color="text-[#E17F70]" bold />
                    <div className="flex items-center justify-between py-2.5 border-b border-[#AEBFC3]/10">
                      <span className="text-[11px] text-[#92A2A5] font-bold uppercase tracking-wider">Collection %</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.collectionPercentage >= 100 ? 'bg-[#82A094]' : r.collectionPercentage >= 50 ? 'bg-[#CE9F6B]' : 'bg-[#6F8A9D]'}`}
                            style={{ width: `${Math.min(100, r.collectionPercentage)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-[#546A7A]">{Math.round(r.collectionPercentage)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <SectionHead icon={Calendar} title="Dates" grad="from-[#6F8A9D] to-[#96AEC2]" />
                  <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-0">
                    <DetailRow label="Invoice Date" value={formatARDate(r.invoiceDate)} />
                    {isInv && (
                      <>
                        <DetailRow label="Due Date" value={formatARDate(r.dueDate)} />
                        <DetailRow label="Last Payment" value={r.lastPaymentDate ? formatARDate(r.lastPaymentDate) : 'None'} />
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <SectionHead icon={AlertTriangle} title="Aging & Risk" grad="from-[#E17F70] to-[#9E3B47]" />
                  <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-0">
                    {isInv && (
                      <>
                        <DetailRow label="Days Overdue" value={r.daysOverdue > 0 ? `${r.daysOverdue} days` : 'Current'} color={r.daysOverdue > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'} bold />
                        <div className="flex items-center justify-between py-2.5 border-b border-[#AEBFC3]/10">
                          <span className="text-[11px] text-[#92A2A5] font-bold uppercase tracking-wider">Aging Bucket</span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${agBdg.cls}`}>{agBdg.label}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between py-2.5 border-b border-[#AEBFC3]/10">
                      <span className="text-[11px] text-[#92A2A5] font-bold uppercase tracking-wider">Risk Class</span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${getRiskStyle(r.riskClass)}`}>{r.riskClass || '-'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <SectionHead icon={Layers} title={isInv ? 'Payment Details' : 'Milestone Details'} grad="from-[#5D6E73] to-[#3D4E53]" />
                  <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-0">
                    <DetailRow label="Payment Count" value={r.paymentCount || 0} />
                    {isInv ? (
                      <>
                        <DetailRow label="Payment Terms" value={r.actualPaymentTerms} />
                        <DetailRow label="Delivery Status" value={r.deliveryStatus} />
                        <DetailRow label="Last Payment Mode" value={r.lastPaymentMode} />
                      </>
                    ) : (
                      <>
                        <DetailRow label="Payment Terms" value={r.actualPaymentTerms} />
                        <DetailRow label="Milestone Status" value={r.milestoneStatus?.replace(/_/g, ' ')} />
                        <div className="flex items-center justify-between py-2.5 border-b border-[#AEBFC3]/10">
                          <span className="text-[11px] text-[#92A2A5] font-bold uppercase tracking-wider">Accounting</span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                            r.accountingStatus === 'REVENUE_RECOGNISED' ? 'bg-[#82A094]/15 text-[#4F6A64] border border-[#82A094]/20' :
                            r.accountingStatus === 'BACKLOG' ? 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/20' :
                            'bg-[#AEBFC3]/15 text-[#5D6E73]'
                          }`}>{r.accountingStatus?.replace(/_/g, ' ') || '-'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Payment History Section */}
                {r.paymentHistory && r.paymentHistory.length > 0 && (
                  <div>
                    <SectionHead icon={Receipt} title="Payment History" grad="from-[#82A094] to-[#4F6A64]" />
                    <div className="bg-[#F8FAFB] rounded-xl p-4 border border-[#AEBFC3]/20 space-y-3">
                      {r.paymentHistory.map((pmt: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#AEBFC3]/20 shadow-sm hover:border-[#82A094]/30 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center text-white font-bold shadow-md shrink-0 text-xs">
                            {idx + 1}
                          </div>
                          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                            <div>
                              <p className="text-[9px] text-[#92A2A5] uppercase font-bold">Date</p>
                              <p className="font-semibold text-[#546A7A] text-xs">{formatARDate(pmt.paymentDate)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-[#92A2A5] uppercase font-bold">Mode</p>
                              <div className="font-semibold text-[#546A7A] text-xs">
                                {pmt.paymentMode || '-'}
                                {pmt.referenceBank && <span className="ml-1 text-[9px] bg-[#6F8A9D]/10 text-[#6F8A9D] px-1 py-0.5 rounded">@{pmt.referenceBank}</span>}
                              </div>
                            </div>
                            <div className="col-span-2 text-right">
                              <p className="text-[9px] text-[#92A2A5] uppercase font-bold">Amount</p>
                              <p className="font-bold text-[#4F6A64] text-sm">{formatARCurrency(pmt.amount)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Remarks Section */}
                {r.remarks && r.remarks.length > 0 && (
                  <div>
                    <SectionHead icon={FileText} title="Remarks" grad="from-[#CE9F6B] to-[#976E44]" />
                    <div className="bg-[#F8FAFB] rounded-xl p-4 border border-[#AEBFC3]/20 space-y-3">
                      {r.remarks.map((rmk: any, idx: number) => (
                        <div key={idx} className="flex gap-3 p-3 rounded-xl bg-white border border-[#AEBFC3]/20 shadow-sm hover:border-[#82A094]/30 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center text-white font-bold shadow-md shrink-0 text-xs">
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-[#546A7A] text-xs">{rmk.createdBy?.name || 'System'}</p>
                              <p className="text-[9px] text-[#92A2A5] font-bold">{formatARDate(rmk.createdAt)}</p>
                            </div>
                            <p className="text-sm text-[#5D6E73] whitespace-pre-wrap">{rmk.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t-2 border-[#AEBFC3]/15 bg-[#F8FAFB] flex items-center justify-between">
                <button onClick={() => setViewRecord(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#92A2A5] hover:bg-[#AEBFC3]/15 transition-all">Close</button>
                <button onClick={() => { setViewRecord(null); window.location.href = goUrl; }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all bg-gradient-to-r ${isInv ? 'from-[#546A7A] to-[#6F8A9D]' : 'from-[#CE9F6B] to-[#976E44]'}`}>
                  <ArrowUpRight className="w-4 h-4" /> Open Full Detail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MILESTONE DETAIL REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'milestone' && msSummary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={IndianRupee} label="Total Value" value={formatARCurrency(msSummary.totalAmount)} sub={`${msSummary.totalMilestones} milestones`} gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
            <KpiCard icon={CheckCircle2} label="Collected" value={formatARCurrency(msSummary.totalCollected)} sub={`${msSummary.collectionRate}% rate`} gradient="bg-gradient-to-br from-[#A2B9AF] to-[#82A094]" />
            <KpiCard icon={Clock} label="Outstanding" value={formatARCurrency(msSummary.totalOutstanding)} sub="Balance receivable" gradient="bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]" />
            <KpiCard icon={AlertTriangle} label="Overdue Stages" value={String(msSummary.overdueTerms)} sub={`of ${msSummary.totalTerms} total stages`} gradient="bg-gradient-to-br from-[#9E3B47] to-[#75242D]" />
            <KpiCard icon={PackageCheck} label="Completed Stages" value={String(msSummary.completedTerms)} sub={`${msSummary.totalTerms > 0 ? Math.round((msSummary.completedTerms / msSummary.totalTerms) * 100) : 0}% done`} gradient="bg-gradient-to-br from-[#4F6A64] to-[#82A094]" />
          </div>

          {/* Distribution Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Payment Status */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-[#6F8A9D]" /> Payment Status</h3>
              <div className="space-y-2">
                {[
                  { k: 'paid', l: 'Paid', c: 'bg-[#82A094]' }, { k: 'partial', l: 'Partial', c: 'bg-[#CE9F6B]' },
                  { k: 'pending', l: 'Pending', c: 'bg-[#96AEC2]' }, { k: 'overdue', l: 'Overdue', c: 'bg-[#E17F70]' },
                ].map(s => (
                  <div key={s.k} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.c}`} />
                    <span className="text-xs font-semibold text-[#546A7A] w-16">{s.l}</span>
                    <div className="flex-1 h-4 bg-[#F0F4F5] rounded-lg overflow-hidden">
                      <div className={`h-full ${s.c} rounded-lg`} style={{ width: `${msSummary.totalMilestones > 0 ? ((msSummary.statusBreakdown[s.k] || 0) / msSummary.totalMilestones) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[#546A7A] w-8 text-right">{msSummary.statusBreakdown[s.k] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Accounting Status */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#82A094]" /> Accounting Status</h3>
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#82A094]/10 border border-[#82A094]/20">
                  <span className="text-xs font-bold text-[#4F6A64]">Revenue Recognised</span>
                  <span className="text-lg font-bold text-[#4F6A64]">{msSummary.accountingBreakdown.revenueRecognised}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#E17F70]/10 border border-[#E17F70]/20">
                  <span className="text-xs font-bold text-[#9E3B47]">Backlog</span>
                  <span className="text-lg font-bold text-[#9E3B47]">{msSummary.accountingBreakdown.backlog}</span>
                </div>
              </div>
            </div>
            {/* Type Breakdown */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-[#CE9F6B]" /> By Type</h3>
              <div className="space-y-2">
                {Object.entries(msSummary.typeBreakdown || {}).map(([type, data]: [string, any]) => (
                  <div key={type} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/20 hover:border-[#6F8A9D]/30 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-[#546A7A]">{type}</span>
                      <div className="text-[9px] text-[#92A2A5]">{data.count} items</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#4F6A64]">{formatARCurrency(data.amount)}</div>
                      <div className="text-[9px] text-[#E17F70] font-bold">OS: {formatARCurrency(data.outstanding)}</div>
                    </div>
                  </div>
                ))}
                {Object.keys(msSummary.typeBreakdown || {}).length === 0 && <p className="text-xs text-[#92A2A5] text-center py-4">No type data</p>}
              </div>
            </div>
          </div>

          {/* Milestone Table */}
          <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#CE9F6B] via-[#976E44] to-[#E17F70]" />
            <div className="px-5 py-3.5 border-b-2 border-[#976E44]/20 bg-gradient-to-r from-[#CE9F6B] to-[#976E44]">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3"><Wallet className="w-4 h-4" /><span className="text-sm font-bold">Milestone Detail Records</span></div>
                <span className="text-xs font-medium opacity-80">{filteredMilestones.length} records</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#F8FAFB]">
                    {[
                      { f: 'soNo', l: 'SO / Invoice' }, { f: 'customerName', l: 'Customer' },
                      { f: 'type', l: 'Type' },
                      { f: 'totalAmount', l: 'Total' }, { f: 'balance', l: 'Balance' },
                      { f: 'collectionPercentage', l: 'Collection' },
                      { f: 'termCount', l: 'Stages' }, { f: 'maxOverdueDays', l: 'Aging' },
                      { f: 'status', l: 'Status' },
                    ].map(col => (
                      <th key={col.f} onClick={() => handleSort(col.f)}
                        className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] cursor-pointer hover:bg-[#AEBFC3]/10 transition-colors whitespace-nowrap">
                        {col.l}<SortIcon field={col.f} />
                      </th>
                    ))}
                    <th className="py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] text-center w-16">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMilestones.length === 0 ? (
                    <tr><td colSpan={10} className="py-16 text-center text-[#92A2A5] font-bold">No milestones found</td></tr>
                  ) : filteredMilestones.map((ms: any, idx: number) => {
                    const msAgBadge = getAgingBadge(ms.maxOverdueDays);
                    return (
                    <tr key={ms.id}
                      className={`border-b border-[#AEBFC3]/15 hover:bg-[#CE9F6B]/5 transition-all ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'
                      } ${ms.overdueTerms > 0 ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#546A7A] text-xs">{ms.soNo || 'N/A'}</div>
                        <div className="text-[9px] text-[#92A2A5]">{ms.invoiceNumber || 'Pending'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs font-semibold truncate max-w-[140px]">{ms.customerName}</div>
                        <div className="text-[9px] text-[#92A2A5]">{ms.bpCode} {ms.region ? `• ${ms.region}` : ''}</div>
                      </td>
                      <td className="py-2.5 px-3"><span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#82A094]/15 text-[#4F6A64] rounded border border-[#82A094]/20">{ms.type || '-'}</span></td>
                      <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right whitespace-nowrap">{formatARCurrency(ms.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-xs font-bold text-[#E17F70] text-right whitespace-nowrap">{formatARCurrency(ms.balance)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-1.5 bg-[#F0F4F5] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${ms.collectionPercentage >= 100 ? 'bg-[#82A094]' : ms.collectionPercentage >= 50 ? 'bg-[#CE9F6B]' : 'bg-[#6F8A9D]'}`}
                              style={{ width: `${Math.min(100, ms.collectionPercentage)}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-[#546A7A] w-8">{Math.round(ms.collectionPercentage)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[9px] font-bold text-[#82A094]">{ms.completedTerms}</span>
                          <span className="text-[9px] text-[#AEBFC3]">/</span>
                          <span className="text-[9px] font-bold text-[#546A7A]">{ms.termCount}</span>
                          {ms.overdueTerms > 0 && <span className="text-[9px] font-bold text-[#E17F70] ml-1">({ms.overdueTerms}⚠)</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ms.maxOverdueDays > 0 ? (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${msAgBadge.cls} whitespace-nowrap`}>{ms.maxOverdueDays}d</span>
                        ) : <span className="text-[10px] text-[#82A094]">✓</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getStatusStyle(ms.status)}`}>{ms.status}</span></td>
                      <td className="py-2.5 px-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setViewRecord({ ...ms, _type: 'milestone' }); }}
                          className="p-1.5 rounded-lg bg-[#CE9F6B]/10 hover:bg-[#CE9F6B]/20 text-[#976E44] hover:scale-110 transition-all" title="View Details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CUSTOMER OUTSTANDING REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'customer' && customerData?.summary && (() => {
        const cs = customerData.summary;
        const custs = customerData.customers || [];
        const paged = custs.slice(page * pageSize, (page + 1) * pageSize);
        const totalPages = Math.ceil(custs.length / pageSize);
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={Users} label="Total Customers" value={String(cs.totalCustomers)} sub={`${cs.customersWithOverdue} with overdue`} gradient="bg-gradient-to-br from-[#4F6A64] to-[#82A094]" />
              <KpiCard icon={IndianRupee} label="Total Outstanding" value={formatARCurrency(cs.totalOutstanding)} sub={`${cs.collectionRate}% collected`} gradient="bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" />
              <KpiCard icon={TrendingUp} label="Total Invoiced" value={formatARCurrency(cs.totalInvoiced)} sub={formatARCurrency(cs.totalCollected) + ' collected'} gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
              <KpiCard icon={AlertTriangle} label="Top 5 Concentration" value={`${cs.top5Concentration}%`} sub="of total outstanding" gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
            </div>

            <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
              <div className="px-5 py-3.5 border-b-2 border-[#4F6A64]/20 bg-gradient-to-r from-[#4F6A64] to-[#82A094]">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3"><Users className="w-4 h-4" /><span className="text-sm font-bold">Customer Outstanding</span></div>
                  <span className="text-xs font-medium opacity-80">{custs.length} customers</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#F8FAFB]">
                      {['Customer', 'BP Code', 'Region', 'Invoices', 'Total Invoiced', 'Collected', 'Outstanding', 'Collection %', 'Max Overdue', 'Risk'].map(h => (
                        <th key={h} className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr><td colSpan={10} className="py-16 text-center text-[#92A2A5] font-bold">No customers found</td></tr>
                    ) : paged.map((c: any, idx: number) => (
                      <tr key={c.bpCode || idx} className={`border-b border-[#AEBFC3]/15 hover:bg-[#4F6A64]/5 transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} ${c.overdueCount > 0 ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}>
                        <td className="py-2.5 px-3 text-xs font-semibold truncate max-w-[160px]">{c.customerName}</td>
                        <td className="py-2.5 px-3 text-xs text-[#546A7A] font-bold">{c.bpCode}</td>
                        <td className="py-2.5 px-3 text-xs text-[#92A2A5]">{c.region || '-'}</td>
                        <td className="py-2.5 px-3 text-xs text-center font-bold">{c.invoiceCount}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right whitespace-nowrap">{formatARCurrency(c.totalInvoiced)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#82A094] text-right whitespace-nowrap">{formatARCurrency(c.totalCollected)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#E17F70] text-right whitespace-nowrap">{formatARCurrency(c.outstanding)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-[#F0F4F5] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.collectionRate >= 100 ? 'bg-[#82A094]' : c.collectionRate >= 50 ? 'bg-[#CE9F6B]' : 'bg-[#6F8A9D]'}`}
                                style={{ width: `${Math.min(100, c.collectionRate)}%` }} />
                            </div>
                            <span className="text-[9px] font-bold text-[#546A7A] w-8">{Math.round(c.collectionRate)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.maxDaysOverdue > 0 ? (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${getAgingBadge(c.maxDaysOverdue).cls}`}>{c.maxDaysOverdue}d</span>
                          ) : <span className="text-[10px] text-[#82A094]">✓</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getRiskStyle(c.riskClass)}`}>{c.riskClass}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t-2 border-[#AEBFC3]/15 flex items-center justify-between">
                  <span className="text-xs text-[#92A2A5]">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-[#F8FAFB] border text-[#546A7A] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-[#F8FAFB] border text-[#546A7A] disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGING SUMMARY REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'aging' && agingData?.summary && (() => {
        const as2 = agingData.summary;
        const bkts = agingData.buckets || {};
        const bucketKeys = ['current', '1-30', '31-60', '61-90', '90+'];
        const bucketLabels: Record<string, string> = { current: 'Current', '1-30': '1-30 Days', '31-60': '31-60 Days', '61-90': '61-90 Days', '90+': '90+ Days' };
        const bucketColors: Record<string, string> = { current: 'from-[#82A094] to-[#4F6A64]', '1-30': 'from-[#6F8A9D] to-[#546A7A]', '31-60': 'from-[#CE9F6B] to-[#976E44]', '61-90': 'from-[#E17F70] to-[#9E3B47]', '90+': 'from-[#9E3B47] to-[#75242D]' };
        const barColors: Record<string, string> = { current: 'bg-[#82A094]', '1-30': 'bg-[#6F8A9D]', '31-60': 'bg-[#CE9F6B]', '61-90': 'bg-[#E17F70]', '90+': 'bg-[#9E3B47]' };
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={IndianRupee} label="Total Outstanding" value={formatARCurrency(as2.totalOutstanding)} sub={`${as2.totalInvoices} invoices`} gradient="bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" />
              <KpiCard icon={CheckCircle2} label="Total Collected" value={formatARCurrency(as2.totalCollected)} sub={`${as2.collectionRate}% rate`} gradient="bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
              <KpiCard icon={Clock} label="Weighted Avg Days" value={`${as2.weightedAvgDays}d`} sub="overdue weighted by amount" gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
              <KpiCard icon={TrendingUp} label="Total Invoiced" value={formatARCurrency(as2.totalInvoiced)} sub="all regular invoices" gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
            </div>

            {/* Aging Bucket Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {bucketKeys.map(k => {
                const b = bkts[k] || { count: 0, amount: 0 };
                const pct = as2.totalOutstanding > 0 ? Math.round((b.amount / as2.totalOutstanding) * 100) : 0;
                return (
                  <div key={k} className={`bg-gradient-to-br ${bucketColors[k]} rounded-2xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{bucketLabels[k]}</div>
                    <div className="text-lg font-bold mt-1">{formatARCurrency(b.amount)}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] opacity-60">{b.count} invoices</span>
                      <span className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aging Bar Chart + Region Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
                <h3 className="font-bold text-[#546A7A] text-sm mb-4 flex items-center gap-2"><Timer className="w-4 h-4 text-[#6F8A9D]" /> Aging Distribution</h3>
                <div className="space-y-3">
                  {bucketKeys.map(k => {
                    const b = bkts[k] || { count: 0, amount: 0 };
                    const pct = as2.totalOutstanding > 0 ? (b.amount / as2.totalOutstanding) * 100 : 0;
                    return (
                      <div key={k} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#546A7A]">{bucketLabels[k]}</span>
                          <span className="text-xs font-bold text-[#546A7A]">{formatARCurrency(b.amount)}</span>
                        </div>
                        <div className="h-6 bg-[#F0F4F5] rounded-lg overflow-hidden">
                          <div className={`h-full ${barColors[k]} rounded-lg transition-all duration-700 flex items-center justify-end pr-2`}
                            style={{ width: `${Math.max(pct, 0)}%`, minWidth: pct > 0 ? '40px' : '0' }}>
                            {pct > 5 && <span className="text-[9px] font-bold text-white">{Math.round(pct)}%</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
                <h3 className="font-bold text-[#546A7A] text-sm mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-[#CE9F6B]" /> By Region</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(agingData.byRegion || []).map((r: any, idx: number) => (
                    <div key={r.region} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/20 hover:border-[#6F8A9D]/30 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-[#546A7A]">{r.region}</div>
                        <div className="text-[9px] text-[#92A2A5]">{r.count} invoices</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#E17F70]">{formatARCurrency(r.outstanding)}</div>
                        <div className="text-[9px] text-[#92A2A5]">of {formatARCurrency(r.amount)}</div>
                      </div>
                    </div>
                  ))}
                  {(agingData.byRegion || []).length === 0 && <p className="text-xs text-[#92A2A5] text-center py-4">No region data</p>}
                </div>
              </div>
            </div>

            {/* Drill-down Table: Top Outstanding Invoices */}
            <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#CE9F6B]" />
              <div className="px-5 py-3.5 border-b-2 border-[#9E3B47]/20 bg-gradient-to-r from-[#9E3B47] to-[#E17F70]">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-bold">Top Outstanding Invoices (90+ Days)</span></div>
                  <span className="text-xs font-medium opacity-80">{(bkts['90+']?.invoices || []).length} records</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-[#F8FAFB]">
                    {['Invoice', 'Customer', 'Type', 'Total', 'Outstanding', 'Days Overdue', 'Risk'].map(h => (
                      <th key={h} className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(bkts['90+']?.invoices || []).slice(0, 20).map((inv: any, idx: number) => (
                      <tr key={idx} className={`border-b border-[#AEBFC3]/15 hover:bg-[#9E3B47]/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} border-l-4 border-l-[#9E3B47]`}>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#546A7A]">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold truncate max-w-[140px]">{inv.customerName}</td>
                        <td className="py-2.5 px-3"><span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#82A094]/15 text-[#4F6A64] rounded border border-[#82A094]/20">{inv.type || '-'}</span></td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right">{formatARCurrency(inv.totalAmount)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#E17F70] text-right">{formatARCurrency(inv.balance)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#9E3B47] text-center">{inv.daysOverdue}d</td>
                        <td className="py-2.5 px-3 text-center"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getRiskStyle(inv.riskClass)}`}>{inv.riskClass}</span></td>
                      </tr>
                    ))}
                    {(bkts['90+']?.invoices || []).length === 0 && <tr><td colSpan={7} className="py-10 text-center text-[#82A094] font-bold text-sm">No 90+ day overdue invoices 🎉</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* COLLECTION TRENDS REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'trends' && trendsData?.summary && (() => {
        const ts = trendsData.summary;
        const trends = trendsData.trends || [];
        const maxVal = Math.max(...trends.map((t: any) => Math.max(t.invoiced, t.collected)), 1);
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={IndianRupee} label="Total Invoiced" value={formatARCurrency(ts.totalInvoiced)} sub={`${ts.totalInvoices} invoices`} gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
              <KpiCard icon={CheckCircle2} label="Total Collected" value={formatARCurrency(ts.totalCollected)} sub={`${ts.totalPayments} payments`} gradient="bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
              <KpiCard icon={TrendingUp} label="Collection Efficiency" value={`${ts.overallEfficiency}%`} sub="overall rate" gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
              <KpiCard icon={IndianRupee} label="Avg Monthly Collection" value={formatARCurrency(ts.avgMonthlyCollection)} sub="per month average" gradient="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53]" />
            </div>

            {/* Monthly Bar Chart */}
            <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
              <h3 className="font-bold text-[#546A7A] text-sm mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#6F8A9D]" /> Monthly Invoiced vs Collected</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#6F8A9D]" /><span className="text-[10px] font-bold text-[#546A7A]">Invoiced</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#82A094]" /><span className="text-[10px] font-bold text-[#546A7A]">Collected</span></div>
              </div>
              <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
                {trends.map((t: any) => {
                  const invH = (t.invoiced / maxVal) * 100;
                  const colH = (t.collected / maxVal) * 100;
                  const label = t.month.split('-')[1] + '/' + t.month.split('-')[0].slice(2);
                  return (
                    <div key={t.month} className="flex flex-col items-center gap-1 flex-shrink-0 group" style={{ minWidth: '48px' }}>
                      <div className="flex items-end gap-0.5 h-36">
                        <div className="w-4 bg-[#6F8A9D] rounded-t transition-all hover:bg-[#546A7A]" style={{ height: `${Math.max(invH, 2)}%` }} title={`Invoiced: ${formatARCurrency(t.invoiced)}`} />
                        <div className="w-4 bg-[#82A094] rounded-t transition-all hover:bg-[#4F6A64]" style={{ height: `${Math.max(colH, 2)}%` }} title={`Collected: ${formatARCurrency(t.collected)}`} />
                      </div>
                      <span className="text-[8px] font-bold text-[#92A2A5]">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Detail Table */}
            <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#6F8A9D] via-[#82A094] to-[#96AEC2]" />
              <div className="px-5 py-3.5 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#6F8A9D] to-[#96AEC2]">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3"><Activity className="w-4 h-4" /><span className="text-sm font-bold">Monthly Breakdown</span></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-[#F8FAFB]">
                    {['Month', 'Invoiced', 'Invoices', 'Collected', 'Payments', 'Efficiency', 'Net Cashflow'].map(h => (
                      <th key={h} className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {trends.map((t: any, idx: number) => (
                      <tr key={t.month} className={`border-b border-[#AEBFC3]/15 hover:bg-[#6F8A9D]/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'}`}>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#546A7A]">{formatARMonth(t.month)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#546A7A] text-right">{formatARCurrency(t.invoiced)}</td>
                        <td className="py-2.5 px-3 text-xs text-center">{t.invoiceCount}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#82A094] text-right">{formatARCurrency(t.collected)}</td>
                        <td className="py-2.5 px-3 text-xs text-center">{t.paymentCount}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.collectionEfficiency >= 100 ? 'bg-[#82A094]/15 text-[#4F6A64]' : t.collectionEfficiency >= 50 ? 'bg-[#CE9F6B]/15 text-[#976E44]' : 'bg-[#E17F70]/15 text-[#9E3B47]'}`}>
                            {t.collectionEfficiency}%
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 text-xs font-bold text-right ${t.netCashflow >= 0 ? 'text-[#82A094]' : 'text-[#E17F70]'}`}>{formatARCurrency(t.netCashflow)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PAYMENT MODE ANALYSIS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'payments' && paymentsData?.summary && (() => {
        const ps = paymentsData.summary;
        const modes = paymentsData.modes || [];
        const banks = paymentsData.banks || [];
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={CreditCard} label="Total Payments" value={String(ps.totalPayments)} sub={`${ps.uniqueModes} payment modes`} gradient="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53]" />
              <KpiCard icon={IndianRupee} label="Total Amount" value={formatARCurrency(ps.totalAmount)} sub={`Avg ${formatARCurrency(ps.avgPaymentSize)}`} gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
              <KpiCard icon={TrendingUp} label="Dominant Mode" value={ps.dominantMode} sub="highest volume mode" gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
              <KpiCard icon={Shield} label="Primary Bank" value={ps.dominantBank} sub={`${ps.uniqueBanks} banks used`} gradient="bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Mode Distribution */}
              <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
                <h3 className="font-bold text-[#546A7A] text-sm mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#6F8A9D]" /> Payment Modes</h3>
                <div className="space-y-3">
                  {modes.map((m: any, idx: number) => {
                    const colors = ['bg-[#546A7A]', 'bg-[#82A094]', 'bg-[#CE9F6B]', 'bg-[#E17F70]', 'bg-[#6F8A9D]', 'bg-[#9E3B47]', 'bg-[#96AEC2]'];
                    return (
                      <div key={m.mode} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`} />
                            <span className="text-xs font-bold text-[#546A7A]">{m.mode}</span>
                            <span className="text-[9px] text-[#92A2A5]">({m.count})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-[#546A7A]">{formatARCurrency(m.totalAmount)}</span>
                            <span className="text-[9px] text-[#92A2A5] ml-1.5">{m.percentage}%</span>
                          </div>
                        </div>
                        <div className="h-4 bg-[#F0F4F5] rounded-lg overflow-hidden">
                          <div className={`h-full ${colors[idx % colors.length]} rounded-lg transition-all duration-700`}
                            style={{ width: `${Math.max(m.percentage, 0)}%`, minWidth: m.percentage > 0 ? '24px' : '0' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bank Distribution */}
              <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/30 p-5 shadow-sm">
                <h3 className="font-bold text-[#546A7A] text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-[#82A094]" /> Bank Distribution</h3>
                <div className="space-y-2">
                  {banks.map((b: any) => {
                    const pct = ps.totalAmount > 0 ? Math.round((b.totalAmount / ps.totalAmount) * 100) : 0;
                    return (
                      <div key={b.bank} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFB] border border-[#AEBFC3]/20 hover:border-[#82A094]/30 transition-colors">
                        <div>
                          <div className="text-xs font-bold text-[#546A7A]">{b.bank}</div>
                          <div className="text-[9px] text-[#92A2A5]">{b.count} transactions</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#4F6A64]">{formatARCurrency(b.totalAmount)}</div>
                          <span className="text-[9px] font-bold bg-[#82A094]/15 text-[#4F6A64] px-1.5 py-0.5 rounded">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {banks.length === 0 && <p className="text-xs text-[#92A2A5] text-center py-4">No bank data</p>}
                </div>
              </div>
            </div>

            {/* Mode Detail Table */}
            <div className="relative bg-white rounded-2xl border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#5D6E73] via-[#546A7A] to-[#6F8A9D]" />
              <div className="px-5 py-3.5 border-b-2 border-[#5D6E73]/20 bg-gradient-to-r from-[#5D6E73] to-[#3D4E53]">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3"><CreditCard className="w-4 h-4" /><span className="text-sm font-bold">Payment Mode Details</span></div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-[#F8FAFB]">
                    {['Mode', 'Count', 'Total Amount', 'Average', 'Share %', 'Last Payment'].map(h => (
                      <th key={h} className="text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {modes.map((m: any, idx: number) => (
                      <tr key={m.mode} className={`border-b border-[#AEBFC3]/15 hover:bg-[#546A7A]/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'}`}>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#546A7A]">{m.mode}</td>
                        <td className="py-2.5 px-3 text-xs text-center font-bold">{m.count}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right">{formatARCurrency(m.totalAmount)}</td>
                        <td className="py-2.5 px-3 text-xs text-right text-[#546A7A]">{formatARCurrency(m.avgAmount)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-[#F0F4F5] rounded-full overflow-hidden">
                              <div className="h-full bg-[#546A7A] rounded-full" style={{ width: `${m.percentage}%` }} />
                            </div>
                            <span className="text-[9px] font-bold text-[#546A7A] w-8">{m.percentage}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-[#92A2A5]">{m.lastPayment ? formatARDate(m.lastPayment) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
