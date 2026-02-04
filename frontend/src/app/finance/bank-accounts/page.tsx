'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi, BankAccount } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { 
  Plus, Building2, CreditCard, Check, X, 
  Search, Eye, Pencil, Trash2, Clock, Bell,
  FileSpreadsheet, Landmark, Copy, ChevronRight,
  Grid3x3, List, Power, EyeOff, Wallet,
  Wifi, CircleDot, Shield, Globe
} from 'lucide-react';

// ============================================================================
// KARDEX BRAND BANK CARD COLOR GRADIENTS
// ============================================================================
const CARD_THEMES = [
  { 
    // Kardex Brown - Primary Brand
    bg: 'linear-gradient(135deg, #B18E63 0%, #976E44 50%, #7A5A38 100%)',
    accent: '#CE9F6B',
    name: 'Kardex Gold'
  },
  { 
    // Kardex Green - Secondary Brand
    bg: 'linear-gradient(135deg, #82A094 0%, #718E85 50%, #4F6A64 100%)',
    accent: '#A8B5A0',
    name: 'Kardex Sage'
  },
  { 
    // Kardex Blue-Gray - Professional
    bg: 'linear-gradient(135deg, #6F8A9D 0%, #546A7A 50%, #3D4F5A 100%)',
    accent: '#7C9EB2',
    name: 'Kardex Steel'
  },
  { 
    // Kardex Coral - Accent
    bg: 'linear-gradient(135deg, #E17F70 0%, #C45C4D 50%, #A84539 100%)',
    accent: '#F5A898',
    name: 'Kardex Coral'
  },
  { 
    // Kardex Deep Brown
    bg: 'linear-gradient(135deg, #976E44 0%, #7A5A38 50%, #5D4329 100%)',
    accent: '#CE9F6B',
    name: 'Kardex Bronze'
  },
  { 
    // Kardex Deep Green
    bg: 'linear-gradient(135deg, #4F6A64 0%, #3D524D 50%, #2B3A36 100%)',
    accent: '#82A094',
    name: 'Kardex Forest'
  },
  { 
    // Kardex Slate
    bg: 'linear-gradient(135deg, #5D6E73 0%, #4A5A5F 50%, #374448 100%)',
    accent: '#AEBFC3',
    name: 'Kardex Slate'
  },
  { 
    // Kardex Ocean
    bg: 'linear-gradient(135deg, #7C9EB2 0%, #5A7A8C 50%, #436270 100%)',
    accent: '#A8C8D8',
    name: 'Kardex Ocean'
  },
];

const getCardTheme = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_THEMES[Math.abs(hash) % CARD_THEMES.length];
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

// Format account number like a card (with spaces)
const formatAccountNumber = (num: string) => {
  // Show last 4 digits, mask the rest
  const masked = num.slice(0, -4).replace(/./g, '•');
  const visible = num.slice(-4);
  // Group in chunks of 4
  const full = masked + visible;
  return full.match(/.{1,4}/g)?.join(' ') || num;
};

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
      card: 'bg-gradient-to-br from-[#B18E63] to-[#7A5A38] text-white',
      icon: 'bg-white/20 text-white',
      label: 'text-white/70',
      value: 'text-white'
    },
    success: {
      card: 'bg-gradient-to-br from-[#718E85] to-[#4F6A64] text-white',
      icon: 'bg-white/20 text-white',
      label: 'text-white/70',
      value: 'text-white'
    },
    secondary: {
      card: 'bg-white border border-[#AEBFC3]/30 shadow-sm',
      icon: 'bg-[#6F8A9D]/10 text-[#546A7A]',
      label: 'text-[#92A2A5]',
      value: 'text-[#546A7A]'
    },
    warning: {
      card: 'bg-white border border-[#E17F70]/30 shadow-sm hover:border-[#E17F70]/50',
      icon: 'bg-[#E17F70]/10 text-[#E17F70]',
      label: 'text-[#92A2A5]',
      value: 'text-[#546A7A]'
    }
  };

  const v = variants[variant];

  const Content = (
    <div className={`relative rounded-xl p-4 transition-all duration-200 ${v.card} ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <div className={`w-10 h-10 rounded-lg ${v.icon} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-right">
          <p className={`text-xs font-medium uppercase tracking-wider ${v.label}`}>
            {label}
          </p>
          <p className={`text-2xl font-bold ${v.value}`}>
            {loading ? '...' : value}
          </p>
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{Content}</Link>;
  return Content;
};

// ============================================================================
// PROFESSIONAL BANK ACCOUNT CARD COMPONENT
// ============================================================================
const BankCard = ({ 
  account, 
  isAdmin,
  onToggleStatus,
  onDelete 
}: { 
  account: BankAccount;
  isAdmin: boolean;
  onToggleStatus: (account: BankAccount, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) => {
  const theme = getCardTheme(account.vendorName);
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div 
      onClick={() => router.push(`/finance/bank-accounts/${account.id}`)}
      className="group cursor-pointer"
    >
      {/* The Card Itself */}
      <div 
        className="relative rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
        style={{ 
          background: theme.bg,
          aspectRatio: '1.7 / 1' // Optimized ratio for better content fit
        }}
      >
        {/* Subtle Bank Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1'%3E%3Cline x1='0' y1='50' x2='100' y2='50'/%3E%3Cline x1='0' y1='25' x2='100' y2='25'/%3E%3Cline x1='0' y1='75' x2='100' y2='75'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Action Buttons - Top Right (on hover) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
          <Link
            href={`/finance/bank-accounts/${account.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-white text-[#6F8A9D] hover:scale-110 transition-all shadow-md"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={`/finance/bank-accounts/${account.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-white text-[#CE9F6B] hover:scale-110 transition-all shadow-md"
            title="Edit Account"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Link>
          {isAdmin && (
            <>
              <button
                onClick={(e) => onToggleStatus(account, e)}
                className={`p-2 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all shadow-md ${
                  account.isActive ? 'text-[#E17F70]' : 'text-[#82A094]'
                }`}
                title={account.isActive ? "Deactivate" : "Activate"}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => onDelete(account.id, e)}
                className="p-2 rounded-lg bg-white/90 backdrop-blur-sm hover:bg-white text-[#E17F70] hover:scale-110 transition-all shadow-md"
                title="Delete Account"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Card Content */}
        <div className="relative h-full p-4 flex flex-col justify-between">
          {/* Header - Bank Information */}
          <div className="flex items-start justify-between">
            {/* Bank Details */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-bold truncate max-w-[130px]">
                  {account.beneficiaryBankName}
                </p>
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-wide">
                  {account.currency} Account
                </p>
              </div>
            </div>

            {/* Status & Badges */}
            <div className="flex flex-col items-end gap-1">
              <div className={`w-2 h-2 rounded-full ${account.isActive ? 'bg-emerald-300' : 'bg-slate-400'} shadow-lg`}>
                <span className={`block w-full h-full rounded-full ${account.isActive ? 'animate-ping bg-emerald-300' : ''} opacity-75`} />
              </div>
              {account.isMSME && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-400/30 text-amber-200 uppercase tracking-wider border border-amber-300/30">
                  MSME
                </span>
              )}
            </div>
          </div>

          {/* Middle Section - Account Details */}
          <div className="space-y-2 mt-2">
            {/* Account Number */}
            <div>
              <p className="text-white/50 text-[9px] uppercase tracking-wider font-semibold mb-0.5">
                Account Number
              </p>
              <div className="flex items-center gap-1.5">
                <p 
                  className="text-white text-base font-mono tracking-wider font-bold"
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
                >
                  {account.accountNumber}
                </p>
                <button
                  onClick={(e) => copyToClipboard(account.accountNumber, 'account', e)}
                  className={`p-0.5 rounded-md transition-all ${
                    copied === 'account' ? 'bg-emerald-500/40 text-emerald-200' : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {copied === 'account' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* IFSC Code */}
            <div>
              <p className="text-white/50 text-[9px] uppercase tracking-wider font-semibold mb-0.5">
                IFSC/SWIFT
              </p>
              <div className="flex items-center gap-1.5">
                <span 
                  className="text-white text-xs font-mono font-bold tracking-widest"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                >
                  {account.ifscCode}
                </span>
                <button
                  onClick={(e) => copyToClipboard(account.ifscCode, 'ifsc', e)}
                  className={`p-0.5 rounded transition-all ${
                    copied === 'ifsc' ? 'text-emerald-200' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {copied === 'ifsc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom - Vendor Details */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-white/50 text-[9px] uppercase tracking-wider mb-0.5 font-semibold">Account Holder</p>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p 
                  className="text-white text-xs font-bold uppercase tracking-wide truncate"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  title={account.vendorName}
                >
                  {account.vendorName}
                </p>
                {account.nickName && (
                  <p className="text-white/60 text-[10px] truncate italic mt-0.5">
                    "{account.nickName}"
                  </p>
                )}
              </div>
              {/* Secure Badge */}
              <div className="flex items-center gap-1 text-white/40 ml-2">
                <Shield className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TABLE VIEW COMPONENT
// ============================================================================
const VendorTable = ({ 
  accounts, 
  isAdmin,
  onToggleStatus,
  onDelete 
}: { 
  accounts: BankAccount[];
  isAdmin: boolean;
  onToggleStatus: (account: BankAccount, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) => {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-[#AEBFC3]/30 shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="bg-gradient-to-r from-[#B18E63]/5 via-[#82A094]/5 to-[#6F8A9D]/5 border-b-2 border-[#B18E63]/20">
              <th className="text-left px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest w-20">
                
              </th>
              <th className="text-left px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest">
                Vendor / Account Holder
              </th>
              <th className="text-left px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest">
                Bank Details
              </th>
              <th className="text-left px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest">
                Account Number
              </th>
              <th className="text-center px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest">
                Status
              </th>
              <th className="text-center px-5 py-4 text-[10px] font-bold text-[#546A7A] uppercase tracking-widest w-40">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#AEBFC3]/10">
            {accounts.map((account) => {
              const theme = getCardTheme(account.vendorName);
              const initials = getInitials(account.vendorName);

              return (
                <tr 
                  key={account.id}
                  onClick={() => router.push(`/finance/bank-accounts/${account.id}`)}
                  className="group hover:bg-gradient-to-r hover:from-[#B18E63]/5 hover:via-transparent hover:to-transparent transition-all cursor-pointer border-b border-transparent hover:border-[#B18E63]/10"
                >
                  {/* Avatar */}
                  <td className="px-5 py-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
                      style={{ background: theme.bg }}
                    >
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>
                  </td>

                  {/* Vendor Info */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#546A7A] group-hover:text-[#976E44] transition-colors text-sm">
                          {account.vendorName}
                        </span>
                        {account.isMSME && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-700 uppercase tracking-wider border border-amber-400/30">
                            MSME
                          </span>
                        )}
                      </div>
                      {account.nickName && (
                        <span className="text-xs text-[#CE9F6B] italic">"{account.nickName}"</span>
                      )}
                      <span className="text-[11px] text-[#92A2A5]">
                        {account.beneficiaryName && account.beneficiaryName !== account.vendorName
                          ? account.beneficiaryName
                          : 'Same as vendor'}
                      </span>
                    </div>
                  </td>

                  {/* Bank */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#6F8A9D]" />
                        <span className="text-sm text-[#546A7A] font-semibold">{account.beneficiaryBankName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-[#976E44] bg-[#CE9F6B]/10 px-2 py-1 rounded-md border border-[#CE9F6B]/20">
                          {account.ifscCode}
                        </span>
                        <button 
                          onClick={(e) => copyToClipboard(account.ifscCode, `ifsc-${account.id}`, e)}
                          className={`p-1 rounded-md transition-all ${
                            copied === `ifsc-${account.id}` 
                              ? 'bg-emerald-500/20 text-emerald-700' 
                              : 'text-[#AEBFC3] hover:text-[#CE9F6B] hover:bg-[#CE9F6B]/5'
                          }`}
                        >
                          {copied === `ifsc-${account.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="text-[10px] text-[#92A2A5] uppercase tracking-wider">
                        {account.currency} Account
                      </span>
                    </div>
                  </td>

                  {/* Account Number */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#82A094]" />
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#546A7A] tracking-wider bg-[#F8FAFB] px-2.5 py-1.5 rounded-lg border border-[#AEBFC3]/20">
                          {account.accountNumber}
                        </span>
                        <button 
                          onClick={(e) => copyToClipboard(account.accountNumber, `acc-${account.id}`, e)}
                          className={`p-1.5 rounded-md transition-all ${
                            copied === `acc-${account.id}` 
                              ? 'bg-emerald-500/20 text-emerald-700' 
                              : 'text-[#AEBFC3] hover:text-[#CE9F6B] hover:bg-[#CE9F6B]/5'
                          }`}
                        >
                          {copied === `acc-${account.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                      account.isActive 
                        ? 'bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/15 text-[#4F6A64] border border-[#82A094]/20' 
                        : 'bg-[#AEBFC3]/10 text-[#92A2A5] border border-[#AEBFC3]/20'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        account.isActive ? 'bg-[#82A094] animate-pulse' : 'bg-[#AEBFC3]'
                      }`} />
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/finance/bank-accounts/${account.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-[#6F8A9D]/10 text-[#92A2A5] hover:text-[#6F8A9D] transition-all hover:scale-110"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/finance/bank-accounts/${account.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-[#CE9F6B]/10 text-[#92A2A5] hover:text-[#CE9F6B] transition-all hover:scale-110"
                        title="Edit Account"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => onToggleStatus(account, e)}
                            className={`p-2 rounded-lg transition-all hover:scale-110 ${
                              account.isActive 
                                ? 'hover:bg-[#E17F70]/10 text-[#92A2A5] hover:text-[#E17F70]' 
                                : 'hover:bg-[#82A094]/10 text-[#92A2A5] hover:text-[#82A094]'
                            }`}
                            title={account.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => onDelete(account.id, e)}
                            className="p-2 rounded-lg hover:bg-[#E17F70]/10 text-[#92A2A5] hover:text-[#E17F70] transition-all hover:scale-110"
                            title="Delete Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function BankAccountsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showInactive, setShowInactive] = useState(false);

  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  useEffect(() => {
    loadBankAccounts();
    loadPendingCount();
  }, [showInactive]);

  const loadBankAccounts = async () => {
    try {
      setLoading(true);
      const data = await arApi.getBankAccounts({ activeOnly: !showInactive });
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const stats = await arApi.getRequestStats();
      setPendingCount(stats.pending);
    } catch (error) {
      console.error('Failed to load pending count:', error);
    }
  };

  const handleToggleStatus = useCallback(async (account: BankAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !account.isActive;
    if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this vendor account?`)) return;
    
    try {
      await arApi.updateBankAccount(account.id, { isActive: newStatus });
      await loadBankAccounts();
    } catch (error) {
      console.error('Failed to toggle bank account status:', error);
      alert('Failed to update status');
    }
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    
    try {
      await arApi.deleteBankAccount(id);
      await loadBankAccounts();
    } catch (error) {
      console.error('Failed to delete bank account:', error);
      alert('Failed to delete bank account');
    }
  }, []);

  // Memoized filtered accounts
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const search = searchTerm.toLowerCase();
    return accounts.filter(account => 
      account.vendorName.toLowerCase().includes(search) ||
      account.beneficiaryName?.toLowerCase().includes(search) ||
      account.nickName?.toLowerCase().includes(search) ||
      account.accountNumber.includes(searchTerm) ||
      account.beneficiaryBankName.toLowerCase().includes(search)
    );
  }, [accounts, searchTerm]);

  // Stats
  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter(a => a.isActive).length,
    banks: new Set(accounts.map(a => a.beneficiaryBankName)).size
  }), [accounts]);

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header Section */}
      <div className="shrink-0 space-y-4 pb-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
            >
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#546A7A]">Bank Accounts</h1>
              <p className="text-sm text-[#92A2A5]">
                Vendor payment destinations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/finance/bank-accounts/import"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#AEBFC3]/30 text-[#5D6E73] hover:bg-[#F8FAFB] text-sm font-medium transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </Link>
            )}
            <Link 
              href="/finance/bank-accounts/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-all text-sm"
              style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)' }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{isAdmin ? 'Add Account' : 'Request'}</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard 
            icon={CreditCard}
            label="Total Accounts"
            value={stats.total}
            loading={loading}
            variant="primary"
          />
          <StatCard 
            icon={Check}
            label="Active"
            value={stats.active}
            loading={loading}
            variant="success"
          />
          <StatCard 
            icon={Landmark}
            label="Banks"
            value={stats.banks}
            loading={loading}
            variant="secondary"
          />
          <StatCard 
            icon={Clock}
            label="Pending Requests"
            value={pendingCount}
            loading={false}
            variant="warning"
            href="/finance/bank-accounts/requests"
          />
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-[#AEBFC3]/20 p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-9 pr-4 py-2 bg-[#F8FAFB] border border-[#AEBFC3]/20 rounded-lg text-sm text-[#546A7A] placeholder:text-[#92A2A5] focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-1 focus:ring-[#CE9F6B]/20 focus:bg-white transition-all"
              />
            </div>

            {/* Inactive Toggle */}
            {isAdmin && (
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  showInactive 
                    ? 'bg-[#AEBFC3]/20 border-[#AEBFC3] text-[#546A7A]' 
                    : 'bg-white border-[#AEBFC3]/20 text-[#92A2A5] hover:border-[#CE9F6B]/30'
                }`}
              >
                <EyeOff className="w-4 h-4" />
                <span className="hidden md:inline">
                  {showInactive ? 'All' : 'Inactive'}
                </span>
              </button>
            )}
          </div>

          {/* View Toggle & Actions */}
          <div className="flex items-center gap-2">
            {/* Pending Badge */}
            {isAdmin && pendingCount > 0 && (
              <Link
                href="/finance/bank-accounts/requests"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E17F70]/10 text-[#E17F70] font-medium text-sm hover:bg-[#E17F70]/20 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>{pendingCount}</span>
              </Link>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#F8FAFB] rounded-lg p-0.5 border border-[#AEBFC3]/20">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-[#CE9F6B] text-white shadow-sm' 
                    : 'text-[#92A2A5] hover:text-[#546A7A]'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'table' 
                    ? 'bg-[#CE9F6B] text-white shadow-sm' 
                    : 'text-[#92A2A5] hover:text-[#546A7A]'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#92A2A5]">
            {loading ? 'Loading...' : `${filteredAccounts.length} account${filteredAccounts.length !== 1 ? 's' : ''}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
          {stats.active > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-[#718E85]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#82A094]" />
              {stats.active} active
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden -mx-1 px-1 pb-4">
        {loading ? (
          // Loading Skeleton - Card shaped
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div 
                  className="bg-gradient-to-br from-[#AEBFC3]/30 to-[#AEBFC3]/10 rounded-2xl"
                  style={{ aspectRatio: '1.586 / 1' }}
                />
                <div className="mt-3 flex justify-between px-1">
                  <div className="h-4 bg-[#AEBFC3]/30 rounded w-16" />
                  <div className="flex gap-1">
                    <div className="h-8 w-8 bg-[#AEBFC3]/20 rounded-lg" />
                    <div className="h-8 w-8 bg-[#AEBFC3]/20 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAccounts.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-xl"
              style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
            >
              <CreditCard className="w-10 h-10 text-white/80" />
            </div>
            <h3 className="text-lg font-semibold text-[#546A7A] mb-2">
              {searchTerm ? 'No matching accounts' : 'No bank accounts'}
            </h3>
            <p className="text-sm text-[#92A2A5] max-w-sm mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Add your first bank account to start managing vendor payments'}
            </p>
            <Link 
              href="/finance/bank-accounts/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-lg"
              style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)' }}
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </Link>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View - Premium Bank Cards
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredAccounts.map((account) => (
              <BankCard
                key={account.id}
                account={account}
                isAdmin={isAdmin}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          // Table View
          <VendorTable
            accounts={filteredAccounts}
            isAdmin={isAdmin}
            onToggleStatus={handleToggleStatus}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}
