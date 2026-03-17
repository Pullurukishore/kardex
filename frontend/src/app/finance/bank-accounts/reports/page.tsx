"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import {
    Download, Search, CheckCircle2, AlertCircle, FileText, Building2,
    ArrowUpRight, TrendingUp, ShieldCheck, ArrowDownToLine, Eye, Copy,
    Check, Landmark, Activity, Mail, RefreshCw, Hash, Zap,
    BarChart3, Banknote, CreditCard, PieChart, ChevronDown, Filter,
    Calendar, Globe, Home, Users, ChevronRight, Clock, ArrowRightLeft
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { arApi } from '@/lib/ar-api';
import { toast } from 'sonner';

const FilePreview = dynamic(() => import('@/components/FilePreview'), {
    ssr: false, loading: () => null,
});

// ─── Avatar Colors ──────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
    'from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500', 'from-rose-500 to-pink-500',
    'from-cyan-500 to-blue-500', 'from-fuchsia-500 to-purple-500',
    'from-lime-500 to-green-500', 'from-sky-500 to-indigo-400',
];
const getAvatarGradient = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
};

const fmt = (val: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(val);

// ─── Filter Types ───────────────────────────────────────────────────────────
type FilterType = 'ALL' | 'VERIFIED' | 'PENDING' | 'DOMESTIC' | 'INTERNATIONAL' | 'MSME';
const FILTERS: { key: FilterType; label: string; icon: React.ElementType; color: string; bg: string; }[] = [
    { key: 'ALL', label: 'All', icon: Building2, color: '#6366F1', bg: '#EEF2FF' },
    { key: 'VERIFIED', label: 'KYC Done', icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
    { key: 'PENDING', label: 'KYC Pending', icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2' },
    { key: 'DOMESTIC', label: 'Domestic', icon: Home, color: '#059669', bg: '#ECFDF5' },
    { key: 'INTERNATIONAL', label: 'International', icon: Globe, color: '#3B82F6', bg: '#EFF6FF' },
    { key: 'MSME', label: 'MSME', icon: Users, color: '#7C3AED', bg: '#F5F3FF' },
];

// ─── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, bg }: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; color: string; bg: string;
}) => (
    <div className="group relative rounded-2xl bg-white border border-gray-100 p-4 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden cursor-default">
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-700 opacity-60" style={{ background: bg }} />
        <div className="relative flex items-start justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1">{label}</p>
                <p className="text-3xl font-black tracking-tight text-gray-900">{value}</p>
                {sub && <p className="text-[10px] font-bold mt-2 px-2.5 py-0.5 rounded-full inline-block" style={{ background: bg, color }}>{sub}</p>}
            </div>
            <div className="p-2.5 rounded-xl transition-transform group-hover:scale-110 duration-300" style={{ background: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
        </div>
    </div>
);

// ─── Mini Bar ───────────────────────────────────────────────────────────────
const MiniBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string; }) => (
    <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold text-gray-500 w-20 truncate">{label}</span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
        </div>
        <span className="text-[11px] font-black text-gray-700 tabular-nums w-6 text-right">{value}</span>
    </div>
);

// ─── Progress Ring ──────────────────────────────────────────────────────────
const Ring = ({ pct, color, label }: { pct: number; color: string; label: string; }) => {
    const r = 28, circ = 2 * Math.PI * r;
    return (
        <div className="flex items-center gap-3">
            <svg width={64} height={64} className="-rotate-90">
                <circle cx={32} cy={32} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5} />
                <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
                    strokeDasharray={circ} strokeDashoffset={circ - (circ * Math.min(pct, 100)) / 100}
                    strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="-ml-[52px] w-10 text-center">
                <p className="text-xs font-black text-gray-900">{pct}%</p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-2">{label}</p>
        </div>
    );
};

export default function BankAccountReportsPage() {
    const [auditData, setAuditData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [paymentInsights, setPaymentInsights] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [vendorPayments, setVendorPayments] = useState<any>(null);
    const [vendorPaymentsLoading, setVendorPaymentsLoading] = useState(false);
    const [paymentDays, setPaymentDays] = useState<number | undefined>(30);
    const [paymentSearch, setPaymentSearch] = useState('');
    const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [audit, compliance, payments] = await Promise.all([
                arApi.getVendorMasterAudit(),
                arApi.getBankComplianceMetrics(),
                arApi.getBankPaymentInsights(30)
            ]);
            setAuditData(audit.data);
            setSummary(audit.summary);
            setMetrics(compliance);
            setPaymentInsights(payments);
            // Also fetch vendor payment history
            fetchVendorPayments(30);
        } catch (error) {
            console.error('Failed to fetch report data:', error);
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    const handleExportMaster = async () => {
        if (exporting || auditData.length === 0) return;
        try {
            setExporting(true);
            const toastId = toast.loading('Preparing master export...');
            const exportRows = auditData.map(row => ({
                'Vendor Name': row.vendorName, 'BP Code': row.bpCode || 'N/A',
                'Account Number': row.accountNumber, 'Beneficiary Name': row.beneficiaryName || row.vendorName,
                'Bank Name': row.beneficiaryBankName, 'IFSC/SWIFT': row.ifscCode,
                'Currency': row.currency, 'Account Type': row.accountType || 'Savings',
                'Category': row.accountCategory, 'PAN Number': row.panNumber || '—',
                'GST Number': row.gstNumber || 'Unregistered', 'MSME Status': row.isMSME ? 'Registered' : 'Regular',
                'Udyam Number': row.udyamRegNum || '—', 'Email ID': row.emailId || '—',
                'KYC Status': row.kycStatus, 'Registration Date': new Date(row.createdAt).toLocaleDateString()
            }));
            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Vendor Bank Master");
            ws['!cols'] = Object.keys(exportRows[0] || {}).map(key => ({
                wch: Math.max(key.length, ...exportRows.map(row => String((row as any)[key]).length)) + 2
            }));
            XLSX.writeFile(wb, `Vendor_Bank_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.dismiss(toastId);
            toast.success('Master export downloaded successfully');
        } catch { toast.error('Failed to export master data'); }
        finally { setExporting(false); }
    };

    const fetchVendorPayments = async (days?: number, search?: string) => {
        try {
            setVendorPaymentsLoading(true);
            const data = await arApi.getVendorPaymentHistory({ days, search: search || undefined });
            setVendorPayments(data);
        } catch (error) {
            console.error('Failed to fetch vendor payment history:', error);
        } finally {
            setVendorPaymentsLoading(false);
        }
    };

    const handlePaymentDaysChange = (d: number | undefined) => {
        setPaymentDays(d);
        fetchVendorPayments(d, paymentSearch);
    };

    const handlePaymentSearch = (val: string) => {
        setPaymentSearch(val);
        fetchVendorPayments(paymentDays, val);
    };

    const handleExportPaymentHistory = () => {
        if (!vendorPayments?.vendors?.length) return;
        const rows: any[] = [];
        vendorPayments.vendors.forEach((v: any) => {
            v.transactions.forEach((t: any) => {
                rows.push({
                    'Vendor Name': v.vendorName,
                    'Account Number': v.accountNumber,
                    'Bank': v.bankName,
                    'BP Code': v.bpCode || '—',
                    'Amount': t.amount,
                    'Mode': t.transactionMode,
                    'Payment Date': new Date(t.valueDate).toLocaleDateString('en-IN'),
                    'Batch #': t.batchNumber,
                    'Batch Status': t.batchStatus,
                    'Requested By': t.requestedBy
                });
            });
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vendor Payment History');
        ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
        XLSX.writeFile(wb, `Vendor_Payment_History_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Payment history exported');
    };

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    }, []);

    const filteredAudit = auditData.filter(acc => {
        const matchesSearch = acc.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (acc.bpCode && acc.bpCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
            acc.accountNumber.includes(searchTerm) ||
            (acc.beneficiaryName && acc.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'VERIFIED') return acc.kycStatus === 'VERIFIED';
        if (activeFilter === 'PENDING') return acc.kycStatus === 'PENDING';
        if (activeFilter === 'DOMESTIC') return acc.accountCategory === 'DOMESTIC';
        if (activeFilter === 'INTERNATIONAL') return acc.accountCategory === 'INTERNATIONAL';
        if (activeFilter === 'MSME') return acc.isMSME;
        return true;
    });

    const fmt = (n: number) => {
        if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
        if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
        if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
        return `₹${n.toFixed(0)}`;
    };

    return (
        <div className="min-h-screen bg-[#F7F8FA]">
            {/* ══════════ HEADER ══════════ */}
            <div className="px-4 md:px-6 pt-5 pb-3">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Intelligence Hub</span>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900">Bank Account Reports</h1>
                        <p className="text-gray-400 text-xs font-medium mt-0.5">Audit vendor master, compliance status & payment operations.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportMaster} disabled={exporting || auditData.length === 0}
                            className="rounded-xl border-gray-200 text-gray-600 font-bold h-10 px-4 text-xs hover:bg-gray-50">
                            <Download className="h-3.5 w-3.5 mr-1.5" />{exporting ? 'Exporting...' : 'Export Excel'}
                        </Button>
                        <Button onClick={fetchData} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold h-10 px-4 text-xs shadow-md shadow-indigo-200 hover:shadow-lg">
                            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* ══════════ STATS ROW ══════════ */}
            <div className="px-4 md:px-6 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Building2} label="Total Vendors" value={summary?.totalAccounts || 0} sub="Registered" color="#6366F1" bg="#EEF2FF" />
                <StatCard icon={ShieldCheck} label="KYC Verified" value={summary?.verifiedAccounts || 0} sub={`${metrics?.compliance?.kycRate || 0}% Rate`} color="#10B981" bg="#ECFDF5" />
                <StatCard icon={FileText} label="MSME Vendors" value={metrics?.distribution?.msme || 0} sub={`${metrics?.distribution?.nonMsme || 0} Standard`} color="#3B82F6" bg="#EFF6FF" />
                <StatCard icon={AlertCircle} label="KYC Pending" value={summary?.pendingAccounts || 0} sub="Action Required" color="#EF4444" bg="#FEF2F2" />
            </div>

            {/* ══════════ COMPLIANCE + PAYMENTS DASHBOARD ROW ══════════ */}
            <div className="px-4 md:px-6 pb-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Compliance Snapshot */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-indigo-50"><PieChart className="h-3.5 w-3.5 text-indigo-500" /></div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Compliance Snapshot</h3>
                    </div>
                    <div className="flex items-center justify-around mb-4">
                        <Ring pct={parseFloat(metrics?.compliance?.kycRate || '0')} color="#10B981" label="KYC" />
                        <Ring pct={parseFloat(metrics?.compliance?.msmeRate || '0')} color="#3B82F6" label="MSME" />
                    </div>
                    <div className="space-y-2.5 pt-3 border-t border-gray-100">
                        <MiniBar label="Domestic" value={metrics?.distribution?.domestic || 0} max={metrics?.compliance?.total || 1} color="#10B981" />
                        <MiniBar label="International" value={metrics?.distribution?.international || 0} max={metrics?.compliance?.total || 1} color="#3B82F6" />
                        <MiniBar label="INR Accts" value={metrics?.distribution?.inr || 0} max={metrics?.compliance?.total || 1} color="#F59E0B" />
                        <MiniBar label="Other Curr" value={metrics?.distribution?.otherCurrency || 0} max={metrics?.compliance?.total || 1} color="#8B5CF6" />
                    </div>
                </div>

                {/* Data Health */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-rose-50"><Activity className="h-3.5 w-3.5 text-rose-500" /></div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Data Health</h3>
                    </div>
                    <div className="space-y-2.5">
                        {[
                            { label: 'Missing BP Code', val: metrics?.health?.missingBpCode || 0, icon: Hash, color: '#F59E0B', bg: '#FFFBEB' },
                            { label: 'Missing Tax ID', val: metrics?.health?.missingTaxId || 0, icon: FileText, color: '#EF4444', bg: '#FEF2F2' },
                            { label: 'Total Issues', val: metrics?.health?.totalIssues || 0, icon: AlertCircle, color: '#EF4444', bg: '#FEF2F2' },
                        ].map(h => (
                            <div key={h.label} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg" style={{ background: h.bg }}>
                                        <h.icon className="h-3.5 w-3.5" style={{ color: h.color }} />
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-500">{h.label}</span>
                                </div>
                                <span className="text-base font-black tabular-nums" style={{ color: h.val > 0 ? h.color : '#10B981' }}>{h.val}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 p-2.5 rounded-xl text-center" style={{ background: (metrics?.health?.totalIssues || 0) === 0 ? '#ECFDF5' : '#FEF2F2' }}>
                        <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: (metrics?.health?.totalIssues || 0) === 0 ? '#10B981' : '#EF4444' }}>
                            {(metrics?.health?.totalIssues || 0) === 0 ? '✓ All Data Complete' : `⚠ ${metrics?.health?.totalIssues} Issues Need Attention`}
                        </p>
                    </div>
                </div>

                {/* Payment Insights */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-emerald-50"><Banknote className="h-3.5 w-3.5 text-emerald-500" /></div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Payment Insights (30d)</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 text-center border border-emerald-100/50">
                            <p className="text-lg font-black text-gray-900">{fmt(paymentInsights?.summary?.totalAmount || 0)}</p>
                            <p className="text-[9px] font-bold uppercase text-emerald-600 tracking-wider">Volume</p>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-3 text-center border border-indigo-100/50">
                            <p className="text-lg font-black text-gray-900">{paymentInsights?.summary?.totalItems || 0}</p>
                            <p className="text-[9px] font-bold uppercase text-indigo-600 tracking-wider">Transactions</p>
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-400 mb-1">Top Banks</p>
                        {(paymentInsights?.banks || []).slice(0, 4).map((b: any, i: number) => (
                            <MiniBar key={i} label={b.name} value={b.count} max={paymentInsights?.banks?.[0]?.count || 1}
                                color={['#6366F1', '#10B981', '#3B82F6', '#F59E0B'][i % 4]} />
                        ))}
                        {(!paymentInsights?.banks || paymentInsights.banks.length === 0) && (
                            <p className="text-[10px] text-gray-400 text-center py-4">No payment data available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════ MASTER TABLE ══════════ */}
            <div className="px-4 md:px-6 pb-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Table Header */}
                    <div className="p-5 flex flex-col gap-4 border-b border-gray-100">
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-50">
                                    <Building2 className="h-4 w-4 text-indigo-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-black text-gray-900">Vendor Master Audit</h2>
                                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full tabular-nums">
                                            {filteredAudit.length}{filteredAudit.length !== auditData.length ? ` / ${auditData.length}` : ''}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium">All vendor bank accounts with compliance & document status</p>
                                </div>
                            </div>
                            <div className="relative w-full lg:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                                <Input placeholder="Search vendor, code, account..." value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 pl-10 rounded-xl bg-gray-50 border-gray-100 text-sm font-medium focus-visible:ring-1 focus-visible:ring-indigo-300" />
                            </div>
                        </div>
                        {/* Filter Chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-3.5 w-3.5 text-gray-300" />
                            {FILTERS.map(f => (
                                <button key={f.key} onClick={() => setActiveFilter(f.key)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border ${
                                        activeFilter === f.key
                                            ? 'shadow-sm scale-[1.02]'
                                            : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600'
                                    }`}
                                    style={activeFilter === f.key ? { background: f.bg, color: f.color, borderColor: f.color + '30' } : {}}>
                                    <f.icon className="h-3 w-3" />
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <ScrollArea className="w-full">
                        <Table className="min-w-[1900px]">
                            <TableHeader>
                                <TableRow className="bg-gradient-to-r from-gray-50 via-gray-50/80 to-gray-50 hover:bg-gray-50 border-b border-gray-100">
                                    {['Vendor', 'BP Code', 'Account / Beneficiary', 'Bank & IFSC', 'KYC', 'Category', 'PAN / GST', 'MSME', 'Registered', 'Documents'].map(h => (
                                        <TableHead key={h} className="px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 whitespace-nowrap">{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={10} className="h-52 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-9 w-9 border-[3px] border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading audit data...</span>
                                        </div>
                                    </TableCell></TableRow>
                                ) : filteredAudit.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-52 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Search className="h-10 w-10 text-gray-200" />
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">No matching records</span>
                                            {activeFilter !== 'ALL' && (
                                                <button onClick={() => setActiveFilter('ALL')} className="text-[10px] font-bold text-indigo-500 hover:underline">Clear filter</button>
                                            )}
                                        </div>
                                    </TableCell></TableRow>
                                ) : filteredAudit.map((row, idx) => (
                                    <TableRow key={row.id} className={`group transition-colors border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-indigo-50/30`}>
                                        {/* Vendor */}
                                        <TableCell className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(row.vendorName)} flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm`}>
                                                    {row.vendorName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate max-w-[170px] group-hover:text-indigo-600 transition-colors">{row.vendorName}</p>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <Mail className="h-3 w-3 text-gray-300" />
                                                        <span className="text-[10px] text-gray-400 truncate max-w-[130px]">{row.emailId || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {/* BP Code */}
                                        <TableCell className="px-4">
                                            <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{row.bpCode || '—'}</span>
                                        </TableCell>
                                        {/* Account */}
                                        <TableCell className="px-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs font-bold text-gray-800">{row.accountNumber}</span>
                                                    <button onClick={() => copyToClipboard(row.accountNumber, `acc-${row.id}`)} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
                                                        {copied === `acc-${row.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-gray-300" />}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{row.beneficiaryName || row.vendorName}</p>
                                                <div className="flex gap-1">
                                                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{row.accountType || 'Savings'}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{row.currency}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {/* Bank */}
                                        <TableCell className="px-4">
                                            <div className="flex items-start gap-2">
                                                <Landmark className="h-3.5 w-3.5 mt-0.5 text-gray-300 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-bold text-gray-700 truncate max-w-[120px]">{row.beneficiaryBankName}</p>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="font-mono text-[11px] font-bold text-indigo-500">{row.ifscCode}</span>
                                                        <button onClick={() => copyToClipboard(row.ifscCode, `ifsc-${row.id}`)} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
                                                            {copied === `ifsc-${row.id}` ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-gray-300" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {/* KYC */}
                                        <TableCell className="px-4">
                                            {row.kycStatus === 'VERIFIED' ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-red-50 text-red-500 border border-red-100">
                                                    <AlertCircle className="h-3 w-3" /> Pending
                                                </span>
                                            )}
                                        </TableCell>
                                        {/* Category */}
                                        <TableCell className="px-4">
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md inline-block ${
                                                row.accountCategory === 'DOMESTIC' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                row.accountCategory === 'INTERNATIONAL' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                                {row.accountCategory === 'DOMESTIC' ? '🏠 Domestic' : row.accountCategory === 'INTERNATIONAL' ? '🌐 Intl' : '👤 Employee'}
                                            </span>
                                        </TableCell>
                                        {/* PAN / GST */}
                                        <TableCell className="px-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-gray-300 w-7">PAN</span>
                                                    <span className="font-mono text-[11px] font-bold text-gray-700">{row.panNumber || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-gray-300 w-7">GST</span>
                                                    <span className="font-mono text-[10px] font-bold text-gray-500 truncate max-w-[100px]">{row.gstNumber || 'Unregistered'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {/* MSME */}
                                        <TableCell className="px-4">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg inline-block ${
                                                row.isMSME ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
                                            }`}>
                                                {row.isMSME ? '⭐ MSME' : 'Regular'}
                                            </span>
                                            {row.isMSME && row.udyamRegNum && (
                                                <p className="text-[9px] font-mono text-gray-400 mt-1">UDYAM-{row.udyamRegNum}</p>
                                            )}
                                        </TableCell>
                                        {/* Registered */}
                                        <TableCell className="px-4">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-3 w-3 text-gray-300" />
                                                <span className="text-[11px] font-bold text-gray-500">
                                                    {new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        {/* Documents */}
                                        <TableCell className="px-4">
                                            {row.attachments?.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    {row.attachments.slice(0, 2).map((att: any) => (
                                                        <div key={att.id} className="inline-flex rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                                                            <button onClick={() => { setPreviewFile(att); setShowPreview(true); }}
                                                                className="px-2 py-1.5 flex items-center gap-1 text-indigo-500 hover:bg-indigo-50 transition-colors">
                                                                <Eye className="h-3 w-3" /><span className="text-[9px] font-black uppercase">View</span>
                                                            </button>
                                                            <button onClick={() => arApi.downloadBankAccountAttachment(att.id)}
                                                                className="px-1.5 py-1.5 text-gray-400 hover:bg-gray-50 transition-colors border-l border-gray-100">
                                                                <ArrowDownToLine className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {row.attachments.length > 2 && (
                                                        <span className="text-[9px] font-bold text-gray-400 ml-1">+{row.attachments.length - 2}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-400 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                                                    <FileText className="h-3 w-3" /> Missing
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    {/* Footer */}
                    {summary && (
                        <div className="px-5 py-3.5 flex flex-wrap gap-6 items-center justify-between border-t border-gray-50 bg-gray-50/50">
                            <div className="flex flex-wrap gap-5">
                                {[
                                    { dot: '#6366F1', lbl: 'Total', val: summary.totalAccounts },
                                    { dot: '#10B981', lbl: 'Verified', val: summary.verifiedAccounts },
                                    { dot: '#EF4444', lbl: 'Pending', val: summary.pendingAccounts },
                                    { dot: '#3B82F6', lbl: 'MSME', val: summary.msmeAccounts || metrics?.distribution?.msme || 0 },
                                ].map(s => (
                                    <div key={s.lbl} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}40` }} />
                                        <span className="text-[11px] font-bold text-gray-400">{s.lbl}: <span className="font-black text-gray-700">{s.val}</span></span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Real-time ERP Data Feed</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ══════════ VENDOR PAYMENT HISTORY ══════════ */}
            <div className="px-4 md:px-6 pb-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-5 flex flex-col gap-4 border-b border-gray-100">
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-50">
                                    <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-black text-gray-900">Vendor Payment History</h2>
                                        {vendorPayments && (
                                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full tabular-nums">
                                                {vendorPayments.summary?.totalVendors || 0} vendors · {vendorPayments.summary?.totalTransactions || 0} txns
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium">Detailed payment transactions per vendor from approved batches</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Period Selector */}
                                {[{ l: '30d', v: 30 }, { l: '90d', v: 90 }, { l: 'All', v: undefined as number | undefined }].map(p => (
                                    <button key={p.l} onClick={() => handlePaymentDaysChange(p.v)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            paymentDays === p.v
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm'
                                                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                                        }`}>{p.l}</button>
                                ))}
                                <Button variant="outline" onClick={handleExportPaymentHistory}
                                    disabled={!vendorPayments?.vendors?.length}
                                    className="rounded-xl border-gray-200 text-gray-600 font-bold h-8 px-3 text-[10px] hover:bg-gray-50 ml-1">
                                    <Download className="h-3 w-3 mr-1" />Export
                                </Button>
                            </div>
                        </div>
                        <div className="relative w-full lg:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                            <Input placeholder="Search vendor name..." value={paymentSearch}
                                onChange={(e) => handlePaymentSearch(e.target.value)}
                                className="h-9 pl-10 rounded-xl bg-gray-50 border-gray-100 text-sm font-medium focus-visible:ring-1 focus-visible:ring-emerald-300" />
                        </div>
                    </div>

                    {/* Vendor Payment Table */}
                    <ScrollArea className="w-full">
                        <div className="min-w-[900px]">
                            {/* Table Header */}
                            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-2 px-5 py-3 bg-gradient-to-r from-gray-50 via-gray-50/80 to-gray-50 border-b border-gray-100">
                                {['Vendor', 'Total Paid', 'Transactions', 'Last Payment', 'Avg Amount', ''].map(h => (
                                    <span key={h} className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">{h}</span>
                                ))}
                            </div>

                            {/* Rows */}
                            {vendorPaymentsLoading ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3">
                                    <div className="h-8 w-8 border-[3px] border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading payment history...</span>
                                </div>
                            ) : !vendorPayments?.vendors?.length ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3">
                                    <Banknote className="h-10 w-10 text-gray-200" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">No payment history found</span>
                                </div>
                            ) : vendorPayments.vendors.map((vendor: any, idx: number) => (
                                <div key={vendor.bankAccountId}>
                                    {/* Vendor Row */}
                                    <div
                                        onClick={() => setExpandedVendor(expandedVendor === vendor.bankAccountId ? null : vendor.bankAccountId)}
                                        className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_40px] gap-2 px-5 py-3.5 cursor-pointer transition-all border-b border-gray-50 ${
                                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                        } hover:bg-emerald-50/30 group`}>
                                        {/* Vendor Info */}
                                        <div className="flex items-center gap-3">
                                            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(vendor.vendorName)} flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm`}>
                                                {vendor.vendorName.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-gray-900 truncate max-w-[200px] group-hover:text-emerald-600 transition-colors">{vendor.vendorName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="font-mono text-[10px] text-gray-400">{vendor.accountNumber}</span>
                                                    {vendor.bpCode && <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{vendor.bpCode}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Total Paid */}
                                        <div className="flex items-center">
                                            <span className="text-sm font-black text-gray-900 tabular-nums">{fmt(vendor.totalAmount)}</span>
                                        </div>
                                        {/* Txn Count */}
                                        <div className="flex items-center">
                                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md tabular-nums">{vendor.transactionCount}</span>
                                        </div>
                                        {/* Last Payment */}
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-gray-300" />
                                            <span className="text-[11px] font-bold text-gray-500">
                                                {vendor.lastPaymentDate ? new Date(vendor.lastPaymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </span>
                                        </div>
                                        {/* Avg Amount */}
                                        <div className="flex items-center">
                                            <span className="text-xs font-bold text-gray-500 tabular-nums">{fmt(vendor.avgAmount)}</span>
                                        </div>
                                        {/* Expand Icon */}
                                        <div className="flex items-center justify-center">
                                            <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform duration-200 ${
                                                expandedVendor === vendor.bankAccountId ? 'rotate-90 text-emerald-500' : ''
                                            }`} />
                                        </div>
                                    </div>

                                    {/* Expanded Transactions */}
                                    {expandedVendor === vendor.bankAccountId && (
                                        <div className="bg-gray-50/60 border-b border-gray-100">
                                            <div className="px-8 py-2">
                                                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 py-2 border-b border-gray-200/50">
                                                    {['Date', 'Amount', 'Mode', 'Bank', 'Batch #', 'Requested By'].map(h => (
                                                        <span key={h} className="text-[9px] font-black uppercase tracking-wider text-gray-400">{h}</span>
                                                    ))}
                                                </div>
                                                {vendor.transactions.map((tx: any, ti: number) => (
                                                    <div key={tx.id} className={`grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 py-2.5 ${ti < vendor.transactions.length - 1 ? 'border-b border-gray-100/60' : ''}`}>
                                                        <span className="text-[11px] font-bold text-gray-600">
                                                            {new Date(tx.valueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        <span className="text-[11px] font-black text-gray-800 tabular-nums">{fmt(tx.amount)}</span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center w-fit ${
                                                            tx.transactionMode === 'NFT' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                            tx.transactionMode === 'RTI' ? 'bg-violet-50 text-violet-600 border border-violet-100' :
                                                            'bg-amber-50 text-amber-600 border border-amber-100'
                                                        }`}>{tx.transactionMode === 'NFT' ? 'NEFT' : tx.transactionMode === 'RTI' ? 'RTGS' : tx.transactionMode}</span>
                                                        <span className="text-[11px] font-bold text-gray-500 truncate">{vendor.bankName}</span>
                                                        <span className="text-[10px] font-mono font-bold text-indigo-500">{tx.batchNumber}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{tx.requestedBy}</span>
                                                    </div>
                                                ))}
                                                {vendor.transactions.length > 0 && (
                                                    <div className="pt-2 pb-1 flex items-center justify-between">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-300">
                                                            {vendor.transactions.length} transaction{vendor.transactions.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-[10px] font-black text-emerald-600">
                                                            Total: {fmt(vendor.totalAmount)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>

                    {/* Summary Footer */}
                    {vendorPayments?.summary && vendorPayments.summary.totalTransactions > 0 && (
                        <div className="px-5 py-3 flex flex-wrap gap-6 items-center justify-between border-t border-gray-100 bg-gray-50/50">
                            <div className="flex flex-wrap gap-5">
                                {[
                                    { dot: '#10B981', lbl: 'Total Volume', val: fmt(vendorPayments.summary.totalAmount) },
                                    { dot: '#6366F1', lbl: 'Vendors', val: vendorPayments.summary.totalVendors },
                                    { dot: '#3B82F6', lbl: 'Transactions', val: vendorPayments.summary.totalTransactions },
                                ].map(s => (
                                    <div key={s.lbl} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}40` }} />
                                        <span className="text-[11px] font-bold text-gray-400">{s.lbl}: <span className="font-black text-gray-700">{s.val}</span></span>
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                                {paymentDays ? `Last ${paymentDays} Days` : 'All Time'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Document Preview */}
            <FilePreview isOpen={showPreview} onClose={() => setShowPreview(false)} file={previewFile} />
        </div>
    );
}
