'use client';

import { useState, useEffect, useMemo } from 'react';
import { arApi, BankAccount } from '@/lib/ar-api';
import { 
  Plus, Search, Trash2, Download, Landmark, CreditCard, 
  Calendar as CalendarIcon, ArrowLeft, Loader2, CheckCircle2,
  X, Info, Wallet, DollarSign, ChevronDown, RefreshCcw, Check, Building2,
  Shield, Globe, Power, Eye, Pencil, List
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { downloadICICICMS, downloadStandardPayment, PaymentRow } from '@/lib/payment-excel-utils';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from 'sonner';


interface PendingPayment extends Partial<PaymentRow> {
    tempId: string;
    bankAccount: BankAccount;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  loading,
  variant,
  href
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  loading: boolean;
  variant: 'primary' | 'success' | 'secondary' | 'warning';
  href?: string;
}) => {
  const variants = {
    primary: {
      card: 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white',
      icon: 'bg-white/20 text-white shadow-sm',
      label: 'text-white/80',
      value: 'text-white'
    },
    success: {
      card: 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white',
      icon: 'bg-white/20 text-white shadow-sm',
      label: 'text-white/80',
      value: 'text-white'
    },
    secondary: {
      card: 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] text-white',
      icon: 'bg-white/20 text-white shadow-sm',
      label: 'text-white/80',
      value: 'text-white'
    },
    warning: {
      card: 'bg-gradient-to-br from-[#E17F70] to-[#9E3B47] text-white',
      icon: 'bg-white/20 text-white shadow-sm',
      label: 'text-white/80',
      value: 'text-white'
    }
  };

  const v = variants[variant];

  const Content = (
    <div className={`group relative rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${v.card} ${href ? 'cursor-pointer' : ''}`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="relative flex items-center justify-between gap-4">
        <div className={`w-11 h-11 rounded-xl ${v.icon} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-right">
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${v.label}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums ${v.value}`}>
            {loading ? (
              <span className="inline-block w-8 h-7 bg-current/20 rounded animate-pulse" />
            ) : value}
          </p>
        </div>
      </div>
      
      {href && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/20 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
      )}
    </div>
  );

  if (href) return <Link href={href}>{Content}</Link>;
  return Content;
};

export default function PaymentsPage() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [openDropdown, setOpenDropdown] = useState(false);
    const [globalDate, setGlobalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [globalMode, setGlobalMode] = useState<'NFT' | 'RTI' | 'FT'>('NFT');


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
        setSearchQuery('');
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

    const handleDownload = async (formatType: 'ICICI' | 'STANDARD') => {
        if (pendingPayments.length === 0) {
            toast.error('Add at least one payment to download');
            return;
        }

        // Validate amounts
        const invalid = pendingPayments.some(p => !p.amount || p.amount <= 0);
        if (invalid) {
            toast.error('All payments must have an amount greater than zero');
            return;
        }

        const data: PaymentRow[] = pendingPayments.map(p => ({
            vendorName: p.vendorName!,
            bpCode: p.bpCode!,
            accountNumber: p.accountNumber!,
            ifscCode: p.ifscCode!,
            bankName: p.bankName!,
            amount: p.amount!,
            emailId: p.emailId!,
            valueDate: p.valueDate!,
            transactionMode: p.transactionMode!,
            accountType: p.accountType!
        }));

        try {
            if (formatType === 'ICICI') {
                await downloadICICICMS(data);
            } else {
                await downloadStandardPayment(data);
            }
            toast.success(`${formatType === 'ICICI' ? 'ICICI CMS' : 'Standard'} format downloaded`);
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('Failed to generate Excel file');
        }
    };




    const stats = useMemo(() => ({
        totalRecords: pendingPayments.length,
        selectedVendors: new Set(pendingPayments.map(p => p.bankAccount.id)).size,
        totalAmount: pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    }), [pendingPayments]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-br from-[#CE9F6B]/30 to-[#82A094]/30 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                        <div 
                            className="relative w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
                            style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
                        >
                            <CreditCard className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Link href="/finance/bank-accounts" className="hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Accounts
                            </Link>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                                Bulk Payments
                            </span>
                        </h1>
                        <p className="text-xs text-muted-foreground font-medium">
                            Execute batch transfers and reporting with ICICI CMS & Standard formats
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="lg" 
                        onClick={() => handleDownload('ICICI')}
                        className="bg-background hover:bg-[#CE9F6B]/10 hover:text-[#976E44] border-[#CE9F6B]/30 border-dashed"
                    >
                        <Download className="w-4 h-4 mr-2" /> ICICI CMS
                    </Button>
                    <Button 
                        size="lg" 
                        onClick={() => handleDownload('STANDARD')}
                        className="bg-gradient-to-r from-[#B18E63] to-[#7A5A38] text-white shadow-lg hover:shadow-xl transition-all border-0"
                    >
                        <Download className="w-4 h-4 mr-2" /> Standard Format
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    icon={List} 
                    label="Total Records" 
                    value={stats.totalRecords} 
                    loading={false}
                    variant="primary"
                />
                <StatCard 
                    icon={Building2} 
                    label="Selected Vendors" 
                    value={stats.selectedVendors} 
                    loading={false}
                    variant="secondary"
                />
                <StatCard 
                    icon={DollarSign} 
                    label="Total Amount" 
                    value={`₹${stats.totalAmount.toLocaleString()}`} 
                    loading={false}
                    variant="success"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Side: Controls & Selection */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Add Vendor Card */}
                    <div className="bg-white rounded-2xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="bg-gradient-to-r from-[#B18E63] to-[#976E44] px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-white" />
                                </div>
                                <h3 className="font-bold text-white text-sm">Add Vendor</h3>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                                onClick={loadBankAccounts}
                                disabled={loading}
                                title="Refresh Vendors"
                            >
                                <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            <Popover open={openDropdown} onOpenChange={setOpenDropdown}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        role="combobox"
                                        aria-expanded={openDropdown}
                                        className="w-full justify-between bg-slate-50 border-dashed border-slate-200 hover:border-[#B18E63]/50 transition-all font-medium text-slate-500 h-11"
                                        disabled={loading}
                                    >
                                        <div className="flex items-center gap-2">
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Search className="w-4 h-4 text-slate-400" />
                                            )}
                                            <span className="text-xs">{loading ? 'Loading Vendors...' : 'Search vendor name...'}</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Type vendor name or BP code..." className="h-10 text-xs" />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No matching vendors found</CommandEmpty>
                                            <CommandGroup>
                                                {accounts.map(a => (
                                                    <CommandItem
                                                        key={a.id}
                                                        value={`${a.vendorName} ${a.bpCode} ${a.accountNumber} ${a.beneficiaryBankName || ''}`}
                                                        onSelect={() => {
                                                            addVendor(a);
                                                            setOpenDropdown(false);
                                                        }}
                                                        className="flex flex-col items-start gap-1 py-3 cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                                                    >
                                                        <div className="w-full flex justify-between items-start gap-2">
                                                            <span className="font-bold text-xs text-slate-700 leading-tight">{a.vendorName}</span>
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#B18E63]/10 text-[#976E44] font-bold uppercase tracking-wider shrink-0">
                                                                {a.accountType || 'Domestic'}
                                                            </span>
                                                        </div>
                                                        <div className="w-full flex items-center gap-2 text-[10px] text-slate-400">
                                                            <div className="flex items-center gap-1 font-mono">
                                                                <Building2 className="w-3 h-3" />
                                                                <span className="truncate max-w-[120px]">{a.beneficiaryBankName}</span>
                                                            </div>
                                                            <span className="text-slate-200">|</span>
                                                            <span className="font-mono">{a.accountNumber}</span>
                                                        </div>
                                                        {a.bpCode && (
                                                            <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                                                                BP: {a.bpCode}
                                                            </span>
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <p className="text-[10px] text-slate-400 text-center italic">
                                Total {accounts.length} verified vendors available
                            </p>
                        </div>
                    </div>

                    {/* Global Settings Card */}
                    <div className="bg-white rounded-2xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="bg-gradient-to-r from-[#E17F70] to-[#C45C4D] px-5 py-4 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <Info className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="font-bold text-white text-sm">Bulk Settings</h3>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Default Value Date</label>
                                <Input 
                                    type="date" 
                                    className="bg-slate-50 border-slate-100 h-10 text-xs font-medium"
                                    value={globalDate}
                                    onChange={(e) => setGlobalDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Default Mode</label>
                                <Select value={globalMode} onValueChange={(v: any) => setGlobalMode(v)}>
                                    <SelectTrigger className="bg-slate-50 border-slate-100 h-10 text-xs font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NFT" className="text-xs">NEFT (NFT)</SelectItem>
                                        <SelectItem value="RTI" className="text-xs">RTGS (RTI)</SelectItem>
                                        <SelectItem value="FT" className="text-xs">Internal (FT)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button 
                                variant="secondary" 
                                className="w-full bg-[#E17F70]/10 hover:bg-[#E17F70]/20 text-[#C45C4D] border-0 font-bold text-xs" 
                                onClick={applyGlobalSettings}
                            >
                                <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                                Apply to All Rows
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Payment Table */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-slate-100 hover:bg-slate-50">
                                    <TableHead className="w-[240px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">Vendor & Account</TableHead>
                                    <TableHead className="w-[140px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">Amount (₹)</TableHead>
                                    <TableHead className="w-[160px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">Value Date</TableHead>
                                    <TableHead className="w-[120px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4 text-center">Mode</TableHead>
                                    <TableHead className="text-right w-[80px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingPayments.length > 0 ? (
                                    pendingPayments.map((p) => (
                                        <TableRow key={p.tempId} className="group hover:bg-slate-50/50 transition-colors border-slate-50">
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-sm text-slate-700">{p.vendorName}</span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                                        <Wallet className="w-3 h-3" /> {p.accountNumber}
                                                        <span className="text-slate-200">|</span>
                                                        <Landmark className="w-3 h-3" /> {p.ifscCode}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="relative group/input">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold transition-colors group-focus-within/input:text-[#B18E63]">₹</span>
                                                    <Input 
                                                        type="number" 
                                                        className="pl-7 h-10 text-sm font-bold tabular-nums bg-slate-50/50 border-slate-100 focus:bg-white transition-all shadow-none"
                                                        value={p.amount}
                                                        onChange={(e) => updatePayment(p.tempId, { amount: parseFloat(e.target.value) })}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Input 
                                                    type="date" 
                                                    className="h-10 text-xs font-medium bg-slate-50/50 border-slate-100 focus:bg-white transition-all shadow-none"
                                                    value={p.valueDate ? format(p.valueDate, 'yyyy-MM-dd') : ''}
                                                    onChange={(e) => updatePayment(p.tempId, { valueDate: new Date(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <Select 
                                                    value={p.transactionMode} 
                                                    onValueChange={(v: any) => updatePayment(p.tempId, { transactionMode: v })}
                                                >
                                                    <SelectTrigger className="h-10 text-xs font-bold bg-slate-50/50 border-slate-100 focus:bg-white transition-all shadow-none">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="NFT" className="text-xs font-medium">NEFT</SelectItem>
                                                        <SelectItem value="RTI" className="text-xs font-medium">RTGS</SelectItem>
                                                        <SelectItem value="FT" className="text-xs font-medium">Fund Trf</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                                                    onClick={() => removePayment(p.tempId)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center border-2 border-dashed border-slate-100">
                                                    <DollarSign className="w-8 h-8 text-slate-200" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-slate-400">Ready to prepare payments?</p>
                                                    <p className="text-xs text-slate-300">Select vendors from the sidebar to populate this list.</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {pendingPayments.length > 0 && (
                        <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                            <div className="flex items-center gap-10">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Entries</p>
                                    <p className="font-black text-2xl text-slate-700 tabular-nums">{pendingPayments.length}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Disbursement</p>
                                    <p className="font-black text-2xl text-[#B18E63] tabular-nums">
                                        ₹{pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                className="text-red-400 hover:text-red-500 hover:bg-red-50 font-bold text-xs" 
                                onClick={() => {
                                    if(confirm('Are you sure you want to clear all pending payments?')) {
                                        setPendingPayments([]);
                                        toast.success('All payments cleared');
                                    }
                                }}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Clear All
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
