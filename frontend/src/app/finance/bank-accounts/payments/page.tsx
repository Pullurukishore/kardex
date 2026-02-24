'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { arApi, BankAccount, submitPaymentBatch } from '@/lib/ar-api';
import { 
  Plus, Search, Trash2, Landmark, CreditCard, 
  Calendar as CalendarIcon, ArrowLeft, Loader2, CheckCircle2,
  X, Info, Wallet, DollarSign, RefreshCcw, Check, Building2,
  Shield, Globe, Power, Eye, Pencil, List, Hash, Send, 
  Zap, AlertCircle, IndianRupee, Clock, Filter, ChevronDown, Mail
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { PaymentRow } from '@/lib/payment-excel-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';


interface PendingPayment extends Partial<PaymentRow> {
    tempId: string;
    bankAccount: BankAccount;
}

// ============================================================================
// ANIMATED STAT CARD COMPONENT
// ============================================================================
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  loading,
  variant,
  subtitle,
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  loading: boolean;
  variant: 'gold' | 'emerald' | 'steel' | 'coral';
  subtitle?: string;
}) => {
  const variants = {
    gold: {
      card: 'from-[#CE9F6B] via-[#B18E63] to-[#976E44]',
      iconBg: 'bg-white/20 backdrop-blur-sm',
      glow: 'shadow-[0_8px_30px_rgba(206,159,107,0.3)]',
    },
    emerald: {
      card: 'from-[#82A094] via-[#718E85] to-[#4F6A64]',
      iconBg: 'bg-white/20 backdrop-blur-sm',
      glow: 'shadow-[0_8px_30px_rgba(130,160,148,0.3)]',
    },
    steel: {
      card: 'from-[#6F8A9D] via-[#5E7788] to-[#546A7A]',
      iconBg: 'bg-white/20 backdrop-blur-sm',
      glow: 'shadow-[0_8px_30px_rgba(111,138,157,0.3)]',
    },
    coral: {
      card: 'from-[#E17F70] via-[#D06A5C] to-[#C45C4D]',
      iconBg: 'bg-white/20 backdrop-blur-sm',
      glow: 'shadow-[0_8px_30px_rgba(225,127,112,0.3)]',
    }
  };

  const v = variants[variant];

  return (
    <div className={`group relative rounded-2xl p-5 bg-gradient-to-br ${v.card} ${v.glow} hover:shadow-xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-0.5 overflow-hidden`}>
      {/* Shine effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/15 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      {/* Decorative circle */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/[0.07] pointer-events-none" />
      <div className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full bg-white/[0.05] pointer-events-none" />
      
      <div className="relative flex items-start justify-between gap-3">
        <div className={`w-12 h-12 rounded-xl ${v.iconBg} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="w-5.5 h-5.5 text-white drop-shadow-sm" />
        </div>
        <div className="flex-1 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70 mb-1.5">
            {label}
          </p>
          <p className="text-3xl font-black tabular-nums text-white tracking-tight drop-shadow-sm">
            {loading ? (
              <span className="inline-block w-12 h-8 bg-white/20 rounded-lg animate-pulse" />
            ) : value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-white/50 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODE BADGE COMPONENT
// ============================================================================
const ModeBadge = ({ mode }: { mode: string }) => {
  const config = {
    'NFT': { label: 'NEFT', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    'RTI': { label: 'RTGS', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
    'FT': { label: 'Same Bank', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  }[mode] || { label: mode, color: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export default function PaymentsPage() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
    const [vendorSearchQuery, setVendorSearchQuery] = useState('');
    const [openDropdown, setOpenDropdown] = useState(false);
    const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
    const [globalDate, setGlobalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [globalMode, setGlobalMode] = useState<'NFT' | 'RTI' | 'FT'>('NFT');
    const [submittingBatch, setSubmittingBatch] = useState(false);
    const [exportFormat, setExportFormat] = useState<'ICICI' | 'STANDARD'>('ICICI');
    const [benEmailIds, setBenEmailIds] = useState<string[]>(['naveen.n@kardex.com']);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [editingEmailIdx, setEditingEmailIdx] = useState<number | null>(null);
    const [editingEmailValue, setEditingEmailValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Click outside handler for vendor dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (openDropdown && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [openDropdown]);

    // Extract unique currencies from accounts with counts
    const currencyOptions = useMemo(() => {
        const currMap = new Map<string, number>();
        accounts.forEach(a => {
            const cur = (a.currency || 'INR').toUpperCase();
            currMap.set(cur, (currMap.get(cur) || 0) + 1);
        });
        // Sort: INR first, then alphabetical
        return Array.from(currMap.entries())
            .sort(([a], [b]) => {
                if (a === 'INR') return -1;
                if (b === 'INR') return 1;
                return a.localeCompare(b);
            })
            .map(([currency, count]) => ({ currency, count }));
    }, [accounts]);

    // Filtered accounts based on search + currency
    const filteredAccounts = useMemo(() => {
        let result = accounts;

        // Apply currency filter
        if (currencyFilter !== 'ALL') {
            result = result.filter(a => (a.currency || 'INR').toUpperCase() === currencyFilter);
        }

        // Apply search filter
        if (vendorSearchQuery.trim()) {
            const q = vendorSearchQuery.toLowerCase();
            result = result.filter(a =>
                a.vendorName.toLowerCase().includes(q) ||
                (a.bpCode || '').toLowerCase().includes(q) ||
                a.accountNumber.includes(vendorSearchQuery) ||
                (a.beneficiaryBankName || '').toLowerCase().includes(q) ||
                (a.ifscCode || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [accounts, vendorSearchQuery, currencyFilter]);

    useEffect(() => {
        loadBankAccounts();
    }, []);

    const loadBankAccounts = async () => {
        try {
            setLoading(true);
            const data = await arApi.getBankAccounts();
            setAccounts(data);
        } catch (error) {
            console.error('Failed to load bank accounts:', error);
            toast.error('Failed to load vendor bank accounts');
        } finally {
            setLoading(false);
        }
    };

    const addVendor = (account: BankAccount) => {
        const newPayment: PendingPayment = {
            tempId: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
            bankAccount: account,
            vendorName: account.vendorName,
            bpCode: account.bpCode || '',
            accountNumber: account.accountNumber,
            ifscCode: account.ifscCode,
            bankName: account.beneficiaryBankName || '',
            amount: 0,
            emailId: account.emailId || '',
            valueDate: new Date(globalDate),
            transactionMode: globalMode,
            accountType: account.accountType || 'Current'
        };
        setPendingPayments(prev => [...prev, newPayment]);
        setVendorSearchQuery('');
        toast.success(`Added ${account.vendorName}`);
    };

    const removePayment = (tempId: string) => {
        setPendingPayments(prev => prev.filter(p => p.tempId !== tempId));
    };

    const updatePayment = (tempId: string, updates: Partial<PendingPayment>) => {
        setPendingPayments(prev => prev.map(p => 
            p.tempId === tempId ? { ...p, ...updates } : p
        ));
    };

    const applyGlobalSettings = () => {
        setPendingPayments(prev => prev.map(p => ({
            ...p,
            valueDate: new Date(globalDate),
            transactionMode: globalMode
        })));
        toast.info('Applied global settings to all rows');
    };

    const handleSubmitForApproval = async () => {
        if (pendingPayments.length === 0) {
            toast.error('Add at least one payment to submit');
            return;
        }
        const invalid = pendingPayments.some(p => !p.amount || p.amount <= 0);
        if (invalid) {
            toast.error('All payments must have an amount greater than zero');
            return;
        }
        setSubmittingBatch(true);
        try {
            const items = pendingPayments.map(p => ({
                bankAccountId: p.bankAccount.id,
                vendorName: p.vendorName!,
                accountNumber: p.accountNumber!,
                ifscCode: p.ifscCode!,
                bankName: p.bankName!,
                bpCode: p.bpCode || undefined,
                emailId: exportFormat === 'ICICI'
                    ? (benEmailIds.length > 0 ? benEmailIds.join(';') : undefined)
                    : (p.emailId || undefined),
                accountType: p.accountType || undefined,
                amount: p.amount!,
                transactionMode: p.transactionMode!,
                valueDate: p.valueDate ? p.valueDate.toISOString() : new Date().toISOString(),
            }));

            const currency = currencyFilter !== 'ALL' ? currencyFilter : 'INR';
            const result = await submitPaymentBatch({ items, currency, exportFormat });
            toast.success(`Batch ${result.batch.batchNumber} submitted for admin approval!`);
            setPendingPayments([]);
        } catch (error: any) {
            console.error('Submit failed:', error);
            toast.error(error?.response?.data?.error || 'Failed to submit batch');
        } finally {
            setSubmittingBatch(false);
        }
    };

    const stats = useMemo(() => ({
        totalRecords: pendingPayments.length,
        selectedVendors: new Set(pendingPayments.map(p => p.bankAccount.id)).size,
        totalAmount: pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
        validPayments: pendingPayments.filter(p => p.amount && p.amount > 0).length,
    }), [pendingPayments]);

    // Dynamic currency symbol helper
    const CURRENCY_SYMBOLS: Record<string, string> = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'AED': 'د.إ', 'SGD': 'S$', 'CHF': 'Fr', 'AUD': 'A$', 'CAD': 'C$' };
    const activeCurrencySymbol = currencyFilter !== 'ALL' ? (CURRENCY_SYMBOLS[currencyFilter] || currencyFilter) : '₹';
    const activeCurrencyCode = currencyFilter !== 'ALL' ? currencyFilter : 'INR';

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#B18E63] to-[#7A5A38] flex items-center justify-center shadow-lg">
                            <Loader2 className="w-7 h-7 animate-spin text-white" />
                        </div>
                        <div className="absolute -inset-2 bg-gradient-to-br from-[#CE9F6B]/20 to-[#82A094]/20 rounded-3xl blur-xl animate-pulse" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-600">Loading Vendors</p>
                        <p className="text-xs text-slate-400 mt-1">Fetching bank account data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1700px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* ================================================================ */}
            {/* HEADER SECTION */}
            {/* ================================================================ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute -inset-1.5 bg-gradient-to-br from-[#CE9F6B]/40 to-[#82A094]/40 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                        <div 
                            className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
                        >
                            <Send className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground mb-0.5">
                            <Link href="/finance/bank-accounts" className="hover:text-[#B18E63] transition-colors flex items-center gap-1 text-xs font-semibold">
                                <ArrowLeft className="w-3 h-3" /> Back to Bank Accounts
                            </Link>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">
                            <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                                Bulk Payments
                            </span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-[#CE9F6B]" />
                            Generate batch payment files for ICICI CMS & Standard NEFT/RTGS formats
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Export Format Toggle */}
                    <div className="flex flex-col gap-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 text-center">Export Format</p>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => setExportFormat('ICICI')}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                    exportFormat === 'ICICI'
                                        ? 'bg-gradient-to-br from-[#B18E63] to-[#976E44] text-white shadow-md'
                                        : 'text-slate-500 hover:text-[#976E44]'
                                )}
                            >
                                ICICI CMS
                            </button>
                            <button
                                onClick={() => setExportFormat('STANDARD')}
                                className={cn(
                                    'px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                    exportFormat === 'STANDARD'
                                        ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white shadow-md'
                                        : 'text-slate-500 hover:text-[#546A7A]'
                                )}
                            >
                                Standard
                            </button>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        onClick={handleSubmitForApproval}
                        disabled={submittingBatch || pendingPayments.length === 0}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all border-0 rounded-xl hover:scale-[1.02] h-12 px-8 font-bold"
                    >
                        {submittingBatch ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        <span className="text-sm">Submit for Approval</span>
                    </Button>
                </div>
            </div>

            {/* ================================================================ */}
            {/* STATS GRID */}
            {/* ================================================================ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    icon={Hash} 
                    label="Total Records" 
                    value={stats.totalRecords} 
                    loading={false}
                    variant="gold"
                    subtitle="payment entries added"
                />
                <StatCard 
                    icon={Building2} 
                    label="Unique Vendors" 
                    value={stats.selectedVendors} 
                    loading={false}
                    variant="steel"
                    subtitle="distinct beneficiaries"
                />
                <StatCard 
                    icon={currencyFilter === 'USD' ? DollarSign : IndianRupee} 
                    label="Total Amount" 
                    value={`${activeCurrencySymbol}${stats.totalAmount.toLocaleString('en-IN')}`} 
                    loading={false}
                    variant="emerald"
                    subtitle={currencyFilter !== 'ALL' ? `${currencyFilter} disbursement` : 'total disbursement'}
                />
                <StatCard 
                    icon={CheckCircle2} 
                    label="Ready to Export" 
                    value={stats.validPayments} 
                    loading={false}
                    variant="coral"
                    subtitle={`of ${stats.totalRecords} have valid amounts`}
                />
            </div>

            {/* ================================================================ */}
            {/* TOP CONTROLS ROW: Add Vendor + Batch Settings */}
            {/* ================================================================ */}
            {/* ================================================================ */}
            {/* CURRENCY SELECTOR — Sleek Inline Bar */}
            {/* ================================================================ */}
            {currencyOptions.length >= 1 && (
                <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                    {/* Active currency accent bar */}
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors duration-300",
                        currencyFilter !== 'ALL' 
                            ? 'bg-gradient-to-b from-[#4F6A64] to-[#82A094]'
                            : 'bg-gradient-to-b from-[#B18E63] to-[#976E44]'
                    )} />
                    <div className="px-6 py-4 flex items-center gap-4">
                        {/* Label */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300",
                                currencyFilter !== 'ALL'
                                    ? 'bg-gradient-to-br from-[#4F6A64] to-[#82A094]'
                                    : 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]'
                            )}>
                                <Filter className="w-4 h-4 text-white" />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-xs font-bold text-slate-600">Currency</p>
                                <p className="text-[9px] text-slate-400 font-medium">
                                    {currencyFilter !== 'ALL' ? `${filteredAccounts.length} vendors` : `${accounts.length} total`}
                                </p>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="w-px h-8 bg-slate-100 shrink-0" />

                        {/* Pills */}
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                            <button
                                onClick={() => setCurrencyFilter('ALL')}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 border",
                                    currencyFilter === 'ALL'
                                        ? 'bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white border-transparent shadow-md shadow-[#B18E63]/20'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#B18E63]/40 hover:text-[#976E44] hover:bg-white hover:shadow-sm'
                                )}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                All
                                <span className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-md font-black tabular-nums",
                                    currencyFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-slate-400'
                                )}>
                                    {accounts.length}
                                </span>
                            </button>
                            {currencyOptions.map(({ currency, count }) => {
                                const icon = CURRENCY_SYMBOLS[currency] || currency.slice(0, 1);
                                return (
                                    <button
                                        key={currency}
                                        onClick={() => setCurrencyFilter(currency)}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 border",
                                            currencyFilter === currency
                                                ? 'bg-gradient-to-r from-[#4F6A64] to-[#82A094] text-white border-transparent shadow-md shadow-[#82A094]/20'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#82A094]/40 hover:text-[#4F6A64] hover:bg-white hover:shadow-sm'
                                        )}
                                    >
                                        <span className="text-xs font-black">{icon}</span>
                                        {currency}
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-md font-black tabular-nums",
                                            currencyFilter === currency ? 'bg-white/20 text-white' : 'bg-white text-slate-400'
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Clear filter */}
                        {currencyFilter !== 'ALL' && (
                            <button
                                onClick={() => setCurrencyFilter('ALL')}
                                className="shrink-0 text-[10px] text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                            >
                                <X className="w-3 h-3" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Add Vendor Card — takes more space */}
                <div className="lg:col-span-7 relative z-30">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-visible">
                        <div className={cn(
                            "px-6 py-4 flex items-center justify-between rounded-t-2xl",
                            currencyFilter !== 'ALL' 
                                ? 'bg-gradient-to-r from-[#4F6A64] to-[#82A094]'
                                : 'bg-gradient-to-r from-[#B18E63] to-[#976E44]'
                        )}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                                        Add Vendor
                                        {currencyFilter !== 'ALL' && (
                                            <span className="text-[10px] bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg font-black tracking-wide">
                                                {CURRENCY_SYMBOLS[currencyFilter] || ''} {currencyFilter}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-[10px] text-white/60 font-medium">
                                        {currencyFilter !== 'ALL' 
                                            ? `Showing only ${currencyFilter} vendor accounts`
                                            : 'Search & select beneficiary to add to payment batch'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <p className="text-[10px] text-white/80 font-semibold">
                                        {filteredAccounts.length} vendors
                                    </p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
                                    onClick={loadBankAccounts}
                                    disabled={loading}
                                    title="Refresh Vendors"
                                >
                                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Custom Vendor Search Dropdown */}
                            <div ref={dropdownRef} className="relative">
                                {/* Search Trigger / Input */}
                                <div
                                    className={cn(
                                        "w-full flex items-center gap-3 bg-slate-50/80 border rounded-xl h-14 px-4 cursor-pointer transition-all",
                                        openDropdown ? 'border-[#B18E63] ring-2 ring-[#B18E63]/20 bg-white shadow-lg' : 'border-slate-200 hover:border-[#B18E63]/50 hover:bg-white hover:shadow-md'
                                    )}
                                    onClick={() => setOpenDropdown(true)}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-[#B18E63] shrink-0" />
                                    ) : (
                                        <Search className="w-5 h-5 text-slate-400 shrink-0" />
                                    )}
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={loading ? 'Loading vendors...' : 'Search by vendor name, BP code, account number, bank name, or IFSC...'}
                                        className="flex-1 bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none"
                                        value={vendorSearchQuery}
                                        onChange={(e) => {
                                            setVendorSearchQuery(e.target.value);
                                            if (!openDropdown) setOpenDropdown(true);
                                        }}
                                        onFocus={() => setOpenDropdown(true)}
                                        disabled={loading}
                                    />
                                    {vendorSearchQuery && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setVendorSearchQuery('');
                                            }}
                                            className="p-1 rounded-lg hover:bg-slate-200 transition-colors"
                                        >
                                            <X className="w-4 h-4 text-slate-400" />
                                        </button>
                                    )}
                                    <ChevronDown className={cn(
                                        "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                                        openDropdown && 'rotate-180'
                                    )} />
                                </div>

                                {/* Dropdown List */}
                                {openDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {filteredAccounts.length > 0 ? (
                                                filteredAccounts.map((a, idx) => (
                                                    <div
                                                        key={a.id}
                                                        onClick={() => {
                                                            addVendor(a);
                                                            setOpenDropdown(false);
                                                            setVendorSearchQuery('');
                                                        }}
                                                        className={cn(
                                                            "px-5 py-3.5 cursor-pointer transition-all hover:bg-[#B18E63]/5 group/item",
                                                            idx < filteredAccounts.length - 1 && 'border-b border-slate-50'
                                                        )}
                                                    >
                                                        {/* Row 1: Vendor Name + Account Type Badge */}
                                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                                            <span className="font-bold text-sm text-slate-700 group-hover/item:text-[#976E44] transition-colors truncate">
                                                                {a.vendorName}
                                                            </span>
                                                        </div>

                                                        {/* Row 2: Bank Name + Account Number + IFSC */}
                                                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-1.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                                                                <span className="font-medium truncate max-w-[160px]">{a.beneficiaryBankName}</span>
                                                            </div>
                                                            <span className="text-slate-200">•</span>
                                                            <span className="font-mono text-slate-500">{a.accountNumber}</span>
                                                            <span className="text-slate-200">•</span>
                                                            <span className="font-mono text-[#6F8A9D] font-semibold">{a.ifscCode}</span>
                                                        </div>

                                                        {/* Row 3: BP Code + Currency + MSME */}
                                                        <div className="flex items-center gap-2">
                                                            {a.bpCode && (
                                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-tight">
                                                                    BP: {a.bpCode}
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-[#4F6A64] bg-[#82A094]/10 px-2 py-0.5 rounded-md font-bold uppercase">
                                                                <span className="font-black">{CURRENCY_SYMBOLS[(a.currency || 'INR').toUpperCase()] || ''}</span>
                                                                {a.currency || 'INR'}
                                                            </span>
                                                            {a.isMSME && (
                                                                <span className="text-[10px] text-[#CE9F6B] bg-[#CE9F6B]/10 px-2 py-0.5 rounded-md font-bold uppercase">
                                                                    MSME
                                                                </span>
                                                            )}
                                                            {a.accountType && (
                                                                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                                                                    {a.accountType}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 py-10">
                                                    <Search className="w-10 h-10 text-slate-200" />
                                                    <p className="text-sm text-slate-400 font-medium">No matching vendors found</p>
                                                    <p className="text-xs text-slate-300">Try a different search term</p>
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer */}
                                        <div className="border-t border-slate-100 px-5 py-2.5 bg-slate-50/50 flex items-center justify-between">
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                Showing {filteredAccounts.length} of {accounts.length} vendors
                                                {currencyFilter !== 'ALL' && (
                                                    <span className="ml-1.5 text-[#4F6A64] font-bold">• {currencyFilter}</span>
                                                )}
                                            </p>
                                            {currencyFilter !== 'ALL' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setCurrencyFilter('ALL'); }}
                                                    className="text-[10px] text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                    Clear filter
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Batch Settings Card */}
                <div className="lg:col-span-5">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden h-full">
                        <div className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] px-6 py-4 flex items-center gap-3 rounded-t-2xl">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Batch Settings</h3>
                                <p className="text-[10px] text-white/60 font-medium">Apply to all payment rows at once</p>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                                        <CalendarIcon className="w-3 h-3" />
                                        Value Date
                                    </label>
                                    <Input 
                                        type="date" 
                                        className="bg-slate-50/80 border-slate-200 h-12 text-sm font-medium rounded-xl hover:border-[#6F8A9D]/40 transition-colors"
                                        value={globalDate}
                                        onChange={(e) => setGlobalDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                                        <Zap className="w-3 h-3" />
                                        Transaction Mode
                                    </label>
                                    <Select value={globalMode} onValueChange={(v: any) => setGlobalMode(v)}>
                                        <SelectTrigger className="bg-slate-50/80 border-slate-200 h-12 text-sm font-medium rounded-xl hover:border-[#6F8A9D]/40 transition-colors">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NFT" className="text-sm">NEFT (NFT)</SelectItem>
                                            <SelectItem value="RTI" className="text-sm">RTGS (RTI)</SelectItem>
                                            <SelectItem value="FT" className="text-sm">Same Bank (FT)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* ICICI Ben Email IDs */}
                            {exportFormat === 'ICICI' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                                        <Mail className="w-3 h-3" />
                                        Ben Email ID
                                        <span className="ml-auto text-[9px] bg-[#B18E63]/10 text-[#976E44] px-2 py-0.5 rounded-md font-bold">ICICI CMS</span>
                                    </label>
                                    {/* Email tags */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-slate-50/80 border border-slate-200 rounded-xl">
                                        {benEmailIds.map((email, idx) => (
                                            editingEmailIdx === idx ? (
                                                <div key={idx} className="flex items-center gap-1">
                                                    <input
                                                        autoFocus
                                                        type="email"
                                                        value={editingEmailValue}
                                                        onChange={e => setEditingEmailValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                const v = editingEmailValue.trim();
                                                                if (v) setBenEmailIds(prev => prev.map((em, i) => i === idx ? v : em));
                                                                setEditingEmailIdx(null);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingEmailIdx(null);
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            const v = editingEmailValue.trim();
                                                            if (v) setBenEmailIds(prev => prev.map((em, i) => i === idx ? v : em));
                                                            setEditingEmailIdx(null);
                                                        }}
                                                        className="text-[11px] font-medium px-2 py-1 border border-[#B18E63]/50 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#B18E63]/30 text-slate-700 min-w-[160px]"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    key={idx}
                                                    className="group/tag flex items-center gap-1 bg-white border border-[#B18E63]/30 rounded-lg px-2 py-1 text-[11px] font-medium text-[#976E44] hover:border-[#B18E63]/60 transition-all cursor-default"
                                                >
                                                    <Mail className="w-2.5 h-2.5 shrink-0 text-[#B18E63]/60" />
                                                    <span className="max-w-[150px] truncate">{email}</span>
                                                    <button
                                                        onClick={() => { setEditingEmailIdx(idx); setEditingEmailValue(email); }}
                                                        className="ml-0.5 text-slate-300 hover:text-[#B18E63] transition-colors opacity-0 group-hover/tag:opacity-100"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </button>
                                                    {benEmailIds.length > 1 && (
                                                        <button
                                                            onClick={() => setBenEmailIds(prev => prev.filter((_, i) => i !== idx))}
                                                            className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/tag:opacity-100"
                                                            title="Remove"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        ))}
                                    </div>
                                    {/* Add new email */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="email"
                                            placeholder="Add email address..."
                                            value={newEmailInput}
                                            onChange={e => setNewEmailInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const v = newEmailInput.trim();
                                                    if (v && !benEmailIds.includes(v)) {
                                                        setBenEmailIds(prev => [...prev, v]);
                                                        setNewEmailInput('');
                                                    }
                                                }
                                            }}
                                            className="flex-1 text-[11px] font-medium px-3 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-1 focus:ring-[#B18E63]/30 focus:border-[#B18E63]/50 text-slate-700 placeholder:text-slate-300 transition-all h-9"
                                        />
                                        <button
                                            onClick={() => {
                                                const v = newEmailInput.trim();
                                                if (v && !benEmailIds.includes(v)) {
                                                    setBenEmailIds(prev => [...prev, v]);
                                                    setNewEmailInput('');
                                                }
                                            }}
                                            disabled={!newEmailInput.trim()}
                                            className="h-9 px-3 rounded-xl bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            <Button 
                                variant="secondary" 
                                className="w-full bg-[#6F8A9D]/10 hover:bg-[#6F8A9D]/20 text-[#546A7A] border-0 font-bold text-sm h-12 rounded-xl transition-all hover:scale-[1.01]" 
                                onClick={applyGlobalSettings}
                                disabled={pendingPayments.length === 0}
                            >
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Apply to All Rows
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================ */}
            {/* PAYMENT TABLE — Full Width */}
            {/* ================================================================ */}
            <div className="space-y-5">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                        
                        {/* Table Header Bar */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#B18E63] to-[#976E44] flex items-center justify-center">
                                    <List className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-700">Payment Queue</h3>
                                    <p className="text-[10px] text-slate-400">{pendingPayments.length} entries pending</p>
                                </div>
                            </div>
                            {pendingPayments.length > 0 && (
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 font-bold text-[11px] rounded-lg h-8"
                                    onClick={() => {
                                        if(confirm('Are you sure you want to clear all pending payments?')) {
                                            setPendingPayments([]);
                                            toast.success('All payments cleared');
                                        }
                                    }}
                                >
                                    <Trash2 className="w-3 h-3 mr-1.5" />
                                    Clear All
                                </Button>
                            )}
                        </div>

                        {/* Table Content */}
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/80 border-slate-100 hover:bg-slate-50/80">
                                        <TableHead className="w-[50px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5 text-center">#</TableHead>
                                        <TableHead className="w-[260px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-3 h-3" /> Vendor & Account
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[160px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <IndianRupee className="w-3 h-3" /> Amount
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[160px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <CalendarIcon className="w-3 h-3" /> Value Date
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[140px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5 text-center">
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <Zap className="w-3 h-3" /> Mode
                                            </div>
                                        </TableHead>

                                        <TableHead className="text-right w-[70px] text-slate-400 font-bold uppercase text-[10px] tracking-wider py-3.5">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingPayments.length > 0 ? (
                                        pendingPayments.map((p, index) => (
                                            <TableRow 
                                                key={p.tempId} 
                                                className={cn(
                                                    "group transition-all duration-200 border-slate-50",
                                                    index % 2 === 0 ? 'bg-white' : 'bg-slate-25',
                                                    "hover:bg-gradient-to-r hover:from-[#CE9F6B]/[0.03] hover:to-transparent"
                                                )}
                                            >
                                                {/* Row Number */}
                                                <TableCell className="py-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-400 group-hover:bg-[#B18E63]/10 group-hover:text-[#B18E63] transition-colors">
                                                        {index + 1}
                                                    </span>
                                                </TableCell>

                                                {/* Vendor & Account */}
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                                                            {p.vendorName?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm text-slate-700 truncate">{p.vendorName}</span>
                                                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#82A094]/10 text-[#4F6A64] shrink-0">
                                                                    {CURRENCY_SYMBOLS[(p.bankAccount.currency || 'INR').toUpperCase()] || ''} {(p.bankAccount.currency || 'INR').toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                                                <Wallet className="w-3 h-3 shrink-0" /> 
                                                                <span className="truncate">{p.accountNumber}</span>
                                                                <span className="text-slate-200">•</span>
                                                                <span className="text-[#B18E63] font-bold">{p.ifscCode}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Amount */}
                                                <TableCell className="py-4">
                                                    <div className="relative group/input">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold transition-colors group-focus-within/input:text-[#B18E63]">{activeCurrencySymbol}</span>
                                                        <Input 
                                                            type="number" 
                                                            className={cn(
                                                                "pl-7 h-11 text-sm font-bold tabular-nums border-slate-200 transition-all shadow-none rounded-xl",
                                                                "bg-slate-50/50 focus:bg-white focus:border-[#B18E63]/40 focus:ring-1 focus:ring-[#B18E63]/20",
                                                                (p.amount ?? 0) > 0 ? "text-slate-800" : "text-slate-400"
                                                            )}
                                                            placeholder="0.00"
                                                            value={p.amount || ''}
                                                            onChange={(e) => updatePayment(p.tempId, { amount: parseFloat(e.target.value) || 0 })}
                                                        />
                                                        {(p.amount ?? 0) > 0 && (
                                                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Value Date */}
                                                <TableCell className="py-4">
                                                    <Input 
                                                        type="date" 
                                                        className="h-11 text-xs font-medium bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#6F8A9D]/40 focus:ring-1 focus:ring-[#6F8A9D]/20 transition-all shadow-none rounded-xl"
                                                        value={p.valueDate ? format(p.valueDate, 'yyyy-MM-dd') : ''}
                                                        onChange={(e) => updatePayment(p.tempId, { valueDate: new Date(e.target.value) })}
                                                    />
                                                </TableCell>

                                                {/* Mode */}
                                                <TableCell className="py-4">
                                                    <Select 
                                                        value={p.transactionMode} 
                                                        onValueChange={(v: any) => updatePayment(p.tempId, { transactionMode: v })}
                                                    >
                                                        <SelectTrigger className="h-11 text-xs font-bold bg-slate-50/50 border-slate-200 focus:bg-white transition-all shadow-none rounded-xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="NFT" className="text-xs font-medium">NEFT</SelectItem>
                                                            <SelectItem value="RTI" className="text-xs font-medium">RTGS</SelectItem>
                                                            <SelectItem value="FT" className="text-xs font-medium">Same Bank</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>


                                                {/* Action */}
                                                <TableCell className="text-right py-4">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl opacity-50 group-hover:opacity-100"
                                                        onClick={() => removePayment(p.tempId)}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-72 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-5">
                                                    <div className="relative">
                                                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center border-2 border-dashed border-slate-200">
                                                            <Send className="w-10 h-10 text-slate-200" />
                                                        </div>
                                                        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-xl bg-[#B18E63]/10 flex items-center justify-center">
                                                            <Plus className="w-4 h-4 text-[#B18E63]" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 text-center">
                                                        <p className="font-bold text-slate-500 text-base">No payments added yet</p>
                                                        <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
                                                            Select vendors from the sidebar to start building your batch payment file.
                                                        </p>
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="text-[#B18E63] border-[#B18E63]/30 hover:bg-[#B18E63]/5 rounded-xl font-bold text-xs"
                                                        onClick={() => setOpenDropdown(true)}
                                                    >
                                                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                                                        Add First Vendor
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* -------------------------------------------------------- */}
                    {/* SUMMARY FOOTER BAR */}
                    {/* -------------------------------------------------------- */}
                    {pendingPayments.length > 0 && (
                        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                            {/* Accent top bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B18E63] via-[#82A094] to-[#6F8A9D]" />
                            
                            <div className="flex items-center justify-between p-5 pt-6">
                                <div className="flex items-center gap-8 lg:gap-14">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1">
                                            <Hash className="w-3 h-3" /> Total Entries
                                        </p>
                                        <p className="font-black text-2xl text-slate-700 tabular-nums">{pendingPayments.length}</p>
                                    </div>
                                    <div className="w-px h-10 bg-slate-100" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1">
                                            <Building2 className="w-3 h-3" /> Vendors
                                        </p>
                                        <p className="font-black text-2xl text-[#6F8A9D] tabular-nums">{stats.selectedVendors}</p>
                                    </div>
                                    <div className="w-px h-10 bg-slate-100" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1">
                                            <IndianRupee className="w-3 h-3" /> Total Disbursement
                                        </p>
                                        <p className="font-black text-2xl text-[#B18E63] tabular-nums">
                                            {activeCurrencySymbol}{stats.totalAmount.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    {stats.validPayments < stats.totalRecords && (
                                        <>
                                            <div className="w-px h-10 bg-slate-100" />
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                                <p className="text-[11px] text-amber-700 font-bold">
                                                    {stats.totalRecords - stats.validPayments} row{stats.totalRecords - stats.validPayments > 1 ? 's' : ''} missing amount
                                                </p>
                                            </div>
                                        </>
                                    )}
                                    {currencyFilter !== 'ALL' && (
                                        <>
                                            <div className="w-px h-10 bg-slate-100" />
                                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#82A094]/10 border border-[#82A094]/20">
                                                <span className="text-sm font-black text-[#4F6A64]">{activeCurrencySymbol}</span>
                                                <p className="text-[11px] text-[#4F6A64] font-bold">
                                                    {currencyFilter} Batch
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        variant="ghost" 
                                        className="text-red-400 hover:text-red-500 hover:bg-red-50 font-bold text-xs rounded-xl h-10" 
                                        onClick={() => {
                                            if(confirm('Clear all pending payments?')) {
                                                setPendingPayments([]);
                                                toast.success('All payments cleared');
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}
