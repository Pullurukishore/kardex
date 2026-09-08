'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { arApi, BankAccount, submitPaymentBatch } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import {
    Plus, Search, Trash2, Landmark, CreditCard,
    Calendar as CalendarIcon, ArrowLeft, Loader2, CheckCircle2,
    X, Info, Wallet, DollarSign, RefreshCcw, Check, Building2,
    Shield, Globe, Power, Eye, Pencil, List, Hash, Send,
    Zap, AlertCircle, IndianRupee, Clock, Filter, ChevronDown, Mail,
    FileSpreadsheet, FileText, Banknote, Download, FileCode,
    UserPlus, Sparkles, Copy, RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
    PaymentRow,
    downloadICICICMS, downloadStandardPayment,
    downloadICICICMS_CSV, downloadICICICMS_TXT,
    downloadStandard_CSV, downloadStandard_TXT,
    generateICICICMS_TXT_Content, generateStandard_TXT_Content,
    downloadCustomTextFile
} from '@/lib/payment-excel-utils';
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
    bankAccount?: BankAccount | null;
    isManual?: boolean;
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
    const { user } = useAuth();
    const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;
    const DEFAULT_EMAIL = 'naveen.n@kardex.com';
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
    const [vendorSearchQuery, setVendorSearchQuery] = useState('');
    const [openDropdown, setOpenDropdown] = useState(false);
    const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
    const [globalDate, setGlobalDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [globalMode, setGlobalMode] = useState<'NFT' | 'RTI' | 'FT'>('NFT');
    const [submittingBatch, setSubmittingBatch] = useState(false);
    const [exportFormat, setExportFormat] = useState<'HDFC' | 'DB'>('HDFC');
    const [benEmailIds, setBenEmailIds] = useState<string[]>([DEFAULT_EMAIL]);
    const [newEmailInput, setNewEmailInput] = useState('');
    const [editingEmailIdx, setEditingEmailIdx] = useState<number | null>(null);
    const [editingEmailValue, setEditingEmailValue] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [previewFormat, setPreviewFormat] = useState<'HDFC' | 'DB'>('HDFC');
    const [customFilename, setCustomFilename] = useState('');
    const [showTxtEditModal, setShowTxtEditModal] = useState(false);
    const [txtEditorMode, setTxtEditorMode] = useState<'grid' | 'raw'>('grid');
    const [txtRows, setTxtRows] = useState<PaymentRow[]>([]);
    const [txtContent, setTxtContent] = useState('');
    const [txtFormat, setTxtFormat] = useState<'HDFC' | 'DB'>('HDFC');
    const [txtFilename, setTxtFilename] = useState('');
    const [txtWrap, setTxtWrap] = useState(false);
    const [generatingTxt, setGeneratingTxt] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Click outside handler for vendor dropdown & download menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(false);
            }
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
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
                (a.nickName || '').toLowerCase().includes(q) ||
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
            nickName: account.nickName || '',
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

    const [showManualModal, setShowManualModal] = useState(false);
    const [manualForm, setManualForm] = useState({
        vendorName: '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: '',
        bankName: '',
        accountType: 'Current',
        amount: '',
        transactionMode: 'NFT' as 'NFT' | 'RTI' | 'FT',
        emailId: '',
        nickName: ''
    });

    const detectBankFromIFSC = (ifsc: string): string => {
        const code = ifsc.trim().toUpperCase().substring(0, 4);
        const bankMap: Record<string, string> = {
            'HDFC': 'HDFC Bank',
            'SBIN': 'State Bank of India',
            'ICIC': 'ICICI Bank',
            'UTIB': 'Axis Bank',
            'KKBK': 'Kotak Mahindra Bank',
            'PUNB': 'Punjab National Bank',
            'BARB': 'Bank of Baroda',
            'CNRB': 'Canara Bank',
            'UBIN': 'Union Bank of India',
            'IDIB': 'Indian Bank',
            'INDB': 'IndusInd Bank',
            'YESB': 'Yes Bank',
            'SCBL': 'Standard Chartered Bank',
            'HSBC': 'HSBC',
            'CITI': 'Citibank',
            'DEUT': 'Deutsche Bank',
            'FDRL': 'Federal Bank',
            'IDFB': 'IDFC First Bank',
            'RATN': 'RBL Bank',
            'MAHB': 'Bank of Maharashtra',
            'IOBA': 'Indian Overseas Bank',
            'CIUB': 'City Union Bank',
            'CSBK': 'CSB Bank',
            'KVBL': 'Karur Vysya Bank',
            'SIBL': 'South Indian Bank',
            'TMBL': 'Tamilnad Mercantile Bank',
            'BDBL': 'Bandhan Bank',
            'AUBL': 'AU Small Finance Bank',
            'ESFB': 'Equitas Small Finance Bank',
            'UJVN': 'Ujjivan Small Finance Bank'
        };
        return bankMap[code] || '';
    };

    const handleAddManualPayee = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const { vendorName, accountNumber, confirmAccountNumber, ifscCode, bankName, amount, emailId, transactionMode, accountType, nickName } = manualForm;

        if (!vendorName.trim()) {
            toast.error('Please enter payee / vendor name');
            return;
        }
        if (!accountNumber.trim()) {
            toast.error('Please enter account number');
            return;
        }
        if (confirmAccountNumber.trim() && accountNumber.trim() !== confirmAccountNumber.trim()) {
            toast.error('Account numbers do not match');
            return;
        }
        if (!ifscCode.trim()) {
            toast.error('Please enter IFSC / SWIFT code');
            return;
        }
        if (!bankName.trim()) {
            toast.error('Please enter or verify bank name');
            return;
        }

        const parsedAmount = amount ? parseFloat(amount.replace(/,/g, '')) : 0;

        const newPayment: PendingPayment = {
            tempId: crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
            bankAccount: null,
            isManual: true,
            vendorName: vendorName.trim(),
            bpCode: '',
            nickName: nickName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            bankName: bankName.trim(),
            amount: isNaN(parsedAmount) ? 0 : parsedAmount,
            emailId: emailId.trim(),
            valueDate: new Date(globalDate),
            transactionMode: transactionMode || globalMode,
            accountType: accountType || 'Current'
        };

        setPendingPayments(prev => [...prev, newPayment]);
        setShowManualModal(false);
        setManualForm({
            vendorName: '',
            accountNumber: '',
            confirmAccountNumber: '',
            ifscCode: '',
            bankName: '',
            accountType: 'Current',
            amount: '',
            transactionMode: globalMode,
            emailId: '',
            nickName: ''
        });
        toast.success(`Added "${newPayment.vendorName}" as one-time payee`);
    };

    const updatePayment = (tempId: string, updates: Partial<PendingPayment>) => {
        // If accountNumber is being updated, determine whether it's a secondary or primary account
        if (updates.accountNumber) {
            if (updates.accountNumber.includes('|')) {
                // Secondary account: extract fields from the encoded value
                const [accNum, ifsc, bankName] = updates.accountNumber.split('|');
                updates = {
                    ...updates,
                    accountNumber: updates.accountNumber, // Keep the full encoded value for the Select component
                    ifscCode: ifsc || updates.ifscCode,
                    bankName: bankName || updates.bankName,
                };
            } else {
                // Primary account selected: restore primary bank details
                const payment = pendingPayments.find(p => p.tempId === tempId);
                if (payment && payment.bankAccount) {
                    updates = {
                        ...updates,
                        ifscCode: payment.bankAccount.ifscCode,
                        bankName: payment.bankAccount.beneficiaryBankName || '',
                    };
                }
            }
        }
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
            const items = pendingPayments.map(p => {
                const rawAcc = p.accountNumber || '';
                const cleanAcc = rawAcc.includes('|') ? rawAcc.split('|')[0] : rawAcc;
                const cleanIfsc = rawAcc.includes('|') ? rawAcc.split('|')[1] : p.ifscCode;
                const cleanBank = rawAcc.includes('|') ? rawAcc.split('|')[2] : p.bankName;
                return {
                    bankAccountId: p.bankAccount?.id || undefined,
                    isManual: !!p.isManual,
                    vendorName: p.vendorName!,
                    accountNumber: cleanAcc,
                    ifscCode: cleanIfsc!,
                    bankName: cleanBank!,
                    bpCode: p.bpCode || undefined,
                    emailId: exportFormat === 'HDFC'
                        ? (Array.from(new Set([p.emailId?.trim(), ...benEmailIds].filter(Boolean))).join(';').substring(0, 100) || undefined)
                        : (p.emailId || undefined),
                    accountType: p.accountType || undefined,
                    amount: p.amount!,
                    transactionMode: p.transactionMode!,
                    valueDate: p.valueDate ? p.valueDate.toISOString() : new Date().toISOString(),
                };
            });

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
        selectedVendors: new Set(pendingPayments.map(p => p.bankAccount?.id || p.accountNumber || p.tempId)).size,
        totalAmount: pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
        validPayments: pendingPayments.filter(p => p.amount && p.amount > 0).length,
    }), [pendingPayments]);

    // Dynamic currency symbol helper
    const CURRENCY_SYMBOLS: Record<string, string> = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'AED': 'د.إ', 'SGD': 'S$', 'CHF': 'Fr', 'AUD': 'A$', 'CAD': 'C$' };
    const activeCurrencySymbol = currencyFilter !== 'ALL' ? (CURRENCY_SYMBOLS[currencyFilter] || currencyFilter) : '₹';
    const activeCurrencyCode = currencyFilter !== 'ALL' ? currencyFilter : 'INR';

    // Build PaymentRow[] from pending payments — used for both preview and download
    const buildPaymentRows = useCallback((): PaymentRow[] => {
        return pendingPayments
            .filter(p => p.amount && p.amount > 0)
            .map(p => {
                const rawAcc = p.accountNumber || '';
                const cleanAcc = rawAcc.includes('|') ? rawAcc.split('|')[0] : rawAcc;
                const cleanIfsc = rawAcc.includes('|') ? rawAcc.split('|')[1] : p.ifscCode;
                const cleanBank = rawAcc.includes('|') ? rawAcc.split('|')[2] : p.bankName;
                return {
                    vendorName: p.vendorName!,
                    bpCode: p.bpCode || '',
                    nickName: (p.bankAccount as any)?.nickName || p.nickName || '',
                    accountNumber: cleanAcc,
                    ifscCode: cleanIfsc!,
                    bankName: cleanBank!,
                    amount: p.amount!,
                    emailId: exportFormat === 'HDFC'
                        ? Array.from(new Set([p.emailId?.trim(), ...benEmailIds].filter(Boolean))).join(';').substring(0, 100)
                        : (p.emailId || ''),
                    valueDate: p.valueDate || new Date(),
                    transactionMode: (p.transactionMode as 'NFT' | 'RTI' | 'FT') || 'NFT',
                    accountType: p.accountType || ''
                };
            });
    }, [pendingPayments, exportFormat, benEmailIds]);

    const handleLocalDownload = async (format: 'HDFC' | 'DB', subFormat: 'EXCEL' | 'CSV' | 'TXT') => {
        const rows = buildPaymentRows();
        if (rows.length === 0) {
            toast.error('No valid payments to download. Please enter amounts first.');
            return;
        }
        setShowDownloadMenu(false);
        const fname = customFilename.trim() || undefined;
        try {
            if (format === 'HDFC') {
                if (subFormat === 'CSV') await downloadICICICMS_CSV(rows, fname);
                else if (subFormat === 'TXT') await downloadICICICMS_TXT(rows, fname);
                else await downloadICICICMS(rows, fname);
            } else {
                if (subFormat === 'CSV') await downloadStandard_CSV(rows, fname);
                else if (subFormat === 'TXT') await downloadStandard_TXT(rows, fname);
                else await downloadStandardPayment(rows, fname);
            }
            toast.success('Payment file downloaded!');
        } catch {
            toast.error('Download failed');
        }
    };

    const handleOpenTxtEditor = async (formatToUse: 'HDFC' | 'DB') => {
        const rows = buildPaymentRows();
        if (rows.length === 0) {
            toast.error('No valid payments to export. Please enter amounts first.');
            return;
        }
        setGeneratingTxt(true);
        try {
            const cloned = rows.map(r => ({ ...r }));
            setTxtRows(cloned);
            setTxtEditorMode('grid');
            const content = formatToUse === 'HDFC'
                ? await generateICICICMS_TXT_Content(cloned)
                : await generateStandard_TXT_Content(cloned);
            const defaultName = customFilename.trim()
                ? (customFilename.endsWith('.txt') ? customFilename : `${customFilename}.txt`)
                : (formatToUse === 'HDFC' ? `HDFC_Data_${format(new Date(), 'yyyyMMdd')}.txt` : `DB_Payment_Data_${format(new Date(), 'yyyyMMdd')}.txt`);
            setTxtFormat(formatToUse);
            setTxtContent(content);
            setTxtFilename(defaultName);
            setShowTxtEditModal(true);
        } catch (error) {
            console.error('Failed to generate TXT content:', error);
            toast.error('Failed to generate TXT file content');
        } finally {
            setGeneratingTxt(false);
        }
    };

    const updateTxtRow = async (idx: number, updates: Partial<PaymentRow>) => {
        const updated = [...txtRows];
        updated[idx] = { ...updated[idx], ...updates };
        setTxtRows(updated);
        try {
            const content = txtFormat === 'HDFC'
                ? await generateICICICMS_TXT_Content(updated)
                : await generateStandard_TXT_Content(updated);
            setTxtContent(content);
        } catch (e) {
            console.error(e);
        }
    };

    const removeTxtRow = async (idx: number) => {
        if (txtRows.length <= 1) {
            toast.error('TXT file must contain at least one payment row');
            return;
        }
        const updated = txtRows.filter((_, i) => i !== idx);
        setTxtRows(updated);
        try {
            const content = txtFormat === 'HDFC'
                ? await generateICICICMS_TXT_Content(updated)
                : await generateStandard_TXT_Content(updated);
            setTxtContent(content);
            toast.info('Row removed from TXT file');
        } catch (e) {
            console.error(e);
        }
    };

    const addTxtRow = async () => {
        const newRow: PaymentRow = {
            vendorName: 'Manual Payee',
            bpCode: '',
            nickName: 'MANUAL',
            accountNumber: '',
            ifscCode: '',
            bankName: '',
            amount: 0,
            emailId: '',
            valueDate: new Date(globalDate),
            transactionMode: globalMode || 'NFT',
            accountType: 'Current'
        };
        const updated = [...txtRows, newRow];
        setTxtRows(updated);
        try {
            const content = txtFormat === 'HDFC'
                ? await generateICICICMS_TXT_Content(updated)
                : await generateStandard_TXT_Content(updated);
            setTxtContent(content);
            toast.success('Added new row to TXT file');
        } catch (e) {
            console.error(e);
        }
    };

    const handleDownloadEditedTxt = () => {
        if (!txtContent.trim()) {
            toast.error('TXT file content cannot be empty');
            return;
        }
        downloadCustomTextFile(txtContent, txtFilename || `${txtFormat}_Payment.txt`);
        setShowTxtEditModal(false);
        toast.success(`Downloaded edited ${txtFormat} TXT file!`);
    };

    const handleSwitchTxtFormat = async (newFormat: 'HDFC' | 'DB') => {
        setTxtFormat(newFormat);
        try {
            const rowsToUse = txtRows.length > 0 ? txtRows : buildPaymentRows();
            const content = newFormat === 'HDFC'
                ? await generateICICICMS_TXT_Content(rowsToUse)
                : await generateStandard_TXT_Content(rowsToUse);
            setTxtContent(content);
            const defaultName = customFilename.trim()
                ? (customFilename.endsWith('.txt') ? customFilename : `${customFilename}.txt`)
                : (newFormat === 'HDFC' ? `HDFC_Data_${format(new Date(), 'yyyyMMdd')}.txt` : `DB_Payment_Data_${format(new Date(), 'yyyyMMdd')}.txt`);
            setTxtFilename(defaultName);
            toast.info(`Switched to ${newFormat} TXT format`);
        } catch {
            toast.error('Failed to switch format');
        }
    };

    const handleRegenerateTxt = async () => {
        const rows = buildPaymentRows();
        const cloned = rows.map(r => ({ ...r }));
        setTxtRows(cloned);
        try {
            const content = txtFormat === 'HDFC'
                ? await generateICICICMS_TXT_Content(cloned)
                : await generateStandard_TXT_Content(cloned);
            setTxtContent(content);
            toast.info('TXT content reset to freshly generated payment data');
        } catch {
            toast.error('Failed to reload TXT content');
        }
    };

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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ================================================================ */}
            {/* HEADER SECTION */}
            {/* ================================================================ */}
            {/* SECTION ① — HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 lg:gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                        <div className="absolute -inset-1.5 bg-gradient-to-br from-[#CE9F6B]/40 to-[#82A094]/40 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                        <div
                            className="relative w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
                            style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
                        >
                            <Send className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="min-w-0">
                        <Link href="/finance/bank-accounts" className="hover:text-[#B18E63] transition-colors flex items-center gap-1.5 text-[10px] lg:text-xs font-bold text-[#92A2A5] mb-1">
                            <ArrowLeft className="w-3 h-3" /> Back to Accounts
                        </Link>
                        <h1 className="text-xl lg:text-3xl font-black tracking-tight leading-none">
                            <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                                Bulk Payments
                            </span>
                        </h1>
                        <p className="text-[10px] lg:text-xs text-muted-foreground font-medium mt-1 truncate">
                            Create and submit payment batches for approval
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 lg:pb-0 lg:mb-0 no-scrollbar shrink-0">
                    <div className="flex items-center gap-2 flex-nowrap">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#AEBFC3]/30 shadow-sm whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-[#CE9F6B]" />
                            <span className="text-[10px] font-black text-[#546A7A] uppercase tracking-wider">{exportFormat}</span>
                        </div>
                        {pendingPayments.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#82A094]/10 border border-[#82A094]/20 text-[#4F6A64] shadow-sm whitespace-nowrap">
                                <span className="font-black text-[10px]">{activeCurrencySymbol}</span>
                                <span className="text-[10px] font-black uppercase tracking-wider">{currencyFilter}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* ================================================================ */}
            {/* STATS GRID */}
            {/* ================================================================ */}
            {/* STATS GRID - Optimized for mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <StatCard
                    icon={Hash}
                    label="Records"
                    value={stats.totalRecords}
                    loading={false}
                    variant="gold"
                    subtitle="entries"
                />
                <StatCard
                    icon={Building2}
                    label="Vendors"
                    value={stats.selectedVendors}
                    loading={false}
                    variant="steel"
                    subtitle="unique"
                />
                <StatCard
                    icon={currencyFilter === 'USD' ? DollarSign : IndianRupee}
                    label="Amount"
                    value={`${activeCurrencySymbol}${stats.totalAmount.toLocaleString('en-IN')}`}
                    loading={false}
                    variant="emerald"
                    subtitle={currencyFilter !== 'ALL' ? currencyFilter : 'total'}
                />
                <StatCard
                    icon={CheckCircle2}
                    label="Ready"
                    value={stats.validPayments}
                    loading={false}
                    variant="coral"
                    subtitle={`of ${stats.totalRecords}`}
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
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors duration-300",
                        currencyFilter !== 'ALL'
                            ? 'bg-gradient-to-b from-[#4F6A64] to-[#82A094]'
                            : 'bg-gradient-to-b from-[#B18E63] to-[#976E44]'
                    )} />
                    <div className="px-4 lg:px-6 py-4 flex items-center gap-4">
                        <div className="flex items-center gap-2.5 shrink-0">
                            <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300",
                                currencyFilter !== 'ALL'
                                    ? 'bg-gradient-to-br from-[#4F6A64] to-[#82A094]'
                                    : 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]'
                            )}>
                                <Filter className="w-4 h-4 text-white" />
                            </div>
                            <div className="hidden lg:block">
                                <p className="text-xs font-bold text-slate-600">Currency</p>
                                <p className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                                    {currencyFilter !== 'ALL' ? `${filteredAccounts.length} available` : `${accounts.length} total`}
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-slate-100 shrink-0 hidden sm:block" />

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-nowrap lg:flex-wrap flex-1 scroll-smooth">
                            <button
                                onClick={() => setCurrencyFilter('ALL')}
                                disabled={pendingPayments.length > 0}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all duration-200 border whitespace-nowrap uppercase tracking-widest",
                                    pendingPayments.length > 0 && 'opacity-50 cursor-not-allowed',
                                    currencyFilter === 'ALL'
                                        ? 'bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white border-transparent shadow-lg shadow-[#B18E63]/20'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#B18E63]/40 hover:text-[#976E44]'
                                )}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                All
                                <span className={cn(
                                    "text-[9px] px-2 py-0.5 rounded-md font-black tabular-nums",
                                    currencyFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
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
                                        disabled={pendingPayments.length > 0 && currencyFilter !== currency}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all duration-200 border whitespace-nowrap uppercase tracking-widest",
                                            pendingPayments.length > 0 && currencyFilter !== currency && 'opacity-50 cursor-not-allowed',
                                            currencyFilter === currency
                                                ? 'bg-gradient-to-r from-[#4F6A64] to-[#82A094] text-white border-transparent shadow-lg shadow-[#82A094]/20'
                                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-[#82A094]/40 hover:text-[#4F6A64]'
                                        )}
                                    >
                                        <span className="text-sm font-black">{icon}</span>
                                        {currency}
                                        <span className={cn(
                                            "text-[9px] px-2 py-0.5 rounded-md font-black tabular-nums",
                                            currencyFilter === currency ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
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

                        <div className="p-6 relative">
                            {/* Currency-first gate overlay */}
                            {currencyFilter === 'ALL' && (
                                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[2px] rounded-b-2xl flex flex-col items-center justify-center gap-3 p-6">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 flex items-center justify-center">
                                        <Filter className="w-6 h-6 text-[#976E44]" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-[#546A7A] text-sm">Select Currency First</p>
                                        <p className="text-xs text-[#92A2A5] mt-1 max-w-xs">Choose a currency from the filter above before adding vendors. All vendors in a batch must share the same currency.</p>
                                    </div>
                                </div>
                            )}
                            {/* Custom Vendor Search Dropdown + Manual Payee Button */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div ref={dropdownRef} className="relative flex-1">
                                    {/* Search Trigger / Input */}
                                    <div
                                        className={cn(
                                            "w-full flex items-center gap-3 bg-slate-50/80 border rounded-xl h-14 px-4 transition-all",
                                            currencyFilter === 'ALL' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                                            openDropdown ? 'border-[#B18E63] ring-2 ring-[#B18E63]/20 bg-white shadow-lg' : 'border-slate-200 hover:border-[#B18E63]/50 hover:bg-white hover:shadow-md'
                                        )}
                                        onClick={() => currencyFilter !== 'ALL' && setOpenDropdown(true)}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-[#B18E63] shrink-0" />
                                        ) : (
                                            <Search className="w-5 h-5 text-slate-400 shrink-0" />
                                        )}
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            placeholder={currencyFilter === 'ALL' ? 'Select a currency first...' : (loading ? 'Loading vendors...' : 'Search by vendor name, BP code, account number, bank name, or IFSC...')}
                                            className="flex-1 bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none"
                                            value={vendorSearchQuery}
                                            onChange={(e) => {
                                                setVendorSearchQuery(e.target.value);
                                                if (!openDropdown) setOpenDropdown(true);
                                            }}
                                            onFocus={() => currencyFilter !== 'ALL' && setOpenDropdown(true)}
                                            disabled={loading || currencyFilter === 'ALL'}
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

                                                            {/* Row 3: NickName + Currency + MSME */}
                                                            <div className="flex items-center gap-2">
                                                                {a.nickName && (
                                                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-tight">
                                                                        Nick: {a.nickName}
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
                                                    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
                                                        <Search className="w-9 h-9 text-slate-300" />
                                                        <div>
                                                            <p className="text-sm text-slate-600 font-bold">No master vendor found</p>
                                                            <p className="text-xs text-slate-400 mt-0.5">"{vendorSearchQuery}" is not in the bank account master list.</p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={() => {
                                                                setManualForm(prev => ({
                                                                    ...prev,
                                                                    vendorName: vendorSearchQuery.trim(),
                                                                }));
                                                                setShowManualModal(true);
                                                                setOpenDropdown(false);
                                                            }}
                                                            className="bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white text-xs font-bold rounded-xl h-9 px-4 shadow-sm hover:brightness-105"
                                                        >
                                                            <Plus className="w-3.5 h-3.5 mr-1" />
                                                            Add "{vendorSearchQuery}" as One-Time Payee
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Dropdown Quick Manual Action */}
                                            <div className="border-t border-slate-100 px-4 py-2.5 bg-amber-50/50 flex items-center justify-between">
                                                <span className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                                                    <Sparkles className="w-3 h-3 text-[#B18E63]" />
                                                    One-time payment not in master?
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (vendorSearchQuery.trim()) {
                                                            setManualForm(prev => ({ ...prev, vendorName: vendorSearchQuery.trim() }));
                                                        }
                                                        setShowManualModal(true);
                                                        setOpenDropdown(false);
                                                    }}
                                                    className="text-[11px] text-[#976E44] hover:underline font-bold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-[#B18E63]/30 shadow-xs hover:bg-[#B18E63]/5 transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" /> Manual Entry
                                                </button>
                                            </div>
                                            {/* Footer */}
                                            <div className="border-t border-slate-100 px-5 py-2 bg-slate-50/50 flex items-center justify-between">
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

                                {/* Dedicated Manual Payee Button */}
                                <Button
                                    type="button"
                                    onClick={() => {
                                        if (currencyFilter === 'ALL') {
                                            toast.error('Please select a currency filter first');
                                            return;
                                        }
                                        if (vendorSearchQuery.trim()) {
                                            setManualForm(prev => ({
                                                ...prev,
                                                vendorName: vendorSearchQuery.trim(),
                                            }));
                                        }
                                        setShowManualModal(true);
                                        setOpenDropdown(false);
                                    }}
                                    disabled={loading || currencyFilter === 'ALL'}
                                    className="h-14 px-5 rounded-xl bg-gradient-to-r from-[#B18E63] to-[#976E44] hover:brightness-105 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-40"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Manual Payee
                                </Button>
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

                            {/* HDFC Ben Email IDs */}
                            {exportFormat === 'HDFC' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 flex items-center gap-1.5">
                                        <Mail className="w-3 h-3" />
                                        Ben Email ID
                                        <span className="ml-auto text-[9px] bg-[#B18E63]/10 text-[#976E44] px-2 py-0.5 rounded-md font-bold">HDFC</span>
                                    </label>
                                    {/* Email tags */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-slate-50/80 border border-slate-200 rounded-xl">
                                        {benEmailIds.map((email, idx) => {
                                            const isDefaultEmail = idx === 0 && email === DEFAULT_EMAIL;
                                            const canEdit = isAdmin || !isDefaultEmail;
                                            const canDelete = (isAdmin || !isDefaultEmail) && benEmailIds.length > 1;
                                            return (
                                                editingEmailIdx === idx && canEdit ? (
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
                                                        className={cn(
                                                            "group/tag flex items-center gap-1 bg-white border rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-default",
                                                            isDefaultEmail && !isAdmin
                                                                ? 'border-slate-200 text-slate-500 bg-slate-50'
                                                                : 'border-[#B18E63]/30 text-[#976E44] hover:border-[#B18E63]/60'
                                                        )}
                                                    >
                                                        {isDefaultEmail && !isAdmin ? (
                                                            <Shield className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                                        ) : (
                                                            <Mail className="w-2.5 h-2.5 shrink-0 text-[#B18E63]/60" />
                                                        )}
                                                        <span className="max-w-[150px] truncate">{email}</span>
                                                        {isDefaultEmail && !isAdmin && (
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1">Default</span>
                                                        )}
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => { setEditingEmailIdx(idx); setEditingEmailValue(email); }}
                                                                className="ml-0.5 text-slate-300 hover:text-[#B18E63] transition-colors opacity-0 group-hover/tag:opacity-100"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="w-2.5 h-2.5" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
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
                                            );
                                        })}
                                    </div>
                                    {/* Add new email */}
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="email"
                                                placeholder="Add email address..."
                                                value={newEmailInput}
                                                onChange={e => setNewEmailInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        const v = newEmailInput.trim();
                                                        if (!v || benEmailIds.includes(v)) return;
                                                        if (!v.includes('@') || !v.includes('.')) {
                                                            toast.error('Please enter a valid email address.');
                                                            return;
                                                        }
                                                        setBenEmailIds(prev => [...prev, v]);
                                                        setNewEmailInput('');
                                                    }
                                                }}
                                                className="flex-1 text-[11px] font-medium px-3 py-2 border border-slate-200 rounded-xl bg-white outline-none focus:ring-1 focus:ring-[#B18E63]/30 focus:border-[#B18E63]/50 text-slate-700 placeholder:text-slate-300 transition-all h-9"
                                            />
                                            <button
                                                onClick={() => {
                                                    const v = newEmailInput.trim();
                                                    if (!v || benEmailIds.includes(v)) return;
                                                    if (!v.includes('@') || !v.includes('.')) {
                                                        toast.error('Please enter a valid email address.');
                                                        return;
                                                    }
                                                    setBenEmailIds(prev => [...prev, v]);
                                                    setNewEmailInput('');
                                                }}
                                                disabled={!newEmailInput.trim()}
                                                className="h-9 px-3 rounded-xl bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Add
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1 pl-1">
                                            <Info className="w-2.5 h-2.5" />
                                            Configure custom notification email addresses
                                        </p>
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
                                    if (confirm('Are you sure you want to clear all pending payments?')) {
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

                    {/* Table Content - Desktop Only */}
                    <div className="hidden lg:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] border-0 hover:from-[#546A7A] hover:to-[#6F8A9D] shadow-md">
                                    <TableHead className="w-[50px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4 text-center rounded-tl-lg">#</TableHead>
                                    <TableHead className="w-[300px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="w-3 h-3 text-white/70" /> Vendor & Account
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[160px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4">
                                        <div className="flex items-center gap-1.5">
                                            <IndianRupee className="w-3 h-3 text-white/70" /> Amount
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[160px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4">
                                        <div className="flex items-center gap-1.5">
                                            <CalendarIcon className="w-3 h-3 text-white/70" /> Value Date
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[140px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4 text-center">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <Zap className="w-3 h-3 text-white/70" /> Mode
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[200px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Mail className="w-3 h-3 text-white/70" /> Email ID
                                        </div>
                                    </TableHead>

                                    <TableHead className="text-right w-[70px] text-white/90 font-bold uppercase text-[10px] tracking-wider py-4 rounded-tr-lg">Action</TableHead>
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
                                            <TableCell className="py-4 align-top">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-md",
                                                        p.isManual
                                                            ? "bg-gradient-to-br from-[#CE9F6B] to-[#976E44]"
                                                            : "bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]"
                                                    )}>
                                                        {p.isManual ? (
                                                            <UserPlus className="w-5 h-5 text-white" />
                                                        ) : (
                                                            p.vendorName?.split(' ').slice(0, 2).map(w => w?.[0] || '').join('').toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                                        {/* Row 1: Vendor name + badge */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {p.isManual ? (
                                                                <input
                                                                    type="text"
                                                                    value={p.vendorName || ''}
                                                                    onChange={(e) => updatePayment(p.tempId, { vendorName: e.target.value })}
                                                                    placeholder="Payee Name"
                                                                    className="font-bold text-sm text-slate-800 bg-amber-50/40 border border-amber-200/80 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-[#B18E63] w-full max-w-[200px]"
                                                                    title="Click to edit payee name"
                                                                />
                                                            ) : (
                                                                <span className="font-bold text-sm text-slate-700 truncate">{p.vendorName}</span>
                                                            )}
                                                            {p.isManual ? (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0 uppercase tracking-wider">
                                                                    <Sparkles className="w-2.5 h-2.5 text-amber-600" /> One-Time / Ad-Hoc
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-[#82A094]/10 text-[#4F6A64] shrink-0 uppercase tracking-widest border border-[#82A094]/20">
                                                                    {CURRENCY_SYMBOLS[(p.bankAccount?.currency || activeCurrencyCode).toUpperCase()] || ''} {(p.bankAccount?.currency || activeCurrencyCode).toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Row 2: Account number (editable for manual, select or static for master) */}
                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                                            <Wallet className={cn("w-3 h-3 shrink-0", p.isManual ? "text-[#B18E63]" : "text-slate-300")} />
                                                            {p.isManual ? (
                                                                <input
                                                                    type="text"
                                                                    value={p.accountNumber || ''}
                                                                    onChange={(e) => updatePayment(p.tempId, { accountNumber: e.target.value })}
                                                                    placeholder="A/C Number"
                                                                    className="h-6 px-2 text-xs font-mono font-bold bg-amber-50/50 border border-amber-200 rounded-md text-slate-800 outline-none focus:ring-1 focus:ring-[#B18E63] w-40"
                                                                    title="Click to edit account number"
                                                                />
                                                            ) : p.bankAccount?.otherAccountNumbers && p.bankAccount.otherAccountNumbers.length > 0 ? (
                                                                <Select
                                                                    value={p.accountNumber}
                                                                    onValueChange={(val) => updatePayment(p.tempId, { accountNumber: val })}
                                                                >
                                                                    <SelectTrigger className="h-7 text-[11px] font-bold bg-white border-slate-200 rounded-lg px-2 py-1 min-w-[160px] max-w-[220px] shadow-none focus:ring-0 focus:border-[#B18E63] gap-1">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value={p.bankAccount.accountNumber} className="text-xs font-bold font-mono">
                                                                            Primary: {p.bankAccount.accountNumber}
                                                                        </SelectItem>
                                                                        {p.bankAccount.otherAccountNumbers.map((num, nIdx) => {
                                                                            const [accNum, , bankName] = num.includes('|') ? num.split('|') : [num, '', ''];
                                                                            return (
                                                                                <SelectItem key={nIdx} value={num} className="text-xs font-bold font-mono">
                                                                                    Sec: {accNum}{bankName ? ` (${bankName})` : ''}
                                                                                </SelectItem>
                                                                            );
                                                                        })}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <span className="truncate bg-slate-100/80 px-1.5 py-0.5 rounded text-slate-500">{p.accountNumber}</span>
                                                            )}
                                                        </div>

                                                        {/* Row 3: Bank name + IFSC */}
                                                        <div className="flex items-center gap-1.5 text-[10px]">
                                                            {p.isManual ? (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <input
                                                                        type="text"
                                                                        value={p.bankName || ''}
                                                                        onChange={(e) => updatePayment(p.tempId, { bankName: e.target.value })}
                                                                        placeholder="Bank Name"
                                                                        className="h-5 px-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded text-slate-600 outline-none focus:ring-1 focus:ring-[#B18E63] max-w-[110px]"
                                                                        title="Click to edit bank name"
                                                                    />
                                                                    <span className="text-slate-200">•</span>
                                                                    <input
                                                                        type="text"
                                                                        value={p.ifscCode || ''}
                                                                        onChange={(e) => {
                                                                            const ifsc = e.target.value.toUpperCase();
                                                                            const detected = detectBankFromIFSC(ifsc);
                                                                            updatePayment(p.tempId, {
                                                                                ifscCode: ifsc,
                                                                                ...(detected && !p.bankName ? { bankName: detected } : {})
                                                                            });
                                                                        }}
                                                                        placeholder="IFSC"
                                                                        className="h-5 px-1.5 text-[10px] font-mono font-bold uppercase bg-[#B18E63]/10 border border-[#B18E63]/30 rounded text-[#B18E63] outline-none focus:ring-1 focus:ring-[#B18E63] w-24"
                                                                        title="Click to edit IFSC code"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="text-slate-400 font-medium truncate max-w-[140px]">{p.bankName}</span>
                                                                    <span className="text-slate-200">•</span>
                                                                    <span className="text-[#B18E63] font-bold bg-[#B18E63]/5 px-1.5 py-0.5 rounded font-mono">{p.ifscCode}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Amount */}
                                            <TableCell className="py-4">
                                                <div className="relative group/input">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold transition-colors group-focus-within/input:text-[#B18E63]">{activeCurrencySymbol}</span>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        className={cn(
                                                            "pl-7 h-11 w-full min-w-[120px] text-sm font-bold tabular-nums border-slate-200 transition-all shadow-none rounded-xl",
                                                            "bg-slate-50/50 focus:bg-white focus:border-[#B18E63]/40 focus:ring-1 focus:ring-[#B18E63]/20",
                                                            (p.amount ?? 0) > 0 ? "text-slate-800" : "text-slate-400"
                                                        )}
                                                        placeholder="0.00"
                                                        value={p.amount ? p.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/,/g, '');
                                                            if (val === '' || !isNaN(Number(val))) {
                                                                updatePayment(p.tempId, { amount: val === '' ? 0 : parseFloat(val) });
                                                            }
                                                        }}
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
                                                    className="h-11 w-full min-w-[130px] text-xs font-medium bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#6F8A9D]/40 focus:ring-1 focus:ring-[#6F8A9D]/20 transition-all shadow-none rounded-xl"
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
                                                    <SelectTrigger className="h-11 w-full min-w-[110px] text-xs font-bold bg-slate-50/50 border-slate-200 focus:bg-white transition-all shadow-none rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="NFT" className="text-xs font-medium">NEFT</SelectItem>
                                                        <SelectItem value="RTI" className="text-xs font-medium">RTGS</SelectItem>
                                                        <SelectItem value="FT" className="text-xs font-medium">Same Bank</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>

                                            {/* Email ID */}
                                            <TableCell className="py-4">
                                                <div className="relative group/input">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                        <Mail className="w-3.5 h-3.5 text-slate-400 transition-colors group-focus-within/input:text-[#B18E63]" />
                                                    </span>
                                                    <Input
                                                        type="email"
                                                        className={cn(
                                                            "pl-9 h-11 w-full min-w-[200px] text-xs font-bold border-slate-200 transition-all shadow-none rounded-xl",
                                                            "bg-slate-50/50 focus:bg-white focus:border-[#B18E63]/40 focus:ring-1 focus:ring-[#B18E63]/20",
                                                            p.emailId ? "text-slate-700 font-semibold" : "text-slate-400 font-normal"
                                                        )}
                                                        placeholder="vendor@email.com"
                                                        value={p.emailId || ''}
                                                        onChange={(e) => updatePayment(p.tempId, { emailId: e.target.value })}
                                                    />
                                                </div>
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
                                        <TableCell colSpan={7} className="h-72 text-center">
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

                    {/* Mobile Payment Cards - Mobile Only */}
                    <div className="lg:hidden divide-y divide-[#AEBFC3]/10 px-4">
                        {pendingPayments.length > 0 ? (
                            pendingPayments.map((p, index) => (
                                <div key={p.tempId} className="py-6 space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-md">
                                                {p.vendorName?.split(' ').slice(0, 2).map(w => w?.[0] || '').join('').toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="font-black text-[#546A7A] truncate text-sm tracking-tight">{p.vendorName}</h4>
                                                    {p.isManual && (
                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight">
                                                            Ad-Hoc
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <p className="text-[10px] font-bold text-[#AEBFC3] font-mono uppercase">{p.ifscCode}</p>
                                                    <span className="text-[10px] text-[#AEBFC3]">•</span>
                                                    <p className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">{p.bankName}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                            onClick={() => removePayment(p.tempId)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount</label>
                                            <div className="relative group/input">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-black">{activeCurrencySymbol}</span>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="pl-7 h-10 text-xs font-black tabular-nums border-slate-200 bg-slate-50/50 rounded-xl"
                                                    placeholder="0.00"
                                                    value={p.amount ? p.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/,/g, '');
                                                        if (val === '' || !isNaN(Number(val))) {
                                                            updatePayment(p.tempId, { amount: val === '' ? 0 : parseFloat(val) });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Tx Mode</label>
                                            <Select
                                                value={p.transactionMode}
                                                onValueChange={(v: any) => updatePayment(p.tempId, { transactionMode: v })}
                                            >
                                                <SelectTrigger className="h-10 text-[10px] font-black bg-slate-50/50 border-slate-200 rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NFT" className="text-xs font-bold">NEFT</SelectItem>
                                                    <SelectItem value="RTI" className="text-xs font-bold">RTGS</SelectItem>
                                                    <SelectItem value="FT" className="text-xs font-bold">SAME BANK</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Email ID</label>
                                        <div className="relative group/input">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                <Mail className="w-3.5 h-3.5 text-slate-400 transition-colors group-focus-within/input:text-[#B18E63]" />
                                            </span>
                                            <Input
                                                type="email"
                                                className="pl-9 h-10 text-xs font-medium border-slate-200 bg-slate-50/50 rounded-xl w-full"
                                                placeholder="vendor@email.com"
                                                value={p.emailId || ''}
                                                onChange={(e) => updatePayment(p.tempId, { emailId: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="w-3.5 h-3.5 text-[#6F8A9D]" />
                                            <Input
                                                type="date"
                                                className="h-7 w-32 text-[10px] font-black bg-transparent border-0 p-0 shadow-none focus-visible:ring-0"
                                                value={p.valueDate ? format(p.valueDate, 'yyyy-MM-dd') : ''}
                                                onChange={(e) => updatePayment(p.tempId, { valueDate: new Date(e.target.value) })}
                                            />
                                        </div>
                                        <div className="bg-white px-2 py-1 rounded-lg border border-slate-200">
                                            {p.bankAccount?.otherAccountNumbers && p.bankAccount.otherAccountNumbers.length > 0 ? (
                                                <Select
                                                    value={p.accountNumber}
                                                    onValueChange={(val) => updatePayment(p.tempId, { accountNumber: val })}
                                                >
                                                    <SelectTrigger className="h-6 text-[10px] font-mono text-[#CE9F6B] font-bold bg-white border-none p-0 w-auto inline-flex shadow-none focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value={p.bankAccount.accountNumber} className="text-xs font-bold font-mono">
                                                            Primary: {p.bankAccount.accountNumber}
                                                        </SelectItem>
                                                        {p.bankAccount.otherAccountNumbers.map((num, nIdx) => {
                                                            const [accNum, , bankName] = num.includes('|') ? num.split('|') : [num, '', ''];
                                                            return (
                                                                <SelectItem key={nIdx} value={num} className="text-xs font-bold font-mono">
                                                                    Sec: {accNum}{bankName ? ` (${bankName})` : ''}
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="text-[10px] font-mono text-[#CE9F6B] font-bold">{p.accountNumber?.slice(-4).padStart(p.accountNumber?.length || 0, '*')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mx-auto">
                                    <Send className="w-8 h-8 text-slate-200" />
                                </div>
                                <p className="font-bold text-slate-400 text-sm">No payments in queue</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-[#B18E63]/30 text-[#B18E63]"
                                    onClick={() => setOpenDropdown(true)}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" /> Add Vendor
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ================================================================ */}
                {/* EXPORT FORMAT SELECTION */}
                {/* ================================================================ */}
                <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                    {/* Accent bar */}
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors duration-300",
                        exportFormat === 'HDFC'
                            ? 'bg-gradient-to-b from-[#B18E63] to-[#976E44]'
                            : 'bg-gradient-to-b from-[#6F8A9D] to-[#546A7A]'
                    )} />
                    <div className="px-6 py-4">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300",
                                exportFormat === 'HDFC'
                                    ? 'bg-gradient-to-br from-[#B18E63] to-[#976E44]'
                                    : 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A]'
                            )}>
                                <FileSpreadsheet className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-600">Export Format</p>
                                <p className="text-[9px] text-slate-400 font-medium">Choose the file format for your payment batch</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* HDFC Card */}
                            <button
                                onClick={() => setExportFormat('HDFC')}
                                className={cn(
                                    'relative group/fmt flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-300',
                                    exportFormat === 'HDFC'
                                        ? 'border-[#B18E63] bg-gradient-to-br from-[#B18E63]/[0.06] to-[#976E44]/[0.03] shadow-lg shadow-[#B18E63]/10 ring-1 ring-[#B18E63]/20'
                                        : 'border-dashed border-slate-200 hover:border-[#B18E63]/40 hover:bg-[#B18E63]/[0.02] hover:shadow-md'
                                )}
                            >
                                {/* Check indicator */}
                                <div className={cn(
                                    'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
                                    exportFormat === 'HDFC'
                                        ? 'bg-gradient-to-br from-[#B18E63] to-[#976E44] scale-100 shadow-md shadow-[#B18E63]/30'
                                        : 'bg-slate-100 scale-90'
                                )}>
                                    {exportFormat === 'HDFC' ? (
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                    )}
                                </div>
                                <div className={cn(
                                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                                    exportFormat === 'HDFC'
                                        ? 'bg-gradient-to-br from-[#B18E63] to-[#976E44] shadow-lg shadow-[#B18E63]/20'
                                        : 'bg-slate-100 group-hover/fmt:bg-[#B18E63]/10'
                                )}>
                                    <Landmark className={cn(
                                        'w-5.5 h-5.5 transition-colors duration-300',
                                        exportFormat === 'HDFC' ? 'text-white' : 'text-slate-400 group-hover/fmt:text-[#B18E63]'
                                    )} />
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <p className={cn(
                                        'font-bold text-sm mb-1 transition-colors',
                                        exportFormat === 'HDFC' ? 'text-[#976E44]' : 'text-slate-600'
                                    )}>HDFC</p>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        HDFC Bank Corporate Internet Banking format with beneficiary email notifications
                                    </p>
                                    {exportFormat === 'HDFC' && (
                                        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-[#B18E63] animate-in fade-in slide-in-from-bottom-1 duration-300">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Active Format
                                        </div>
                                    )}
                                </div>
                            </button>

                            {/* DB Card */}
                            <button
                                onClick={() => setExportFormat('DB')}
                                className={cn(
                                    'relative group/fmt flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-300',
                                    exportFormat === 'DB'
                                        ? 'border-[#6F8A9D] bg-gradient-to-br from-[#6F8A9D]/[0.06] to-[#546A7A]/[0.03] shadow-lg shadow-[#6F8A9D]/10 ring-1 ring-[#6F8A9D]/20'
                                        : 'border-dashed border-slate-200 hover:border-[#6F8A9D]/40 hover:bg-[#6F8A9D]/[0.02] hover:shadow-md'
                                )}
                            >
                                {/* Check indicator */}
                                <div className={cn(
                                    'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
                                    exportFormat === 'DB'
                                        ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] scale-100 shadow-md shadow-[#6F8A9D]/30'
                                        : 'bg-slate-100 scale-90'
                                )}>
                                    {exportFormat === 'DB' ? (
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                    )}
                                </div>
                                <div className={cn(
                                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                                    exportFormat === 'DB'
                                        ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20'
                                        : 'bg-slate-100 group-hover/fmt:bg-[#6F8A9D]/10'
                                )}>
                                    <Banknote className={cn(
                                        'w-5.5 h-5.5 transition-colors duration-300',
                                        exportFormat === 'DB' ? 'text-white' : 'text-slate-400 group-hover/fmt:text-[#6F8A9D]'
                                    )} />
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <p className={cn(
                                        'font-bold text-sm mb-1 transition-colors',
                                        exportFormat === 'DB' ? 'text-[#546A7A]' : 'text-slate-600'
                                    )}>DB</p>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        Deutsche Bank transfer format compatible with all banks
                                    </p>
                                    {exportFormat === 'DB' && (
                                        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-[#6F8A9D] animate-in fade-in slide-in-from-bottom-1 duration-300">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Active Format
                                        </div>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ================================================================ */}
                {/* PREVIEW & DOWNLOAD CARD */}
                {/* ================================================================ */}
                <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
                    {/* Accent bar */}
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors duration-300",
                        exportFormat === 'HDFC'
                            ? 'bg-gradient-to-b from-[#82A094] to-[#546A7A]'
                            : 'bg-gradient-to-b from-[#546A7A] to-[#82A094]'
                    )} />
                    <div className="px-6 py-4">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center shadow-sm">
                                <Eye className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-600">Preview & Download</p>
                                <p className="text-[9px] text-slate-400 font-medium">Preview the export format or download payment files before submitting</p>
                            </div>
                            {stats.validPayments > 0 && (
                                <span className="ml-auto text-[9px] bg-[#82A094]/10 text-[#4F6A64] px-2 py-0.5 rounded-md font-bold">
                                    {stats.validPayments} valid entries
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Preview Section */}
                            <div className={cn(
                                'relative group/card p-5 rounded-2xl border-2 transition-all duration-300',
                                showPreview
                                    ? 'border-[#6F8A9D] bg-gradient-to-br from-[#6F8A9D]/[0.06] to-[#546A7A]/[0.03] shadow-lg shadow-[#6F8A9D]/10 ring-1 ring-[#6F8A9D]/20'
                                    : 'border-dashed border-slate-200 hover:border-[#6F8A9D]/40 hover:bg-[#6F8A9D]/[0.02] hover:shadow-md'
                            )}>
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                                        showPreview
                                            ? 'bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] shadow-lg shadow-[#6F8A9D]/20'
                                            : 'bg-slate-100 group-hover/card:bg-[#6F8A9D]/10'
                                    )}>
                                        <Eye className={cn(
                                            'w-5 h-5 transition-colors duration-300',
                                            showPreview ? 'text-white' : 'text-slate-400 group-hover/card:text-[#6F8A9D]'
                                        )} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={cn(
                                            'font-bold text-sm mb-1 transition-colors',
                                            showPreview ? 'text-[#546A7A]' : 'text-slate-600'
                                        )}>Format Preview</p>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            See exactly how your payment data will appear in the exported file
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <Button
                                        variant={showPreview ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setShowPreview(v => !v)}
                                        disabled={stats.validPayments === 0}
                                        className={cn(
                                            'rounded-xl font-bold text-[10px] uppercase tracking-widest h-9 px-4 transition-all',
                                            showPreview
                                                ? 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white shadow-md hover:brightness-110'
                                                : 'border-slate-200 text-slate-500 hover:border-[#6F8A9D]/50 hover:text-[#546A7A]'
                                        )}
                                    >
                                        <Eye className="w-3 h-3 mr-1.5" />
                                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                                    </Button>
                                    {showPreview && (
                                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                            <button
                                                onClick={() => setPreviewFormat('HDFC')}
                                                className={cn(
                                                    'px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all',
                                                    previewFormat === 'HDFC'
                                                        ? 'bg-[#B18E63] text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                )}
                                            >
                                                HDFC
                                            </button>
                                            <button
                                                onClick={() => setPreviewFormat('DB')}
                                                className={cn(
                                                    'px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all',
                                                    previewFormat === 'DB'
                                                        ? 'bg-[#6F8A9D] text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                )}
                                            >
                                                DB
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Download Section */}
                            <div ref={downloadMenuRef} className={cn(
                                'relative group/card p-5 rounded-2xl border-2 transition-all duration-300',
                                'border-dashed border-slate-200 hover:border-[#82A094]/40 hover:bg-[#82A094]/[0.02] hover:shadow-md'
                            )}>
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover/card:bg-[#82A094]/10 flex items-center justify-center shrink-0 transition-all duration-300">
                                        <Download className="w-5 h-5 text-slate-400 group-hover/card:text-[#82A094] transition-colors duration-300" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm mb-1 text-slate-600">Download Files</p>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Download payment files in your preferred bank format
                                        </p>
                                    </div>
                                </div>
                                {/* Custom Filename */}
                                <div className="mb-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1.5 flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" /> Custom Filename
                                    </p>
                                    <input
                                        type="text"
                                        placeholder="Enter filename (optional)"
                                        value={customFilename}
                                        onChange={(e) => setCustomFilename(e.target.value)}
                                        className="w-full text-[11px] font-bold border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#546A7A] focus:border-[#546A7A]/40 outline-none bg-white/50 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                {/* HDFC Downloads */}
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between px-1 mb-2">
                                            <p className="text-[9px] font-black text-[#B18E63] uppercase tracking-widest flex items-center gap-1.5">
                                                <Landmark className="w-3 h-3" /> HDFC (CMS)
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTxtEditor('HDFC')}
                                                disabled={stats.validPayments === 0 || generatingTxt}
                                                className="text-[9px] font-black text-[#B18E63] hover:text-[#976E44] flex items-center gap-1 hover:underline disabled:opacity-40 transition-colors"
                                                title="Edit HDFC TXT file content directly before download"
                                            >
                                                <Pencil className="w-2.5 h-2.5" /> Edit TXT
                                            </button>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                                                <button key={f} onClick={() => handleLocalDownload('HDFC', f)}
                                                    disabled={stats.validPayments === 0}
                                                    className="flex-1 text-[10px] font-black py-2 px-2 border border-[#B18E63]/30 rounded-xl hover:bg-[#B18E63]/10 hover:border-[#B18E63]/50 text-[#976E44] transition-all uppercase tracking-wider flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                                                    {f === 'EXCEL' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : f === 'CSV' ? <FileText className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* DB Downloads */}
                                    <div>
                                        <div className="flex items-center justify-between px-1 mb-2">
                                            <p className="text-[9px] font-black text-[#546A7A] uppercase tracking-widest flex items-center gap-1.5">
                                                <Banknote className="w-3 h-3" /> DB (Standard)
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenTxtEditor('DB')}
                                                disabled={stats.validPayments === 0 || generatingTxt}
                                                className="text-[9px] font-black text-[#546A7A] hover:text-[#3B4D58] flex items-center gap-1 hover:underline disabled:opacity-40 transition-colors"
                                                title="Edit DB TXT file content directly before download"
                                            >
                                                <Pencil className="w-2.5 h-2.5" /> Edit TXT
                                            </button>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {(['EXCEL', 'CSV', 'TXT'] as const).map(f => (
                                                <button key={f} onClick={() => handleLocalDownload('DB', f)}
                                                    disabled={stats.validPayments === 0}
                                                    className="flex-1 text-[10px] font-black py-2 px-2 border border-[#6F8A9D]/30 rounded-xl hover:bg-[#6F8A9D]/10 hover:border-[#6F8A9D]/50 text-[#546A7A] transition-all uppercase tracking-wider bg-[#6F8A9D]/5 flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                                                    {f === 'EXCEL' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : f === 'CSV' ? <FileText className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
                                                    {f}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Prominent Edit TXT Bar */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenTxtEditor(exportFormat)}
                                        disabled={stats.validPayments === 0 || generatingTxt}
                                        className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/70 hover:from-amber-100 hover:to-amber-200/70 text-amber-900 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs group"
                                    >
                                        <FileCode className="w-3 h-3 text-amber-700 group-hover:scale-110 transition-transform" />
                                        Edit & Preview {exportFormat} TXT File
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ================================================================ */}
                {/* PREVIEW TABLE (Collapsible) */}
                {/* ================================================================ */}
                {pendingPayments.length > 0 && showPreview && (
                    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Preview Header */}
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/8">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#6F8A9D]/15 flex items-center justify-center">
                                    <Eye className="w-3.5 h-3.5 text-[#546A7A]" />
                                </div>
                                <h3 className="font-black text-[#546A7A] uppercase tracking-widest text-xs">
                                    {previewFormat} Format Preview
                                </h3>
                                <span className="text-[9px] bg-[#6F8A9D]/10 text-[#546A7A] px-2 py-0.5 rounded-full font-bold border border-[#6F8A9D]/20">
                                    {stats.validPayments} entries
                                </span>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Preview Table */}
                        <div className="overflow-x-auto no-scrollbar">
                            {previewFormat === 'HDFC' ? (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#546A7A]/5 to-[#6F8A9D]/10 border-b border-slate-100">
                                            {['Trn Type', 'Bene Code', 'Bene A/C No.', 'Amount', 'Bene Name', 'Cust Ref No.', 'Inst. Date', 'IFSC Code', 'Bank Name'].map(h => (
                                                <th key={h} className="text-left px-3 py-3 text-[9px] font-black text-[#546A7A] uppercase tracking-widest whitespace-nowrap opacity-70">{h}</th>
                                            ))}
                                        </tr>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            {['A', 'A', 'A', 'N', 'C', 'C', 'DD/MM/YYYY', 'A', 'A'].map((t, i) => (
                                                <td key={i} className="px-3 py-1 text-[9px] text-red-500/80 font-mono font-bold">{t}</td>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {pendingPayments.filter(p => p.amount && p.amount > 0).map((item) => {
                                            const trnType = item.transactionMode === 'NFT' ? 'N' : item.transactionMode === 'RTI' ? 'R' : 'I';
                                            const beneCode = item.nickName || item.vendorName?.substring(0, 15).trim() || '';
                                            const custRef = item.nickName || item.vendorName?.split(' ')[0]?.substring(0, 30) || '';
                                            const valueDate = item.valueDate ? new Date(item.valueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/') : '—';
                                            return (
                                                <tr key={item.tempId} className="hover:bg-[#6F8A9D]/5 transition-colors group">
                                                    <td className="px-3 py-3"><span className="font-mono font-black text-[#546A7A] group-hover:text-black">{trnType}</span></td>
                                                    <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{beneCode}</td>
                                                    <td className="px-3 py-3 font-mono text-[10px] text-[#546A7A] font-bold">{item.accountNumber}</td>
                                                    <td className="px-3 py-3 font-black text-[#546A7A] tabular-nums">{Number(item.amount).toLocaleString('en-IN')}</td>
                                                    <td className="px-3 py-3 text-slate-600 font-bold max-w-[140px] truncate text-[10px]">{item.vendorName}</td>
                                                    <td className="px-3 py-3 font-mono text-[9px] text-slate-300">{custRef}</td>
                                                    <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{valueDate}</td>
                                                    <td className="px-3 py-3 font-mono font-bold text-[#6F8A9D] text-[10px]">{item.ifscCode}</td>
                                                    <td className="px-3 py-3 text-slate-500 max-w-[120px] truncate text-[10px]">{item.bankName}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] border-b border-[#6F8A9D]/40">
                                            {['Type', 'Amount', 'Value Date', 'Counter Party', 'Account No.', 'Acct Type', 'IFSC/Clearing', 'Order Ref'].map(h => (
                                                <th key={h} className="text-left px-3 py-3 text-[9px] font-black text-white uppercase tracking-widest whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {pendingPayments.filter(p => p.amount && p.amount > 0).map((item) => {
                                            const nameParts = (item.vendorName || '').split(' ');
                                            let ref = (item.bankAccount as any)?.nickName || '';
                                            if (!ref) {
                                                if (nameParts.length > 2) ref = `Adv ${nameParts[0]}`;
                                                else if (nameParts[0]?.length > 15) ref = nameParts[0].substring(0, 15);
                                                else ref = nameParts[0] || '';
                                            }
                                            const acctType = (item.accountType || '').toLowerCase().includes('sav') ? '10' : '11';
                                            const valueDate = item.valueDate ? new Date(item.valueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/') : '—';
                                            return (
                                                <tr key={item.tempId} className="hover:bg-[#6F8A9D]/5 transition-colors group">
                                                    <td className="px-3 py-3">
                                                        <span className="font-mono font-black bg-slate-100 text-[#546A7A] px-2 py-0.5 rounded text-[9px] group-hover:bg-[#546A7A] group-hover:text-white transition-all">
                                                            {item.transactionMode}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 font-black text-[#546A7A] tabular-nums">{Number(item.amount).toLocaleString('en-IN')}</td>
                                                    <td className="px-3 py-3 font-mono text-[10px] text-slate-300">{valueDate}</td>
                                                    <td className="px-3 py-3 text-[#546A7A] font-bold max-w-[160px] truncate text-[10px]">{item.vendorName}</td>
                                                    <td className="px-3 py-3 font-mono text-[10px] text-[#546A7A]">{item.accountNumber}</td>
                                                    <td className="px-3 py-3 text-center font-mono text-[10px] text-slate-300 font-bold">{acctType}</td>
                                                    <td className="px-3 py-3 font-mono font-bold text-[#6F8A9D] text-[10px]">{item.ifscCode}</td>
                                                    <td className="px-3 py-3 font-mono text-[9px] text-slate-300 tracking-tighter truncate max-w-[80px]">{ref}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 text-xs text-[#6F8A9D]">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            This is a preview of the export format. Download or submit to get the actual file. Showing {stats.validPayments} of {stats.totalRecords} entries.
                        </div>
                    </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* SUMMARY FOOTER + SUBMIT FOR APPROVAL */}
                {/* -------------------------------------------------------- */}
                {pendingPayments.length > 0 && (
                    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
                        {/* Accent top bar */}
                        <div className={cn(
                            "absolute top-0 left-0 right-0 h-1 transition-colors duration-300",
                            exportFormat === 'HDFC'
                                ? 'bg-gradient-to-r from-[#B18E63] via-[#CE9F6B] to-[#82A094]'
                                : 'bg-gradient-to-r from-[#6F8A9D] via-[#82A094] to-[#4F6A64]'
                        )} />

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 lg:p-6 gap-6">
                            {/* Left side — Stats */}
                            <div className="flex items-center gap-4 lg:gap-10 sm:justify-between lg:justify-start flex-wrap">
                                <div className="space-y-1 min-w-[80px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-[#CE9F6B]" /> Entries
                                    </p>
                                    <p className="font-black text-xl lg:text-3xl text-[#546A7A] tabular-nums leading-none">{pendingPayments.length}</p>
                                </div>
                                <div className="w-px h-10 bg-slate-100 hidden lg:block" />
                                <div className="space-y-1 min-w-[80px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                        <Building2 className="w-3 h-3 text-[#6F8A9D]" /> Vendors
                                    </p>
                                    <p className="font-black text-xl lg:text-3xl text-[#6F8A9D] tabular-nums leading-none">{stats.selectedVendors}</p>
                                </div>
                                <div className="w-px h-10 bg-slate-100 hidden lg:block" />
                                <div className="space-y-1 min-w-[120px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                        <IndianRupee className="w-3 h-3 text-[#82A094]" /> Total Amount
                                    </p>
                                    <p className="font-black text-xl lg:text-3xl text-[#B18E63] tabular-nums leading-none">
                                        {activeCurrencySymbol}{stats.totalAmount.toLocaleString('en-IN')}
                                    </p>
                                </div>

                                {stats.validPayments < stats.totalRecords && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 w-full lg:w-auto">
                                        <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                                        <p className="text-[10px] text-amber-700 font-black uppercase tracking-widest">
                                            {stats.totalRecords - stats.validPayments} rows pending amount
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Right side — Actions */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                                <div className="flex items-center justify-between sm:justify-start gap-2">
                                    <Button
                                        variant="ghost"
                                        className="grow-0 sm:grow text-red-400 hover:text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-[0.15em] rounded-xl h-12 lg:h-14 px-4"
                                        onClick={() => {
                                            if (confirm('Clear all pending payments?')) {
                                                setPendingPayments([]);
                                                toast.success('All payments cleared');
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        Clear
                                    </Button>

                                    <div className={cn(
                                        'flex items-center gap-2 px-4 rounded-2xl border transition-all h-12 lg:h-14',
                                        exportFormat === 'HDFC'
                                            ? 'bg-[#B18E63]/10 border-[#B18E63]/20 text-[#976E44]'
                                            : 'bg-[#6F8A9D]/10 border-[#6F8A9D]/20 text-[#546A7A]'
                                    )}>
                                        {exportFormat === 'HDFC' ? <Landmark className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{exportFormat}</span>
                                    </div>
                                </div>

                                <Button
                                    size="lg"
                                    onClick={handleSubmitForApproval}
                                    disabled={submittingBatch || pendingPayments.length === 0}
                                    className={cn(
                                        'text-white shadow-xl hover:shadow-2xl hover:brightness-110 transition-all border-0 rounded-2xl hover:scale-[1.02] h-12 lg:h-14 lg:px-10 font-black uppercase tracking-[0.15em] text-xs',
                                        exportFormat === 'HDFC'
                                            ? 'bg-gradient-to-r from-[#B18E63] to-[#976E44]'
                                            : 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'
                                    )}
                                >
                                    {submittingBatch ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    )}
                                    <span>Submit Batch</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ================================================================ */}
            {/* MANUAL / AD-HOC BENEFICIARY MODAL */}
            {/* ================================================================ */}
            {showManualModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#B18E63] via-[#CE9F6B] to-[#976E44] px-6 py-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                                    <UserPlus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">Add One-Time / Manual Payee</h3>
                                    <p className="text-[11px] text-white/80 font-medium">For direct disbursement without creating a vendor master record</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowManualModal(false)}
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleAddManualPayee} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">
                                    This payee will be added strictly for this payment batch. They will appear in the HDFC/DB bank export files and can be reviewed by the approver.
                                </p>
                            </div>

                            {/* Payee / Vendor Name */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-[#B18E63]" />
                                    Payee / Vendor Name <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="text"
                                    placeholder="e.g. BESCOM Electricity or Apex Freight"
                                    value={manualForm.vendorName}
                                    onChange={(e) => setManualForm(prev => ({ ...prev, vendorName: e.target.value }))}
                                    className="h-11 rounded-xl bg-slate-50 border-slate-200 font-medium text-sm focus:bg-white"
                                    autoFocus
                                />
                            </div>

                            {/* Account Number & Confirm Account Number */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Wallet className="w-3.5 h-3.5 text-[#B18E63]" />
                                        Beneficiary Account No. <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="Enter bank account number"
                                        value={manualForm.accountNumber}
                                        onChange={(e) => setManualForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold text-sm focus:bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#82A094]" />
                                        Confirm Account No. <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="Re-enter to confirm"
                                        value={manualForm.confirmAccountNumber}
                                        onChange={(e) => setManualForm(prev => ({ ...prev, confirmAccountNumber: e.target.value }))}
                                        className={cn(
                                            "h-11 rounded-xl font-mono font-bold text-sm focus:bg-white",
                                            manualForm.confirmAccountNumber && manualForm.accountNumber !== manualForm.confirmAccountNumber
                                                ? "bg-red-50 border-red-300 text-red-700"
                                                : "bg-slate-50 border-slate-200"
                                        )}
                                    />
                                </div>
                            </div>

                            {/* IFSC Code & Bank Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Landmark className="w-3.5 h-3.5 text-[#B18E63]" />
                                        IFSC / SWIFT Code <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        maxLength={16}
                                        placeholder="e.g. HDFC0000001 or SWIFT"
                                        value={manualForm.ifscCode}
                                        onChange={(e) => {
                                            const ifsc = e.target.value.toUpperCase();
                                            const detected = detectBankFromIFSC(ifsc);
                                            setManualForm(prev => ({
                                                ...prev,
                                                ifscCode: ifsc,
                                                bankName: detected || prev.bankName
                                            }));
                                        }}
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-mono font-bold text-sm uppercase focus:bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        Bank Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="e.g. HDFC Bank"
                                        value={manualForm.bankName}
                                        onChange={(e) => setManualForm(prev => ({ ...prev, bankName: e.target.value }))}
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-medium text-sm focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Amount & Mode */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <IndianRupee className="w-3.5 h-3.5 text-[#82A094]" />
                                        Payment Amount ({activeCurrencySymbol})
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                                            {activeCurrencySymbol}
                                        </span>
                                        <Input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={manualForm.amount}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/,/g, '');
                                                if (val === '' || !isNaN(Number(val))) {
                                                    setManualForm(prev => ({ ...prev, amount: val }));
                                                }
                                            }}
                                            className="h-11 pl-8 rounded-xl bg-slate-50 border-slate-200 font-bold text-sm focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-[#6F8A9D]" />
                                        Transaction Mode
                                    </label>
                                    <Select
                                        value={manualForm.transactionMode}
                                        onValueChange={(val: any) => setManualForm(prev => ({ ...prev, transactionMode: val }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-medium">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NFT">NEFT (NFT)</SelectItem>
                                            <SelectItem value="RTI">RTGS (RTI)</SelectItem>
                                            <SelectItem value="FT">Same Bank (FT)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Account Type & Beneficiary Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        Account Type
                                    </label>
                                    <Select
                                        value={manualForm.accountType}
                                        onValueChange={(val) => setManualForm(prev => ({ ...prev, accountType: val }))}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm font-medium">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Current">Current Account</SelectItem>
                                            <SelectItem value="Saving">Savings Account</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        Email Address (Optional)
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="payee@email.com"
                                        value={manualForm.emailId}
                                        onChange={(e) => setManualForm(prev => ({ ...prev, emailId: e.target.value }))}
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 text-sm focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowManualModal(false)}
                                    className="rounded-xl font-bold text-xs h-11 px-5 text-slate-500 hover:bg-slate-100"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="rounded-xl font-bold text-xs h-11 px-6 bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white shadow-lg shadow-[#B18E63]/25 hover:brightness-105"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add to Payment Queue
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* TXT FILE EDIT & PREVIEW MODAL */}
            {/* ================================================================ */}
            {showTxtEditModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-[#202E38] via-[#2D3E4C] to-[#1F2C36] px-6 py-4 flex items-center justify-between text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B18E63] to-[#7A5A38] flex items-center justify-center shadow-md">
                                    <FileCode className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-base text-white">Edit Payment TXT File</h3>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                            txtFormat === 'HDFC'
                                                ? "bg-[#B18E63]/25 text-[#E6C79C] border-[#B18E63]/40"
                                                : "bg-[#6F8A9D]/25 text-[#B8D1E5] border-[#6F8A9D]/40"
                                        )}>
                                            {txtFormat === 'HDFC' ? 'HDFC CMS Format' : 'DB Standard Format'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 font-medium">
                                        Inspect and modify file lines before downloading for bank upload
                                    </p>
                                </div>
                            </div>

                            {/* Format Switcher & Close */}
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchTxtFormat('HDFC')}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            txtFormat === 'HDFC'
                                                ? "bg-gradient-to-r from-[#B18E63] to-[#976E44] text-white shadow-sm"
                                                : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <Landmark className="w-3 h-3" /> HDFC TXT
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchTxtFormat('DB')}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                                            txtFormat === 'DB'
                                                ? "bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white shadow-sm"
                                                : "text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <Banknote className="w-3 h-3" /> DB TXT
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowTxtEditModal(false)}
                                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            {/* Filename Editor */}
                            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Filename:
                                </span>
                                <Input
                                    type="text"
                                    value={txtFilename}
                                    onChange={(e) => setTxtFilename(e.target.value)}
                                    placeholder="filename.txt"
                                    className="h-8 text-xs font-mono bg-white border-slate-300 rounded-lg focus:ring-1 focus:ring-[#B18E63]"
                                />
                            </div>

                            {/* Utility Buttons */}
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTxtWrap(!txtWrap)}
                                    className={cn(
                                        "h-8 text-xs font-bold rounded-lg border-slate-300 transition-colors",
                                        txtWrap ? "bg-slate-200 text-slate-800" : "text-slate-600 bg-white"
                                    )}
                                    title="Toggle word wrap"
                                >
                                    {txtWrap ? "Wrap: ON" : "Wrap: OFF"}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(txtContent);
                                        toast.success("TXT content copied to clipboard!");
                                    }}
                                    className="h-8 text-xs font-bold rounded-lg border-slate-300 bg-white text-slate-600 hover:text-slate-900 gap-1.5"
                                    title="Copy text to clipboard"
                                >
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    Copy
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenerateTxt}
                                    className="h-8 text-xs font-bold rounded-lg border-slate-300 bg-white text-slate-600 hover:text-amber-700 hover:border-amber-300 gap-1.5"
                                    title="Reset to original generated content from table"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                    Reset
                                </Button>
                            </div>
                        </div>

                        {/* Textarea Editor */}
                        <div className="p-5 flex-1 flex flex-col min-h-0 bg-slate-900 overflow-hidden">
                            <div className="flex items-center justify-between pb-2 text-[10px] font-mono text-slate-400">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Direct File Buffer (You can edit lines, amounts, IFSC, or separators directly)
                                </span>
                                <span>
                                    {txtContent.split('\n').filter(Boolean).length} rows • {txtContent.length} characters
                                </span>
                            </div>

                            <textarea
                                value={txtContent}
                                onChange={(e) => setTxtContent(e.target.value)}
                                wrap={txtWrap ? "soft" : "off"}
                                spellCheck={false}
                                className="flex-1 w-full p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs sm:text-[13px] leading-relaxed border border-slate-800 focus:outline-none focus:ring-1 focus:ring-[#B18E63] resize-none overflow-auto shadow-inner selection:bg-emerald-800 selection:text-white"
                                placeholder="Generated TXT file content will appear here..."
                            />
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                                Clicking download will generate and save the exact text file as edited above.
                            </div>
                            <div className="flex items-center gap-3 ml-auto">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowTxtEditModal(false)}
                                    className="rounded-xl font-bold text-xs h-10 px-4 text-slate-500 hover:bg-slate-100"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleDownloadEditedTxt}
                                    className="rounded-xl font-bold text-xs h-10 px-6 bg-gradient-to-r from-[#B18E63] to-[#976E44] hover:brightness-105 text-white shadow-lg shadow-[#B18E63]/25 gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download .TXT File
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
