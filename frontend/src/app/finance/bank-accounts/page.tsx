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
      {/* Subtle shine effect on hover */}
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
      
      {/* Bottom accent line */}
      {href && (
        <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/20 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
      )}
    </div>
  );

  if (href) return <Link href={href}>{Content}</Link>;
  return Content;
};

// ============================================================================
// PROFESSIONAL BANK ACCOUNT CARD COMPONENT - WORLD CLASS DESIGN
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
  const [isHovered, setIsHovered] = useState(false);

  const copyToClipboard = useCallback((text: string, field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div 
      onClick={() => router.push(`/finance/bank-accounts/${account.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group cursor-pointer perspective-1000"
    >
      {/* The Premium Card */}
      <div 
        className={`
          relative rounded-2xl overflow-hidden 
          shadow-[0_8px_30px_rgba(0,0,0,0.12)] 
          hover:shadow-[0_20px_60px_rgba(0,0,0,0.25)] 
          transition-all duration-500 ease-out
          hover:-translate-y-2 hover:rotate-x-[-2deg]
          transform-gpu
        `}
        style={{ 
          background: theme.bg,
          aspectRatio: '1.586 / 1'
        }}
      >
        {/* Holographic Shine Overlay */}
        <div 
          className={`
            absolute inset-0 
            bg-gradient-to-br from-white/30 via-transparent via-50% to-white/10
            opacity-0 group-hover:opacity-100 
            transition-opacity duration-700
            pointer-events-none
          `}
          style={{
            background: isHovered 
              ? 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.2) 100%)'
              : 'none'
          }}
        />

        {/* Subtle Pattern Texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              white 2px,
              white 4px
            )`
          }}
        />

        {/* Floating Action Buttons - Premium Glass Effect */}
        <div className={`
          absolute top-3 right-3 flex items-center gap-1.5 z-20
          opacity-0 group-hover:opacity-100 
          translate-y-2 group-hover:translate-y-0
          transition-all duration-300 delay-100
        `}>
          <Link
            href={`/finance/bank-accounts/${account.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-xl bg-white/95 backdrop-blur-xl hover:bg-white text-[#6F8A9D] hover:text-[#546A7A] hover:scale-110 transition-all duration-200 shadow-lg hover:shadow-xl"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <Link
            href={`/finance/bank-accounts/${account.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-xl bg-white/95 backdrop-blur-xl hover:bg-white text-[#CE9F6B] hover:text-[#976E44] hover:scale-110 transition-all duration-200 shadow-lg hover:shadow-xl"
            title="Edit Account"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          {isAdmin && (
            <>
              <button
                onClick={(e) => onToggleStatus(account, e)}
                className={`p-2.5 rounded-xl bg-white/95 backdrop-blur-xl hover:bg-white hover:scale-110 transition-all duration-200 shadow-lg hover:shadow-xl ${
                  account.isActive ? 'text-[#E17F70] hover:text-[#C45C4D]' : 'text-[#82A094] hover:text-[#4F6A64]'
                }`}
                title={account.isActive ? "Deactivate" : "Activate"}
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => onDelete(account.id, e)}
                className="p-2.5 rounded-xl bg-white/95 backdrop-blur-xl hover:bg-white text-[#E17F70] hover:text-[#C45C4D] hover:scale-110 transition-all duration-200 shadow-lg hover:shadow-xl"
                title="Delete Account"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Card Content */}
        <div className="relative h-full p-5 flex flex-col justify-between">
          {/* Top Section - Bank & Chip */}
          <div className="flex items-start justify-between">
            {/* Bank Logo Area */}
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Card Chip - Realistic Design */}
                <div className="w-11 h-8 rounded-md bg-gradient-to-br from-[#D4AF37] via-[#F5D982] to-[#C9A227] shadow-md overflow-hidden">
                  <div className="absolute inset-0 grid grid-cols-3 gap-px p-1">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-[#B8860B]/30 rounded-sm" />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-white text-sm font-bold truncate max-w-[140px] drop-shadow-md">
                  {account.beneficiaryBankName}
                </p>
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mt-0.5">
                  {account.currency}{account.accountType ? ` • ${account.accountType}` : ''} Account
                </p>
                {account.bpCode && (
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0.5 px-1.5 py-0.5 rounded bg-white/10 w-fit">
                    {account.bpCode}
                  </p>
                )}
              </div>
            </div>

            {/* Status & NFC */}
            <div className="flex flex-col items-end gap-2">
              {/* NFC Icon */}
              <Wifi className="w-5 h-5 text-white/40 rotate-90" />
              
              {/* Status Indicator */}
              <div className="flex items-center gap-1.5">
                <div className={`relative w-2.5 h-2.5 rounded-full ${account.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`}>
                  {account.isActive && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
                  )}
                </div>
                {account.isMSME && (
                  <span className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-[#CE9F6B]/40 text-white uppercase tracking-wider backdrop-blur-sm">
                    MSME
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Middle - Account Number Section */}
          <div className="space-y-3 my-3">
            {/* Account Number - Hero Display */}
            <div>
              <p className="text-white/50 text-[9px] uppercase tracking-[0.2em] font-bold mb-1">
                Account Number
              </p>
              <div className="flex items-center gap-2">
                <p 
                  className="text-white text-lg font-mono tracking-[0.15em] font-black"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                >
                  {account.accountNumber}
                </p>
                <button
                  onClick={(e) => copyToClipboard(account.accountNumber, 'account', e)}
                  className={`p-1 rounded-lg transition-all duration-200 ${
                    copied === 'account' 
                      ? 'bg-emerald-500/50 text-white scale-110' 
                      : 'text-white/40 hover:text-white hover:bg-white/15 hover:scale-105'
                  }`}
                >
                  {copied === 'account' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* IFSC Code */}
            <div className="flex items-center gap-3">
              <div>
                <p className="text-white/50 text-[9px] uppercase tracking-[0.2em] font-bold mb-1">
                  IFSC Code / SWIFT Code
                </p>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-white text-xs font-mono font-bold tracking-[0.2em]"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                  >
                    {account.ifscCode}
                  </span>
                  <button
                    onClick={(e) => copyToClipboard(account.ifscCode, 'ifsc', e)}
                    className={`p-0.5 rounded-md transition-all ${
                      copied === 'ifsc' ? 'text-emerald-300' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {copied === 'ifsc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom - Account Holder */}
          <div className="pt-3 border-t border-white/15">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-[8px] uppercase tracking-[0.2em] font-bold mb-1">Account Holder</p>
                <p 
                  className="text-white text-sm font-bold uppercase tracking-wide truncate"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                  title={account.vendorName}
                >
                  {account.vendorName}
                </p>
                {account.nickName && (
                  <p className="text-white/50 text-[10px] truncate italic mt-0.5">
                    "{account.nickName}"
                  </p>
                )}
              </div>
              
              {/* Security Badge */}
              <div className="flex items-center gap-1.5 text-white/30 ml-3">
                <Shield className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Secure</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Accent Line */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, ${theme.accent}40, ${theme.accent}, ${theme.accent}40)` }}
        />
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
    <div className="bg-white rounded-2xl border-0 shadow-2xl overflow-hidden">
      <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-[#B18E63] via-[#82A094] to-[#6F8A9D] text-white">
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider w-16">
                <span className="sr-only">Avatar</span>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-white/70" />
                  Vendor
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-white/70" />
                  BP Code
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-white/70" />
                  Vendor Bank Details
                </div>
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-white/70" />
                  Account Number
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-white/70" />
                  Currency
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-white/70" />
                  Status
                </div>
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((account, index) => {
              const theme = getCardTheme(account.vendorName);
              const initials = getInitials(account.vendorName);

              return (
                <tr 
                  key={account.id}
                  onClick={() => router.push(`/finance/bank-accounts/${account.id}`)}
                  className={`
                    ${index % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/5'}
                    hover:bg-gradient-to-r hover:from-[#CE9F6B]/10 hover:to-[#CE9F6B]/5
                    transition-all duration-200 cursor-pointer group
                  `}
                >
                  {/* Avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0"
                        style={{ background: theme.bg }}
                      >
                        {initials}
                      </div>
                    </div>
                  </td>

                  {/* Vendor Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#546A7A] text-sm truncate max-w-[180px] group-hover:text-[#976E44] transition-colors">
                            {account.vendorName}
                          </p>
                          {account.isMSME && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#CE9F6B]/20 text-[#976E44] rounded">
                              MSME
                            </span>
                          )}
                        </div>
                        {account.nickName && (
                          <p className="text-xs text-[#92A2A5] truncate max-w-[180px]">"{account.nickName}"</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* BP Code */}
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-bold rounded-md bg-[#6F8A9D]/10 text-[#546A7A] font-mono uppercase tracking-wider">
                      {account.bpCode || '—'}
                    </span>
                  </td>

                  {/* Bank */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#6F8A9D] flex-shrink-0"></div>
                        <span className="text-[#5D6E73] text-sm font-medium">{account.beneficiaryBankName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex px-2 py-1 text-xs font-bold rounded-md bg-[#CE9F6B]/20 text-[#976E44] font-mono">
                          {account.ifscCode}
                        </span>
                        <button 
                          onClick={(e) => copyToClipboard(account.ifscCode, `ifsc-${account.id}`, e)}
                          className={`p-1 rounded transition-all ${
                            copied === `ifsc-${account.id}` 
                              ? 'text-[#82A094]' 
                              : 'text-[#AEBFC3] hover:text-[#CE9F6B]'
                          }`}
                        >
                          {copied === `ifsc-${account.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Account Number */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#546A7A]">{account.accountNumber}</span>
                      <button 
                        onClick={(e) => copyToClipboard(account.accountNumber, `acc-${account.id}`, e)}
                        className={`p-1 rounded transition-all ${
                          copied === `acc-${account.id}` 
                            ? 'text-[#82A094]' 
                            : 'text-[#AEBFC3] hover:text-[#CE9F6B]'
                        }`}
                      >
                        {copied === `acc-${account.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>

                  {/* Currency */}
                  <td className="px-4 py-3 text-center">
                    <span className={`
                      inline-flex px-2 py-1 text-xs font-bold rounded-md
                      ${account.currency === 'INR' 
                        ? 'bg-[#82A094]/20 text-[#4F6A64]' 
                        : account.currency === 'USD'
                        ? 'bg-[#6F8A9D]/20 text-[#546A7A]'
                        : account.currency === 'EUR'
                        ? 'bg-[#CE9F6B]/20 text-[#976E44]'
                        : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
                      }
                    `}>
                      {account.currency}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <span className={`
                      inline-flex px-2.5 py-1 text-xs font-bold rounded-full shadow-sm
                      ${account.isActive 
                        ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white' 
                        : 'bg-gradient-to-r from-[#AEBFC3] to-[#92A2A5] text-white'
                      }
                    `}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/finance/bank-accounts/${account.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-[#92A2A5]/20 text-[#5D6E73] transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/finance/bank-accounts/${account.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg hover:bg-[#CE9F6B]/20 text-[#5D6E73] hover:text-[#CE9F6B] transition-colors"
                        title="Edit Account"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => onToggleStatus(account, e)}
                            className={`p-2 rounded-lg transition-colors ${
                              account.isActive 
                                ? 'hover:bg-[#E17F70]/20 text-[#5D6E73] hover:text-[#E17F70]' 
                                : 'hover:bg-[#82A094]/20 text-[#5D6E73] hover:text-[#82A094]'
                            }`}
                            title={account.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => onDelete(account.id, e)}
                            className="p-2 rounded-lg hover:bg-[#E17F70]/20 text-[#5D6E73] hover:text-[#E17F70] transition-colors"
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

  const isFinanceAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;
  const isFinanceUser = user?.financeRole === FinanceRole.FINANCE_USER;
  const isAdmin = isFinanceAdmin; // Keep isAdmin for backward compatibility in the component
  const canImport = isFinanceAdmin || isFinanceUser;


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
    if (!confirm('Are you sure you want to delete this vendor bank account?')) return;
    
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
      account.bpCode?.toLowerCase().includes(search) ||
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
      <div className="shrink-0 space-y-5 pb-5">
        {/* Page Header - Enhanced */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-br from-[#CE9F6B]/30 to-[#82A094]/30 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <div 
                className="relative w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300"
                style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
              >
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                  Vendor Bank Accounts
                </span>
              </h1>
              <p className="text-sm text-[#92A2A5] mt-0.5">
                Manage vendor payment destinations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canImport && (

              <Link
                href="/finance/bank-accounts/import"
                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#AEBFC3]/30 text-[#5D6E73] hover:bg-white hover:border-[#CE9F6B]/30 hover:shadow-md text-sm font-medium transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 group-hover:text-[#CE9F6B] transition-colors" />
                <span className="hidden sm:inline">Import</span>
              </Link>
            )}
            <Link
              href="/finance/bank-accounts/payments"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all text-sm hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
            >
              <CreditCard className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
              <span className="hidden sm:inline">Bulk Payments</span>
            </Link>
            <Link
              href="/finance/bank-accounts/payment-batches"
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#AEBFC3]/30 text-[#5D6E73] hover:bg-white hover:border-[#CE9F6B]/30 hover:shadow-md text-sm font-medium transition-all"
            >
              <Shield className="w-4 h-4 group-hover:text-[#CE9F6B] transition-colors" />
              <span className="hidden sm:inline">Payment Approvals</span>
            </Link>
            <Link 
              href="/finance/bank-accounts/new"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all text-sm hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)' }}
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              <span className="hidden sm:inline">{isAdmin ? 'Add Account' : 'Request New'}</span>
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

        {/* Controls Bar - Enhanced */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-[#AEBFC3]/20 p-4 shadow-sm">
          <div className="flex items-center gap-3 flex-1">
            {/* Search - Improved */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] group-focus-within:text-[#CE9F6B] transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by vendor, bank, or account..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F8F9FB] border border-[#AEBFC3]/20 rounded-xl text-sm text-[#546A7A] placeholder:text-[#92A2A5]/70 focus:outline-none focus:border-[#CE9F6B]/50 focus:ring-2 focus:ring-[#CE9F6B]/10 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[#AEBFC3]/20 text-[#92A2A5] hover:text-[#546A7A] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Inactive Toggle - Enhanced */}
            {canImport && (

              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  showInactive 
                    ? 'bg-gradient-to-r from-[#AEBFC3]/20 to-[#AEBFC3]/10 border-[#AEBFC3]/40 text-[#546A7A] shadow-sm' 
                    : 'bg-white border-[#AEBFC3]/20 text-[#92A2A5] hover:border-[#CE9F6B]/30 hover:text-[#5D6E73]'
                }`}
              >
                <EyeOff className="w-4 h-4" />
                <span className="hidden md:inline">
                  {showInactive ? 'Showing All' : 'Show Inactive'}
                </span>
              </button>
            )}
          </div>

          {/* View Toggle & Actions */}
          <div className="flex items-center gap-2">
            {/* Pending Badge */}
            {canImport && pendingCount > 0 && (

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
          // Empty State - Premium Design
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#CE9F6B]/10 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[#82A094]/10 rounded-full blur-3xl" />
            </div>
            
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-br from-[#CE9F6B]/20 to-[#82A094]/20 rounded-3xl blur-2xl" />
              <div 
                className="relative w-24 h-24 rounded-2xl flex items-center justify-center mb-8 shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #B18E63 0%, #7A5A38 100%)' }}
              >
                <CreditCard className="w-12 h-12 text-white/90" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-[#546A7A] mb-3">
              {searchTerm ? 'No matching accounts found' : 'No vendor bank accounts yet'}
            </h3>
              <p className="text-[#AEBFC3] text-sm md:text-base max-w-sm mx-auto leading-relaxed">
                {searchTerm
                ? 'Try adjusting your search filters to find what you looking for.'
                : 'Add your first vendor bank account to start managing vendor payment destinations securely.'}
              </p>

            {!searchTerm && (
              <Link
                href="/finance/bank-accounts/new"
                className="group flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)' }}
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                Add Your First Account
              </Link>
            )}
            
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#AEBFC3]/30 text-[#5D6E73] hover:bg-white hover:shadow-md font-medium transition-all"
              >
                Clear Search
              </button>
            )}
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
