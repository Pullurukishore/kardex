'use client';

import { Fragment, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { arApi, formatARCurrency, formatARDate, formatARMonth, PIC_OPTIONS } from '@/lib/ar-api';
import * as XLSX from 'xlsx';
import {
  FileText, Wallet, Search, RefreshCw, Download, AlertTriangle, Clock,
  CheckCircle2, TrendingUp, IndianRupee, Shield, ShieldAlert, ShieldCheck,
  Layers, ArrowUpRight, ChevronDown, ChevronUp, Filter, X, Calendar, Eye,
  BarChart3, PieChart, Tag, Package, PackageCheck, Truck, Timer, Receipt,
  Users, CreditCard, Activity, ChevronLeft, ChevronRight, ExternalLink,
  Sparkles, MessageSquare, CheckCircle, PackageX, BadgeCheck, ArrowRight,
  XCircle, FileX2
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const termOptions: Record<string, string> = {
  ABG: 'ABG',
  PO: 'PO',
  DELIVERY: 'Delivery',
  FAR: 'FAR',
  PBG: 'PBG',
  FAR_PBG: 'FAR & PBG',
  INVOICE_SUBMISSION: 'Invoice Submission',
  PI: 'PI',
  OTHER: 'Other',
};

// --- Helper: Get Milestone Stage Config ---
const getMilestoneStageConfig = (status?: string) => {
  switch (status) {
    case 'AWAITING_DELIVERY': return { bg: 'bg-[#CE9F6B]/15', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/40', icon: Package, label: 'Awaiting Delivery' };
    case 'PARTIALLY_DELIVERED': return { bg: 'bg-[#6F8A9D]/15', text: 'text-[#546A7A]', border: 'border-[#6F8A9D]/40', icon: Truck, label: 'Partially Delivered' };
    case 'FULLY_DELIVERED': return { bg: 'bg-[#82A094]/15', text: 'text-[#4F6A64]', border: 'border-[#82A094]/40', icon: PackageCheck, label: 'Fully Delivered' };
    case 'EXPIRED': return { bg: 'bg-[#E17F70]/15', text: 'text-[#9E3B47]', border: 'border-[#E17F70]/40', icon: PackageX, label: 'Expired' };
    case 'LINKED': return { bg: 'bg-[#82A094]/15', text: 'text-[#4F6A64]', border: 'border-[#82A094]/40', icon: BadgeCheck, label: 'Linked' };
    default: return { bg: 'bg-[#AEBFC3]/15', text: 'text-[#5D6E73]', border: 'border-[#AEBFC3]/30', icon: Package, label: 'Pending' };
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// REPORT TAB TYPE
// ═══════════════════════════════════════════════════════════════════════════
type ReportTab = 'invoice' | 'milestone' | 'customer';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS  
// ═══════════════════════════════════════════════════════════════════════════
// --- Sub-Component: Payment Terms & Aging Dropdown ---
function MilestoneTimelineView({ invoice }: { invoice: any }) {
  const milestoneTerms = (invoice.milestoneTerms || []).slice().sort((a: any, b: any) => new Date(a.termDate).getTime() - new Date(b.termDate).getTime());
  const netAmount = Number(invoice.netAmount || 0);

  if (milestoneTerms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#92A2A5] bg-gradient-to-br from-[#AEBFC3]/5 to-[#96AEC2]/5 border-y-2 border-dashed border-[#AEBFC3]/30">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/5 mb-4 shadow-lg border border-[#AEBFC3]/20">
          <Tag className="w-6 h-6 text-[#92A2A5]" />
        </div>
        <p className="text-sm font-bold tracking-tight text-[#546A7A]">No payment milestones configured</p>
        <Link 
          href={`/finance/ar/milestones/${invoice.id}`}
          className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white text-xs font-bold hover:shadow-lg hover:shadow-[#CE9F6B]/20 transition-all"
        >
          CONFIGURE MILESTONES →
        </Link>
      </div>
    );
  }

  // Calculate collections per term using specific targets -> FIFO generic pool fallback
  const paymentsByTarget: Record<string, number> = {};
  let genericPool = 0;

  (invoice.paymentHistory || []).forEach((p: any) => {
    if (p.milestoneTerm) {
      paymentsByTarget[p.milestoneTerm] = (paymentsByTarget[p.milestoneTerm] || 0) + (Number(p.amount) || 0);
    } else {
      genericPool += (Number(p.amount) || 0);
    }
  });

  const termCollections = milestoneTerms.map((term: any) => {
    const percentage = term.percentage || 0;
    const taxPercentage = term.taxPercentage || 0;
    const isNetBasis = term.calculationBasis !== 'TOTAL_AMOUNT';
    const termId = `${term.termType}-${term.termDate}-${percentage}-${taxPercentage}`;
    
    let allocatedAmount = 0;
    if (isNetBasis) {
      allocatedAmount = (netAmount * percentage) / 100;
    } else {
      const netPortion = (netAmount * percentage) / 100;
      const taxPortion = (Number(invoice.taxAmount || 0) * taxPercentage) / 100;
      allocatedAmount = netPortion + taxPortion;
    }

    let collectedForTerm = (paymentsByTarget[termId] || 0) + (paymentsByTarget[term.termType] || 0);
    
    if (paymentsByTarget[termId]) delete paymentsByTarget[termId];
    if (paymentsByTarget[term.termType]) delete paymentsByTarget[term.termType];

    if (collectedForTerm > allocatedAmount) {
      genericPool += (collectedForTerm - allocatedAmount);
      collectedForTerm = allocatedAmount;
    }

    return {
      termId,
      allocatedAmount,
      collectedForTerm,
      pendingForTerm: 0,
      collectedPercent: 0,
      isNetBasis,
    };
  });

  Object.values(paymentsByTarget).forEach(orphanAmount => {
    genericPool += orphanAmount;
  });

  termCollections.forEach((tc: any) => {
    const gap = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    const fromGeneric = Math.min(gap, genericPool);
    tc.collectedForTerm += fromGeneric;
    genericPool -= fromGeneric;
    
    tc.pendingForTerm = Math.max(0, tc.allocatedAmount - tc.collectedForTerm);
    tc.collectedPercent = tc.allocatedAmount > 0 ? (tc.collectedForTerm / tc.allocatedAmount) * 100 : 0;
  });

  return (
    <div className="relative bg-white border-y-2 border-[#6F8A9D]/20 shadow-inner">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-lg">
             <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wide">Payment Milestones & Aging</h3>
            <p className="text-[10px] text-white/60 font-bold uppercase">{milestoneTerms.length} Scheduled Stages</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-[9px] font-bold text-white/70 uppercase tracking-tight">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#E17F70] shadow-[0_0_8px_#E17F70]" /> Overdue</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#82A094] shadow-[0_0_8px_#82A094]" /> On Track</div>
          </div>
          <Link 
            href={`/finance/ar/milestones/${invoice.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-[10px] font-bold text-white hover:bg-white/25 transition-all shadow-lg"
          >
            EDIT PLAN <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-[#AEBFC3]/20">
        {milestoneTerms.map((term: any, index: number) => {
          const termDate = new Date(term.termDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const termAging = Math.floor((today.getTime() - termDate.getTime()) / (1000 * 60 * 60 * 24));
          const allocation = termCollections[index];
          const collectedPercent = allocation?.collectedPercent || 0;
          const isFullyPaid = allocation.pendingForTerm < 0.01 && allocation.allocatedAmount > 0;
          const isTermOverdue = termAging > 0 && !isFullyPaid;

          return (
            <div key={index} className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 px-6 py-5 transition-all duration-300 ${
              isTermOverdue ? 'bg-gradient-to-r from-[#E17F70]/5 to-[#9E3B47]/5' : 'bg-white'
            } hover:bg-[#96AEC2]/5`}>
              <div className="sm:w-[25%] flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-lg transition-all ${
                  isFullyPaid ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] text-white shadow-[#82A094]/20' : 
                  isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 text-[#9E3B47] border-2 border-[#E17F70]/30' : 
                  'bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/10 text-[#546A7A] border-2 border-[#6F8A9D]/20'
                }`}>
                  {isFullyPaid ? <CheckCircle className="w-5 h-5" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#546A7A] text-sm uppercase tracking-tight">
                    {term.termType === 'OTHER' ? term.customLabel : termOptions[term.termType] || term.termType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-[#CE9F6B]">{term.percentage}%</span>
                    <span className="w-1 h-1 rounded-full bg-[#AEBFC3]/40" />
                    <span className="text-[10px] font-bold text-[#92A2A5]">{formatARDate(term.termDate)}</span>
                  </div>
                </div>
              </div>

              <div className="sm:w-[45%] sm:px-6">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/5 p-2.5 rounded-xl border-2 border-[#AEBFC3]/20 hover:border-[#96AEC2]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#92A2A5] uppercase tracking-wide mb-0.5">Allocated</p>
                    <p className="text-xs font-bold text-[#546A7A]">{formatARCurrency(allocation?.allocatedAmount || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#82A094]/15 to-[#4F6A64]/10 p-2.5 rounded-xl border-2 border-[#82A094]/20 hover:border-[#82A094]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#4F6A64] uppercase tracking-wide mb-0.5">Received</p>
                    <p className="text-xs font-bold text-[#4F6A64]">{formatARCurrency(allocation?.collectedForTerm || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#E17F70]/15 to-[#9E3B47]/10 p-2.5 rounded-xl border-2 border-[#E17F70]/20 hover:border-[#E17F70]/40 transition-all">
                    <p className="text-[9px] font-bold text-[#9E3B47] uppercase tracking-wide mb-0.5">Pending</p>
                    <p className={`text-xs font-bold ${allocation?.pendingForTerm || 0 > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'}`}>
                      {formatARCurrency(allocation?.pendingForTerm || 0)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden shadow-inner border border-[#AEBFC3]/20">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out relative ${
                        isFullyPaid ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]' : 
                        collectedPercent >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]' : 
                        'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A]'
                      }`}
                      style={{ width: `${Math.min(100, collectedPercent)}%` }}
                    >
                      <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/30" />
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold min-w-[35px] text-right ${
                    isFullyPaid ? 'text-[#82A094]' : collectedPercent >= 50 ? 'text-[#CE9F6B]' : 'text-[#6F8A9D]'
                   }`}>{isFullyPaid ? '100%' : `${Math.floor(collectedPercent)}%`}</span>
                </div>
              </div>

              <div className="sm:w-[30%] flex items-center justify-end gap-4">
                <div className="text-right">
                  <p className={`text-lg font-bold leading-none tracking-tight ${
                    isFullyPaid ? 'text-[#82A094]' : isTermOverdue ? 'text-[#9E3B47]' : 'text-[#546A7A]'
                  }`}>
                    {isFullyPaid ? 'CLEARED' : termAging > 0 ? `${termAging}d` : `${Math.abs(termAging)}d`}
                  </p>
                  <p className="text-[9px] font-bold text-[#92A2A5] uppercase tracking-wide mt-1">
                    {isFullyPaid ? 'PAYMENT RECEIVED' : termAging > 0 ? 'OVERDUE RISK' : 'REMAINING'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg border-2 ${
                  isFullyPaid ? 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10 text-[#82A094] border-[#82A094]/30' : 
                  isTermOverdue ? 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 text-[#E17F70] border-[#E17F70]/30' : 
                  'bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/10 text-[#546A7A] border-[#6F8A9D]/20'
                }`}>
                  {isFullyPaid ? <CheckCircle2 className="w-5 h-5" /> : 
                   isTermOverdue ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : 
                   <Timer className="w-5 h-5" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guarantees Tracking */}
      {(invoice.hasAPG || invoice.hasPBG) && (
        <div className="p-6 border-t-2 border-[#AEBFC3]/20 bg-[#F8FAFB]/50">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#546A7A] text-sm uppercase tracking-wider">Guarantees Tracking</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {invoice.hasAPG && (
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm">
                <h4 className="font-bold text-[#E17F70] flex items-center gap-2 text-xs uppercase tracking-tight pb-3 border-b border-[#AEBFC3]/20">
                  <Tag className="w-3.5 h-3.5" /> ABG Tracking
                </h4>
                <div className="space-y-6 pt-2">
                  {/* Draft */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B] mt-1.5" />
                      <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                    </div>
                    <div className="flex-1 pb-2">
                      <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft ABG</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#5D6E73] text-xs">{invoice.apgDraftDate ? formatARDate(invoice.apgDraftDate) : '-'}</span>
                        <span className="text-[10px] text-[#92A2A5] italic">{invoice.apgDraftNote || ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* APG Draft Steps */}
                  {Array.isArray(invoice.apgDraftSteps) && invoice.apgDraftSteps.map((step: any, idx: number) => (
                    <div key={`apg-draft-${idx}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B]/60 mt-1.5" />
                        <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* APG Signed Steps */}
                  {Array.isArray(invoice.apgSignedSteps) && invoice.apgSignedSteps.map((step: any, idx: number) => (
                    <div key={`apg-signed-${idx}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#82A094]/60 mt-1.5" />
                        <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Signed */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20" />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed ABG</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#5D6E73] text-xs">{invoice.apgSignedDate ? formatARDate(invoice.apgSignedDate) : '-'}</span>
                        <span className="text-[10px] text-[#92A2A5] italic">{invoice.apgSignedNote || ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {invoice.hasPBG && (
              <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm">
                <h4 className="font-bold text-[#CE9F6B] flex items-center gap-2 text-xs uppercase tracking-tight pb-3 border-b border-[#AEBFC3]/20">
                  <Tag className="w-3.5 h-3.5" /> PBG Tracking
                </h4>
                <div className="space-y-6 pt-2">
                  {/* Draft */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B] mt-1.5" />
                      <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                    </div>
                    <div className="flex-1 pb-2">
                      <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft PBG</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#5D6E73] text-xs">{invoice.pbgDraftDate ? formatARDate(invoice.pbgDraftDate) : '-'}</span>
                        <span className="text-[10px] text-[#92A2A5] italic">{invoice.pbgDraftNote || ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* PBG Draft Steps */}
                  {Array.isArray(invoice.pbgDraftSteps) && invoice.pbgDraftSteps.map((step: any, idx: number) => (
                    <div key={`pbg-draft-${idx}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B]/60 mt-1.5" />
                        <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* PBG Signed Steps */}
                  {Array.isArray(invoice.pbgSignedSteps) && invoice.pbgSignedSteps.map((step: any, idx: number) => (
                    <div key={`pbg-signed-${idx}`} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#82A094]/60 mt-1.5" />
                        <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Signed */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20" />
                    </div>
                    <div className="flex-1">
                      <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed PBG</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-[#5D6E73] text-xs">{invoice.pbgSignedDate ? formatARDate(invoice.pbgSignedDate) : '-'}</span>
                        <span className="text-[10px] text-[#92A2A5] italic">{invoice.pbgSignedNote || ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const InvoiceTimelineView = ({ invoice }: { invoice: any }) => {
  const receipts = invoice.paymentHistory || [];
  const remarks = invoice.remarks || [];
  
  return (
    <div className="p-6 bg-gradient-to-br from-[#F8FAFB] to-white">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
             <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/20 p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#546A7A] to-[#6F8A9D]" />
                <h4 className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest mb-4 flex items-center gap-2">
                   <IndianRupee className="w-3 h-3" /> Financial Summary
                </h4>
                <div className="space-y-4">
                   <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-[#5D6E73]">Total Invoiced</span>
                      <span className="text-sm font-black text-[#546A7A]">{formatARCurrency(Number(invoice.totalAmount))}</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-[#5D6E73]">Total Received</span>
                      <span className="text-sm font-black text-[#82A094]">{formatARCurrency(Number(invoice.totalReceipts))}</span>
                   </div>
                   <div className="pt-3 border-t-2 border-[#AEBFC3]/10 flex justify-between items-end">
                      <span className="text-xs font-bold text-[#92A2A5]">Current Balance</span>
                      <span className="text-lg font-black text-[#E17F70]">{formatARCurrency(Number(invoice.balance))}</span>
                   </div>
                </div>
                <div className="mt-6">
                   <div className="flex justify-between text-[10px] font-black text-[#92A2A5] uppercase mb-1.5">
                      <span>Collection Progress</span>
                      <span>{Math.min(100, Math.round((Number(invoice.totalReceipts)/Number(invoice.totalAmount || 1))*100))}%</span>
                   </div>
                   <div className="h-2 w-full bg-[#AEBFC3]/20 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] transition-all duration-1000 shadow-lg" style={{ width: `${Math.min(100, (Number(invoice.totalReceipts)/Number(invoice.totalAmount || 1))*100)}%` }} />
                   </div>
                </div>
             </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
             <div className="bg-white rounded-2xl border-2 border-[#AEBFC3]/20 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b-2 border-[#AEBFC3]/10 bg-[#F8FAFB] flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-[#546A7A] uppercase tracking-widest flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5 text-[#6F8A9D]" /> Payment Trail
                   </h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                   <table className="w-full text-xs font-medium">
                      <thead>
                         <tr className="bg-[#AEBFC3]/5 text-[#92A2A5] uppercase text-[9px] font-black tracking-tighter">
                            <th className="py-2 px-4 text-left">Date</th>
                            <th className="py-2 px-4 text-left">Mode</th>
                            <th className="py-2 px-4 text-right">Amount</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-[#AEBFC3]/10">
                         {receipts.length === 0 ? (
                           <tr><td colSpan={3} className="py-12 text-center text-[#92A2A5] italic">No payments recorded.</td></tr>
                         ) : (
                           receipts.map((p: any, idx: number) => (
                             <tr key={p.id || `rec-${idx}`} className="hover:bg-[#F8FAFB] transition-colors">
                                <td className="py-3 px-4 font-bold text-[#546A7A]">{formatARDate(p.paymentDate)}</td>
                                <td className="py-3 px-4 uppercase text-[10px] font-bold text-[#546A7A]">{p.paymentMode}</td>
                                <td className="py-3 px-4 text-right font-black text-[#82A094]">{formatARCurrency(Number(p.amount))}</td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
             {remarks.length > 0 && (
               <div className="bg-[#CE9F6B]/5 rounded-xl border border-[#CE9F6B]/20 p-4">
                  <h5 className="text-[9px] font-black text-[#976E44] uppercase tracking-widest mb-2 flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Latest Remarks</h5>
                  <div className="space-y-2">
                     {remarks.slice(0, 2).map((rem: any, idx: number) => (
                        <div key={rem.id || `rem-${idx}`} className="text-[11px] text-[#546A7A] leading-relaxed italic border-l-2 border-[#CE9F6B]/30 pl-3">
                           &ldquo;{rem.content}&rdquo;
                           <span className="block text-[9px] text-[#976E44] mt-1 font-bold">— {rem.createdBy?.name || 'Admin'} • {formatARDate(rem.createdAt)}</span>
                        </div>
                     ))}
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Guarantees Tracking */}
        {(invoice.hasAPG || invoice.hasPBG) && (
          <div className="mt-6 pt-6 border-t-2 border-[#AEBFC3]/20">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[#546A7A] text-sm uppercase tracking-wider">Guarantees Tracking</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {invoice.hasAPG && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#E17F70]" />
                  <h4 className="font-bold text-[#E17F70] flex items-center gap-2 text-xs uppercase tracking-tight pb-3 border-b border-[#AEBFC3]/20">
                    <Tag className="w-3.5 h-3.5" /> ABG Tracking
                  </h4>
                  <div className="space-y-6 pt-2">
                    {/* Draft */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B] mt-1.5" />
                        <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft ABG</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{invoice.apgDraftDate ? formatARDate(invoice.apgDraftDate) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{invoice.apgDraftNote || ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* APG Draft Steps */}
                    {Array.isArray(invoice.apgDraftSteps) && invoice.apgDraftSteps.map((step: any, idx: number) => (
                      <div key={`apg-draft-${idx}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B]/60 mt-1.5" />
                          <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                        </div>
                        <div className="flex-1 pb-2">
                          <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                            <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* APG Signed Steps */}
                    {Array.isArray(invoice.apgSignedSteps) && invoice.apgSignedSteps.map((step: any, idx: number) => (
                      <div key={`apg-signed-${idx}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#82A094]/60 mt-1.5" />
                          <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[30px]" />
                        </div>
                        <div className="flex-1 pb-2">
                          <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                            <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Signed */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20" />
                      </div>
                      <div className="flex-1">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed ABG</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{invoice.apgSignedDate ? formatARDate(invoice.apgSignedDate) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{invoice.apgSignedNote || ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {invoice.hasPBG && (
                <div className="space-y-4 bg-white p-5 rounded-2xl border border-[#AEBFC3]/30 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#CE9F6B]" />
                  <h4 className="font-bold text-[#CE9F6B] flex items-center gap-2 text-xs uppercase tracking-tight pb-3 border-b border-[#AEBFC3]/20">
                    <Tag className="w-3.5 h-3.5" /> PBG Tracking
                  </h4>
                  <div className="space-y-6 pt-2">
                    {/* Draft */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B] mt-1.5" />
                        <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft PBG</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{invoice.pbgDraftDate ? formatARDate(invoice.pbgDraftDate) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{invoice.pbgDraftNote || ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* PBG Draft Steps */}
                    {Array.isArray(invoice.pbgDraftSteps) && invoice.pbgDraftSteps.map((step: any, idx: number) => (
                      <div key={`pbg-draft-${idx}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#CE9F6B]/60 mt-1.5" />
                          <div className="w-0.5 h-full bg-[#CE9F6B]/20 min-h-[30px]" />
                        </div>
                        <div className="flex-1 pb-2">
                          <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Draft Step {idx + 1}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                            <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* PBG Signed Steps */}
                    {Array.isArray(invoice.pbgSignedSteps) && invoice.pbgSignedSteps.map((step: any, idx: number) => (
                      <div key={`pbg-signed-${idx}`} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#82A094]/60 mt-1.5" />
                          <div className="w-0.5 h-full bg-[#82A094]/20 min-h-[30px]" />
                        </div>
                        <div className="flex-1 pb-2">
                          <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed Step {idx + 1}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-[#5D6E73] text-xs">{step.date ? formatARDate(step.date) : '-'}</span>
                            <span className="text-[10px] text-[#92A2A5] italic">{step.note || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Signed */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#82A094] mt-1.5 border-2 border-white ring-2 ring-[#82A094]/20" />
                      </div>
                      <div className="flex-1">
                        <span className="block text-[#92A2A5] text-[9px] font-black uppercase tracking-widest mb-1">Signed PBG</span>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[#5D6E73] text-xs">{invoice.pbgSignedDate ? formatARDate(invoice.pbgSignedDate) : '-'}</span>
                          <span className="text-[10px] text-[#92A2A5] italic">{invoice.pbgSignedNote || ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
     </div>
  );
};

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

const getPageNumbers = (current: number, total: number) => {
  const pages: (number | '...')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    const currentPage = current + 1; // current is 0-indexed in reports
    if (currentPage > 4) pages.push('...');
    
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(total - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) pages.push(i);
    
    if (currentPage < total - 3) pages.push('...');
    pages.push(total);
  }
  return pages;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [personInChargeFilter, setPersonInChargeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [acctFilter, setAcctFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [guaranteeFilter, setGuaranteeFilter] = useState('');
  const [sortField, setSortField] = useState('invoiceDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [availablePaymentModes, setAvailablePaymentModes] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [page, setPage] = useState(0);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else {
        // Option to only have one expanded row at a time for cleaner layout if file is massive
        // next.clear(); 
        next.add(id);
      }
      return next;
    });
  };

  const [pageSize, setPageSize] = useState(50);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [forecastDate, setForecastDate] = useState<string>('');

  useEffect(() => {
    arApi.getReportFilters().then(data => {
      setAvailablePaymentModes(data.paymentModes);
    }).catch(err => console.error("Error loading filters:", err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTab, search, statusFilter, riskFilter, typeFilter, acctFilter, personInChargeFilter, fromDate, toDate, forecastDate, paymentModeFilter, guaranteeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setPage(0);
      const params = {
        search: search || undefined,
        status: statusFilter || undefined,
        riskClass: riskFilter || undefined,
        type: typeFilter || undefined,
        personInCharge: personInChargeFilter || undefined,
        accountingStatus: acctFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        forecastDate: forecastDate || undefined,
        paymentMode: paymentModeFilter || undefined,
        guarantees: guaranteeFilter || undefined,
      };

      if (activeTab === 'invoice') {
        setSortField('invoiceDate'); setSortDir('desc');
        const res = await arApi.getInvoiceDetailReport(params);
        setInvoiceData(res);
      } else if (activeTab === 'milestone') {
        setSortField('invoiceDate'); setSortDir('desc');
        const res = await arApi.getMilestoneDetailReport(params);
        setMilestoneData(res);
      } else if (activeTab === 'customer') {
        setSortField('outstanding'); setSortDir('desc');
        // If the customer endpoint supports searching, we can pass params
        // For now, it might just return all and we filter locally
        const res = await arApi.getTopOutstandingCustomers();
        setCustomerData(res);
      }
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setRiskFilter(''); setPersonInChargeFilter(''); setTypeFilter('');
    setAcctFilter(''); setFromDate(''); setToDate(''); setForecastDate('');
    setPaymentModeFilter(''); setGuaranteeFilter('');
  };
  const hasFilters = search || statusFilter || riskFilter || personInChargeFilter || typeFilter || acctFilter || fromDate || toDate || forecastDate || paymentModeFilter || guaranteeFilter;

  // Filter & sort invoice data
  const filteredInvoices = useMemo(() => {
    if (!invoiceData?.data) return [];
    let d = [...invoiceData.data];

    if (sortField) {
      d.sort((a: any, b: any) => {
        let av = a[sortField], bv = b[sortField];
        if (av === null || av === undefined) av = typeof bv === 'number' ? 0 : '';
        if (bv === null || bv === undefined) bv = typeof av === 'number' ? 0 : '';
        const cmp = typeof av === 'number' ? (av - (bv as number)) : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [invoiceData, sortField, sortDir]);

  // Filter & sort milestone data
  const filteredMilestones = useMemo(() => {
    if (!milestoneData?.data) return [];
    let d = [...milestoneData.data];

    if (sortField) {
      d.sort((a: any, b: any) => {
        let av = a[sortField], bv = b[sortField];
        if (av === null || av === undefined) av = typeof bv === 'number' ? 0 : '';
        if (bv === null || bv === undefined) bv = typeof av === 'number' ? 0 : '';
        const cmp = typeof av === 'number' ? (av - (bv as number)) : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [milestoneData, sortField, sortDir]);

  const filteredCustomers = useMemo(() => {
    let d = [...(customerData?.customers || [])];
    if (search) {
      const s = search.toLowerCase();
      d = d.filter((i: any) => i.customerName?.toLowerCase().includes(s) || i.bpCode?.toLowerCase().includes(s) || i.region?.toLowerCase().includes(s));
    }
    if (riskFilter) d = d.filter((i: any) => i.riskClass === riskFilter);

    if (sortField) {
      d.sort((a: any, b: any) => {
        let av = a[sortField], bv = b[sortField];
        if (av === null || av === undefined) av = typeof bv === 'number' ? 0 : '';
        if (bv === null || bv === undefined) bv = typeof av === 'number' ? 0 : '';
        const cmp = typeof av === 'number' ? (av - (bv as number)) : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return d;
  }, [customerData, search, riskFilter, sortField, sortDir]);

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

  // Paginated slices for invoice & milestone tables
  const invTotalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const pagedInvoices = filteredInvoices.slice(page * pageSize, (page + 1) * pageSize);
  const msTotalPages = Math.ceil(filteredMilestones.length / pageSize) || 1;
  const pagedMilestones = filteredMilestones.slice(page * pageSize, (page + 1) * pageSize);

  const computedInvSummary = useMemo(() => {
    if (!invoiceData?.summary) return null;
    return { ...invoiceData.summary };
  }, [invoiceData]);

  const computedMsSummary = useMemo(() => {
    if (!milestoneData?.summary) return null;
    const s = { ...milestoneData.summary };
    s.paidCount = s.statusBreakdown?.paid || 0;
    s.overdueCount = s.statusBreakdown?.overdue || 0;
    s.pendingCount = s.statusBreakdown?.pending || 0;
    s.partialCount = s.statusBreakdown?.partial || 0;
    return s;
  }, [milestoneData]);


  // Active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];
    if (search) chips.push({ key: 'search', label: 'Search', value: search, onRemove: () => setSearch('') });
    if (statusFilter) chips.push({ key: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('') });
    if (riskFilter) chips.push({ key: 'risk', label: 'Risk', value: riskFilter, onRemove: () => setRiskFilter('') });
    if (personInChargeFilter) chips.push({ key: 'personInCharge', label: 'Person In-charge', value: personInChargeFilter, onRemove: () => setPersonInChargeFilter('') });
    if (typeFilter) chips.push({ key: 'type', label: 'Type', value: typeFilter, onRemove: () => setTypeFilter('') });
    if (acctFilter) chips.push({ key: 'acct', label: 'Accounting', value: acctFilter.replace(/_/g, ' '), onRemove: () => setAcctFilter('') });
    if (fromDate) chips.push({ key: 'from', label: 'From', value: fromDate, onRemove: () => setFromDate('') });
    if (toDate) chips.push({ key: 'to', label: 'To', value: toDate, onRemove: () => setToDate('') });
    if (forecastDate) chips.push({ key: 'forecast', label: 'Due By', value: forecastDate, onRemove: () => setForecastDate('') });
    if (paymentModeFilter) chips.push({ key: 'paymentMode', label: 'Payment Mode', value: paymentModeFilter, onRemove: () => setPaymentModeFilter('') });
    if (guaranteeFilter) chips.push({ key: 'guarantee', label: 'Guarantee', value: guaranteeFilter.replace(/_/g, ' '), onRemove: () => setGuaranteeFilter('') });
    return chips;
  }, [search, statusFilter, riskFilter, typeFilter, acctFilter, fromDate, toDate, paymentModeFilter, guaranteeFilter]);



  const handleExport = () => {
    if (activeTab === 'invoice') {
      const dataWithIdx = filteredInvoices.map((r, i) => ({ ...r, _idx: i + 1 }));
      exportExcel(dataWithIdx, 'Invoice_Detail_Report', [
        { key: '_idx', label: '#' },
        { key: 'invoiceNumber', label: 'Invoice No' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'bpCode', label: 'BP Code' },
        { key: 'poNo', label: 'PO No' },
        { key: 'region', label: 'Region' },
        { key: 'type', label: 'Type' },
        { key: '__spacer', label: '' },
        { key: 'invoiceDate', label: 'Invoice Date', fmt: 'date' },
        { key: 'dueDate', label: 'Due Date', fmt: 'date' },
        { key: 'lastPaymentDate', label: 'Last Payment Date', fmt: 'date' },
        { key: '__spacer', label: '' },
        { key: 'totalAmount', label: 'Total Amount', fmt: 'amount' },
        { key: 'netAmount', label: 'Net Amount', fmt: 'amount' },
        { key: 'taxAmount', label: 'Tax Amount', fmt: 'amount' },
        { key: 'totalReceipts', label: 'Total Collected', fmt: 'amount' },
        { key: 'balance', label: 'Outstanding Balance', fmt: 'amount' },
        { key: 'collectionPercentage', label: 'Collection %', fmt: 'pct' },
        { key: '__spacer', label: '' },
        { key: 'daysOverdue', label: 'Days Overdue' },
        { key: 'agingBucket', label: 'Aging Bucket' },
        { key: 'status', label: 'Payment Status' },
        { key: 'riskClass', label: 'Risk Class' },
        { key: '__spacer', label: '' },
        { key: 'actualPaymentTerms', label: 'Payment Terms', fmt: 'terms' },
        { key: 'deliveryStatus', label: 'Delivery Status' },
        { key: 'paymentCount', label: 'Payment Count' },
        { key: 'lastPaymentMode', label: 'Last Payment Mode' },
        { key: 'paymentHistory', label: 'Payment History', fmt: 'payments' },
        { key: 'remarks', label: 'Remarks', fmt: 'remarks' },
      ]);
    } else if (activeTab === 'milestone') {
      const dataWithIdx = filteredMilestones.map((r, i) => ({ ...r, _idx: i + 1 }));
      exportExcel(dataWithIdx, 'Milestone_Detail_Report', [
        { key: '_idx', label: '#' },
        { key: 'soNo', label: 'SO No' },
        { key: 'invoiceNumber', label: 'Invoice No' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'bpCode', label: 'BP Code' },
        { key: 'poNo', label: 'PO No' },
        { key: 'region', label: 'Region' },
        { key: 'type', label: 'Type' },
        { key: 'bookingMonth', label: 'Booking Month' },
        { key: '__spacer', label: '' },
        { key: 'invoiceDate', label: 'Invoice Date', fmt: 'date' },
        { key: '__spacer', label: '' },
        { key: 'totalAmount', label: 'Total Amount', fmt: 'amount' },
        { key: 'netAmount', label: 'Net Amount', fmt: 'amount' },
        { key: 'taxAmount', label: 'Tax Amount', fmt: 'amount' },
        { key: 'totalReceipts', label: 'Total Collected', fmt: 'amount' },
        { key: 'balance', label: 'Outstanding Balance', fmt: 'amount' },
        { key: 'collectionPercentage', label: 'Collection %', fmt: 'pct' },
        { key: '__spacer', label: '' },
        { key: 'status', label: 'Payment Status' },
        { key: 'milestoneStatus', label: 'Milestone Status' },
        { key: 'accountingStatus', label: 'Accounting Status' },
        { key: 'riskClass', label: 'Risk Class' },
        { key: 'actualPaymentTerms', label: 'Payment Terms', fmt: 'terms' },
        { key: 'paymentCount', label: 'Payment Count' },
        { key: 'paymentHistory', label: 'Payment History', fmt: 'payments' },
        { key: 'remarks', label: 'Remarks', fmt: 'remarks' },
      ]);
    } else if (activeTab === 'customer') {
      const dataWithIdx = filteredCustomers.map((r, i) => ({ ...r, _idx: i + 1 }));
      exportExcel(dataWithIdx, 'Customer_Outstanding_Report', [
        { key: '_idx', label: '#' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'bpCode', label: 'BP Code' },
        { key: 'region', label: 'Region' },
        { key: 'riskClass', label: 'Risk Class' },
        { key: 'invoiceCount', label: 'Invoice Count' },
        { key: 'totalInvoiced', label: 'Total Invoiced', fmt: 'amount' },
        { key: 'totalCollected', label: 'Total Collected', fmt: 'amount' },
        { key: 'outstanding', label: 'Outstanding', fmt: 'amount' },
        { key: 'collectionRate', label: 'Collection %', fmt: 'pct' },
        { key: 'maxDaysOverdue', label: 'Max Overdue Days' },
        { key: 'overdueCount', label: 'Overdue Invoices' },
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

            <div className="relative group min-w-[140px] flex-1">
              <select value={personInChargeFilter} onChange={e => setPersonInChargeFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                <option value="">Person In-charge: All</option>
                {PIC_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
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

            {(activeTab === 'invoice' || activeTab === 'milestone') && (
              <div className="relative group min-w-[180px] flex-2">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                  <Sparkles className="w-3.5 h-3.5 text-[#E17F70]" />
                  <span className="text-[10px] font-black text-[#92A2A5] uppercase">Due By:</span>
                </div>
                <input type="date" value={forecastDate} onChange={e => setForecastDate(e.target.value)}
                  className="w-full h-10 pl-20 pr-3 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none transition-all shadow-sm cursor-pointer [color-scheme:light]" />
              </div>
            )}

            <div className="relative group min-w-[140px] flex-1">
              <select value={paymentModeFilter} onChange={e => setPaymentModeFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                <option value="">Payment Mode: All</option>
                {availablePaymentModes.map(mode => (
                  <option key={mode} value={mode}>{mode.charAt(0) + mode.slice(1).toLowerCase().replace(/_/g, ' ')}</option>
                ))}
              </select>
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
            </div>

            <div className="relative group min-w-[140px] flex-1">
              <select value={guaranteeFilter} onChange={e => setGuaranteeFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border-2 border-[#AEBFC3]/40 text-sm text-[#546A7A] font-bold focus:border-[#6F8A9D] focus:ring-4 focus:ring-[#6F8A9D]/10 outline-none appearance-none transition-all shadow-sm cursor-pointer">
                <option value="">Guarantees: All</option>
                <option value="HAS_ABG">Has ABG</option>
                <option value="HAS_PBG">Has PBG</option>
                <option value="BOTH">Has Both</option>
                <option value="NONE">No Guarantees</option>
              </select>
              <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#92A2A5] pointer-events-none group-hover:text-[#6F8A9D] transition-colors" />
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACTIVE FILTER CHIPS ═══ */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] font-bold text-[#92A2A5] uppercase tracking-wider">Active:</span>
          {activeFilterChips.map(chip => (
            <span key={chip.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#546A7A]/10 border border-[#546A7A]/20 text-xs font-bold text-[#546A7A] group hover:bg-[#546A7A]/15 transition-colors">
              <span className="text-[9px] text-[#92A2A5] uppercase">{chip.label}:</span> {chip.value}
              <button onClick={chip.onRemove} className="ml-0.5 p-0.5 rounded-full hover:bg-[#E17F70]/20 text-[#92A2A5] hover:text-[#9E3B47] transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-[10px] font-bold text-[#E17F70] hover:text-[#9E3B47] transition-colors ml-1">Clear all</button>
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

      {/* ═══ INVOICE DETAIL REPORT ═══ */}
      {!loading && activeTab === 'invoice' && computedInvSummary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={IndianRupee} label="Total Invoiced" value={formatARCurrency(computedInvSummary.totalAmount)} sub={`${computedInvSummary.totalInvoices} invoices`} gradient="bg-gradient-to-br from-[#5D6E73] to-[#3D4E53]" />
            <KpiCard icon={CheckCircle2} label="Collected" value={formatARCurrency(computedInvSummary.totalCollected)} sub={`${computedInvSummary.collectionRate}% rate`} gradient="bg-gradient-to-br from-[#82A094] to-[#4F6A64]" />
            <KpiCard icon={Clock} label="Outstanding" value={formatARCurrency(computedInvSummary.totalOutstanding)} sub={`${computedInvSummary.pendingCount + computedInvSummary.partialCount} pending`} gradient="bg-gradient-to-br from-[#546A7A] to-[#6F8A9D]" />
            <KpiCard icon={AlertTriangle} label="Overdue" value={formatARCurrency(computedInvSummary.agingDistribution?.['90+']?.amount || 0)} sub={`${computedInvSummary.overdueCount} past due`} gradient="bg-gradient-to-br from-[#E17F70] to-[#9E3B47]" />
            <KpiCard icon={TrendingUp} label="Collection Rate" value={`${computedInvSummary.collectionRate}%`} sub={`${computedInvSummary.paidCount} fully paid`} gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
          </div>


          {/* Exact Match Invoice Table (Aligned with invoices/page.tsx) */}
          <div className="hidden md:block relative bg-white rounded-[2rem] border-2 border-[#AEBFC3]/30 overflow-hidden shadow-xl mb-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <div className="px-5 py-3.5 border-b-2 border-[#546A7A]/20 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D]">
              <div className="flex items-center justify-between font-bold text-white text-sm">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-white/20">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <span>Invoice Detail Records</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/15">
                  <span className="opacity-80 font-medium">
                    Showing {pagedInvoices.length} of {filteredInvoices.length} records
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="text-left py-4 px-4 border-b-2 border-[#546A7A]/30 bg-gradient-to-r from-[#546A7A]/10 to-[#546A7A]/5 text-[11px] font-black uppercase text-[#546A7A] cursor-pointer whitespace-nowrap" onClick={() => handleSort('invoiceNumber')}>
                      Invoice <SortIcon field="invoiceNumber" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/30 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/5 text-[11px] font-black uppercase text-[#6F8A9D] cursor-pointer min-w-[200px]" onClick={() => handleSort('customerName')}>
                      Customer <SortIcon field="customerName" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#976E44]/30 bg-gradient-to-r from-[#976E44]/10 to-[#976E44]/5 text-[11px] font-black uppercase text-[#976E44] cursor-pointer whitespace-nowrap" onClick={() => handleSort('type')}>
                      Type <SortIcon field="type" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#82A094]/30 bg-gradient-to-r from-[#82A094]/10 to-[#82A094]/5 text-[11px] font-black uppercase text-[#4F6A64] cursor-pointer whitespace-nowrap" onClick={() => handleSort('invoiceDate')}>
                      Date <SortIcon field="invoiceDate" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#E17F70]/30 bg-gradient-to-r from-[#E17F70]/10 to-[#E17F70]/5 text-[11px] font-black uppercase text-[#E17F70] cursor-pointer whitespace-nowrap" onClick={() => handleSort('dueDate')}>
                      Due Date <SortIcon field="dueDate" />
                    </th>
                    <th className="text-right py-4 px-4 border-b-2 border-[#4F6A64]/30 bg-gradient-to-r from-[#4F6A64]/10 to-[#4F6A64]/5 text-[11px] font-black uppercase text-[#4F6A64] cursor-pointer whitespace-nowrap" onClick={() => handleSort('totalAmount')}>
                      Total <SortIcon field="totalAmount" />
                    </th>
                    <th className="text-right py-4 px-4 border-b-2 border-[#96AEC2]/30 bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/5 text-[11px] font-black uppercase text-[#6F8A9D] cursor-pointer whitespace-nowrap" onClick={() => handleSort('totalReceipts')}>
                      Received <SortIcon field="totalReceipts" />
                    </th>
                    <th className="text-right py-4 px-4 border-b-2 border-[#9E3B47]/30 bg-gradient-to-r from-[#9E3B47]/10 to-[#9E3B47]/5 text-[11px] font-black uppercase text-[#9E3B47] cursor-pointer whitespace-nowrap" onClick={() => handleSort('balance')}>
                      Balance <SortIcon field="balance" />
                    </th>
                    <th className="text-center py-4 px-4 border-b-2 border-[#5D6E73]/30 bg-gradient-to-r from-[#5D6E73]/10 to-[#5D6E73]/5 text-[11px] font-black uppercase text-[#5D6E73] cursor-pointer whitespace-nowrap" onClick={() => handleSort('riskClass')}>
                      Risk <SortIcon field="riskClass" />
                    </th>
                    <th className="text-center py-4 px-4 border-b-2 border-[#75242D]/30 bg-gradient-to-r from-[#75242D]/10 to-[#75242D]/5 text-[11px] font-black uppercase text-[#5D6E73] cursor-pointer whitespace-nowrap" onClick={() => handleSort('status')}>
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-center py-4 px-3 border-b-2 border-[#AEBFC3]/30 bg-[#AEBFC3]/5 text-[11px] font-black uppercase text-[#546A7A] w-12">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/15">
                  {pagedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5] flex items-center justify-center shadow-lg">
                            <FileText className="w-8 h-8 text-white" />
                          </div>
                          <span className="text-[#5D6E73] font-bold uppercase tracking-widest text-[10px]">No invoices matching filter</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedInvoices.map((inv: any, index: number) => {
                      const isExpanded = expandedRows.has(inv.id);
                      return (
                        <Fragment key={inv.id}>
                          <tr 
                            onClick={() => toggleRow(inv.id)}
                            className={`cursor-pointer border-b border-[#AEBFC3]/15 transition-all hover:bg-[#546A7A]/5 hover:shadow-md ${
                              index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'
                            } ${inv.status === 'OVERDUE' ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#546A7A] text-[13px]">{inv.invoiceNumber}</div>
                              {inv.poNo && <div className="text-[10px] text-white bg-gradient-to-r from-[#976E44] to-[#CE9F6B] px-1.5 py-0.5 rounded inline-block mt-0.5 font-bold tracking-tighter">PO: {inv.poNo}</div>}
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm font-bold text-[#546A7A] leading-snug">{inv.customerName}</div>
                              <div className="text-[10px] text-[#92A2A5] font-black uppercase mt-0.5">{inv.bpCode}</div>
                            </td>
                            <td className="py-3 px-4">
                               <span className="text-[10px] font-bold px-2 py-1 bg-gradient-to-r from-[#82A094]/20 to-[#4F6A64]/20 text-[#4F6A64] rounded-lg border border-[#82A094]/30">{inv.type || '-'}</span>
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-[#546A7A]">{formatARDate(inv.invoiceDate)}</td>
                            <td className="py-3 px-4">
                              <div className={`text-xs ${inv.status === 'OVERDUE' ? 'text-[#E17F70] font-black' : 'text-[#546A7A]'}`}>
                                {formatARDate(inv.dueDate)}
                              </div>
                              {(inv.dueByDays ?? 0) !== 0 && inv.status !== 'PAID' && (
                                <div className={`text-[9px] font-bold mt-1 tracking-tighter ${(inv.dueByDays ?? 0) > 0 ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>
                                  {(inv.dueByDays ?? 0) > 0 ? `+${inv.dueByDays}d overdue` : `${Math.abs(inv.dueByDays ?? 0)}d left`}
                                </div>
                              )}
                            </td>
                             <td className="py-3 px-4 text-right font-black text-[#4F6A64] text-sm">{formatARCurrency(Number(inv.totalAmount) || 0) || '-'}</td>
                             <td className="py-3 px-4 text-right text-[#6F8A9D] font-bold text-sm">{formatARCurrency(Number(inv.totalReceipts) || 0) || '-'}</td>
                             <td className="py-3 px-4 text-right font-black text-[#E17F70] text-sm">
                               {inv.forecastAmount !== undefined ? formatARCurrency(inv.forecastAmount) : formatARCurrency(Number(inv.balance) || 0)}
                             </td>
                             <td className="py-3 px-4 text-center">
                               <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold shadow-sm ${getRiskStyle(inv.riskClass || 'LOW')}`}>
                                 {inv.riskClass || 'LOW'}
                               </span>
                             </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold shadow-sm ${getStatusStyle(inv.status)}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setViewRecord({ ...inv, _type: 'invoice' }); }}
                                  className="w-8 h-8 rounded-lg bg-[#CE9F6B]/15 text-[#976E44] flex items-center justify-center hover:bg-[#CE9F6B]/30 transition-all border border-[#CE9F6B]/30"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <ChevronDown className={`w-3.5 h-3.5 text-[#AEBFC3] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${inv.id}-timeline`}>
                               <td colSpan={11} className="p-0 border-x-2 border-b-2 border-[#6F8A9D]/10 bg-[#F8FAFB]/30">
                                  <InvoiceTimelineView invoice={inv} />
                               </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                  {/* Summary Footer */}
                  {filteredInvoices.length > 0 && invoiceData?.summary && (
                    <tr className="bg-gradient-to-r from-[#F8FAFB] to-white border-t-2 border-[#AEBFC3]/30">
                      <td colSpan={5} className="py-3 px-4 text-[10px] font-black text-[#546A7A] uppercase">Total</td>
                      <td className="py-3 px-4 text-right font-black text-[#4F6A64] text-sm">{formatARCurrency(invoiceData.summary.totalAmount)}</td>
                      <td className="py-3 px-4 text-right text-[#6F8A9D] font-bold text-sm">{formatARCurrency(invoiceData.summary.totalCollected)}</td>
                      <td className="py-3 px-4 text-right font-black text-[#E17F70] text-sm">{formatARCurrency(invoiceData.summary.totalOutstanding)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {invTotalPages > 1 && (
              <div className="relative p-5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-[#AEBFC3]/5 via-transparent to-white border-t-2 border-[#AEBFC3]/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#92A2A5] tracking-wide">Showing</span>
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#546A7A]/10 to-[#6F8A9D]/5 text-xs font-black text-[#546A7A] border border-[#6F8A9D]/20">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredInvoices.length)}</span>
                  <span className="text-xs font-bold text-[#92A2A5]">of</span>
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 text-xs font-black text-[#976E44] border border-[#CE9F6B]/20">{filteredInvoices.length}</span>
                  <span className="text-xs font-bold text-[#92A2A5] tracking-wide">records</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(0)} disabled={page === 0} className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm" title="First page"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#AEBFC3]/30 rounded-lg text-xs font-bold text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all">Prev</button>
                  <div className="flex items-center gap-1 mx-1">
                    {getPageNumbers(page, invTotalPages).map((p, i) => (
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="w-8 text-center text-xs font-bold text-[#92A2A5] select-none">…</span>
                      ) : (
                        <button key={p} onClick={() => setPage(Number(p) - 1)}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all duration-200 ${
                            page === (Number(p) - 1)
                              ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/25 scale-110 ring-2 ring-[#6F8A9D]/30'
                              : 'bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] hover:scale-105 shadow-sm'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    ))}
                  </div>
                  <button onClick={() => setPage(p => Math.min(invTotalPages - 1, p + 1))} disabled={page === invTotalPages - 1} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-lg text-xs font-bold text-white hover:shadow-lg hover:shadow-[#546A7A]/20 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg transition-all">Next</button>
                  <button onClick={() => setPage(invTotalPages - 1)} disabled={page === invTotalPages - 1} className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm" title="Last page"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>

          {/* High-Fidelity Invoice Mobile View */}
          <div className="md:hidden space-y-5 mb-8">
            {pagedInvoices.length === 0 ? (
              <div className="py-24 text-center bg-white rounded-[2rem] border-2 border-[#AEBFC3]/30 shadow-xl">
                 <FileX2 className="w-12 h-12 text-[#AEBFC3] mx-auto mb-4" />
                 <p className="text-[#5D6E73] font-bold">No invoices to display</p>
              </div>
            ) : (
              pagedInvoices.map((inv: any) => {
                const isExpanded = expandedRows.has(inv.id);
                return (
                  <div key={inv.id} className={`group relative bg-white rounded-[2rem] border-2 transition-all duration-300 shadow-lg overflow-hidden ${isExpanded ? 'border-[#546A7A]/50 ring-4 ring-[#546A7A]/5' : 'border-[#AEBFC3]/30'}`}>
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                    <div className="p-6" onClick={() => toggleRow(inv.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center shadow-lg shadow-[#546A7A]/20">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="font-black text-[#546A7A] text-base">{inv.invoiceNumber}</div>
                            <div className="text-[10px] font-black text-[#976E44] uppercase tracking-widest">{inv.poNo || 'PO-N/A'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); setViewRecord({ ...inv, _type: 'invoice' }); }} className="w-10 h-10 rounded-xl bg-[#546A7A]/10 text-[#546A7A] flex items-center justify-center active:scale-90 transition-all">
                            <Eye className="w-5 h-5" />
                          </button>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white rotate-180 shadow-lg' : 'bg-[#AEBFC3]/10 text-[#AEBFC3]'}`}>
                            <ChevronDown className="w-5 h-5" />
                          </div>
                        </div>
                      </div>

                      <div className="mb-6">
                         <h3 className="font-extrabold text-[#546A7A] text-[17px] leading-tight mb-1">{inv.customerName}</h3>
                         <div className="flex items-center gap-3 mt-2">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${getStatusStyle(inv.status)}`}>{inv.status}</span>
                            <span className="text-[10px] font-black text-[#92A2A5]">{inv.bpCode}</span>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-[#AEBFC3]/10">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest">Total Value</p>
                          <p className="text-xl font-black text-[#546A7A] tracking-tighter">{formatARCurrency(Number(inv.totalAmount))}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest">Due Date</p>
                          <p className={`text-sm font-black ${inv.status === 'OVERDUE' ? 'text-[#E17F70]' : 'text-[#82A094]'}`}>{formatARDate(inv.dueDate)}</p>
                        </div>
                      </div>
                      
                       <div className="mt-5 flex items-center justify-between">
                          <div className="flex flex-col">
                             <p className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest">{inv.forecastAmount !== undefined ? 'Forecast Due' : 'Outstanding'}</p>
                             <p className="text-xl font-black text-[#E17F70]">{inv.forecastAmount !== undefined ? formatARCurrency(inv.forecastAmount) : formatARCurrency(Number(inv.balance))}</p>
                          </div>
                          <div className="text-right">
                              <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${Number(inv.balance) <= 0 ? 'bg-[#82A094]/10 text-[#4F6A64]' : 'bg-[#E17F70]/10 text-[#9E3B47]'}`}>
                                 {Number(inv.balance) <= 0 ? 'Fully Paid' : (inv.daysOverdue > 0 ? `${inv.daysOverdue}D Overdue` : 'Current')}
                              </div>
                          </div>
                       </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t-2 border-[#AEBFC3]/10">
                        <InvoiceTimelineView invoice={inv} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
          <div className="flex items-center justify-between py-2 border-b border-[#AEBFC3]/10 last:border-0">
            <span className="text-[10px] text-[#92A2A5] font-black uppercase tracking-widest">{label}</span>
            <span className={`text-[13px] ${bold ? 'font-black' : 'font-bold'} ${color || 'text-[#546A7A]'} pl-4 text-right`}>{value || '-'}</span>
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
                    <DetailRow label="Total Received" value={formatARCurrency(r.totalReceipts)} color="text-[#82A094]" bold />
                    <DetailRow label={r.forecastAmount !== undefined ? 'Forecast Due' : 'Balance'} value={formatARCurrency(r.forecastAmount !== undefined ? r.forecastAmount : r.balance)} color="text-[#E17F70]" bold />
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
                        <DetailRow 
                          label={r.dueByDays > 0 ? "Days Overdue" : "Aging Days"} 
                          value={r.dueByDays > 0 ? `${r.dueByDays} days overdue` : (r.dueByDays < 0 ? `${Math.abs(r.dueByDays)} days remaining` : 'Due Today')} 
                          color={r.dueByDays > 0 ? 'text-[#9E3B47]' : 'text-[#82A094]'} 
                          bold 
                        />
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
                  <SectionHead icon={Layers} title={isInv ? 'Payment Details' : 'Milestone Logic & Stages'} grad="from-[#5D6E73] to-[#3D4E53]" />
                  {isInv ? (
                    <div className="rounded-2xl border-2 border-[#AEBFC3]/20 overflow-hidden shadow-sm scale-95 origin-top">
                      <InvoiceTimelineView invoice={r} />
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-[#AEBFC3]/20 overflow-hidden shadow-sm scale-95 origin-top">
                      <MilestoneTimelineView invoice={r} />
                    </div>
                  )}
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

      {/* ═══ MILESTONE DETAIL REPORT ═══ */}
      {!loading && activeTab === 'milestone' && computedMsSummary && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiCard icon={IndianRupee} label="Total Value" value={formatARCurrency(computedMsSummary.totalAmount)} sub={`${computedMsSummary.totalMilestones} milestones`} gradient="bg-gradient-to-br from-[#CE9F6B] to-[#976E44]" />
            <KpiCard icon={CheckCircle2} label="Collected" value={formatARCurrency(computedMsSummary.totalCollected)} sub={`${computedMsSummary.collectionRate}% rate`} gradient="bg-gradient-to-br from-[#A2B9AF] to-[#82A094]" />
            <KpiCard icon={Clock} label="Outstanding" value={formatARCurrency(computedMsSummary.totalOutstanding)} sub="Balance receivable" gradient="bg-gradient-to-br from-[#AEBFC3] to-[#92A2A5]" />
            <KpiCard icon={AlertTriangle} label="Overdue Stages" value={String(computedMsSummary.overdueTerms)} sub={`of ${computedMsSummary.totalTerms} total stages`} gradient="bg-gradient-to-br from-[#9E3B47] to-[#75242D]" />
            <KpiCard icon={PackageCheck} label="Completed Stages" value={String(computedMsSummary.completedTerms)} sub={`${computedMsSummary.totalTerms > 0 ? Math.round((computedMsSummary.completedTerms / computedMsSummary.totalTerms) * 100) : 0}% done`} gradient="bg-gradient-to-br from-[#4F6A64] to-[#82A094]" />
          </div>


          {/* High-Fidelity Milestone Table (Desktop) */}
          <div className="hidden md:block relative bg-white rounded-2xl border-2 border-[#6F8A9D]/30 overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
            <div className="px-5 py-4 border-b-2 border-[#6F8A9D]/20 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#546A7A]">
              <div className="flex items-center justify-between font-bold text-white text-xs uppercase tracking-wide">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/15 border border-white/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>Milestone Detailed Report Table</span>
                </div>
                <div className="px-3 py-1 rounded-lg bg-white/15 text-[10px] font-bold">
                  {filteredMilestones.length} records found
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/5 to-transparent sticky top-0 z-20 backdrop-blur-md bg-white/95">
                    <th className="w-12 py-4 px-3 border-b-2 border-[#6F8A9D]/20 text-center">
                       <div className="w-2 h-2 rounded-full bg-[#6F8A9D]/30 mx-auto" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#6F8A9D] tracking-wide cursor-pointer hover:bg-[#6F8A9D]/5 transition-colors whitespace-nowrap min-w-[120px]" onClick={() => handleSort('soNo')}>
                      Sales Order <SortIcon field="soNo" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#976E44] tracking-wide cursor-pointer hover:bg-[#CE9F6B]/5 transition-colors whitespace-nowrap min-w-[120px]" onClick={() => handleSort('poNo')}>
                      References <SortIcon field="poNo" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#546A7A] tracking-wide cursor-pointer hover:bg-[#546A7A]/5 transition-colors min-w-[220px]" onClick={() => handleSort('customerName')}>
                      Customer <SortIcon field="customerName" />
                    </th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#546A7A] tracking-wide whitespace-nowrap">Context</th>
                    <th className="text-left py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#CE9F6B] tracking-wide whitespace-nowrap">Latest Remark</th>
                    <th className="text-right py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#546A7A] tracking-wide cursor-pointer hover:bg-[#546A7A]/5 transition-colors whitespace-nowrap min-w-[140px]" onClick={() => handleSort('totalAmount')}>
                      Financials <SortIcon field="totalAmount" />
                    </th>
                    <th className="text-center py-4 px-4 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#546A7A] tracking-wide whitespace-nowrap min-w-[120px]">Tracking</th>
                    <th className="text-center py-4 px-3 border-b-2 border-[#6F8A9D]/20 text-[11px] font-black uppercase text-[#546A7A] tracking-wide w-16">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEBFC3]/20">
                  {pagedMilestones.length === 0 ? (
                    <tr><td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-2xl bg-[#AEBFC3]/10">
                          <Sparkles className="w-8 h-8 text-[#AEBFC3]/40" />
                        </div>
                        <p className="text-[#92A2A5] font-bold">No milestone records found matching your filters.</p>
                      </div>
                    </td></tr>
                  ) : (
                    pagedMilestones.map((ms: any, index: number) => {
                      const isExpanded = expandedRows.has(ms.id);
                      const terms = ms.terms || ms.milestoneTerms || [];
                      const criticalAging = ms.maxOverdueDays || 0;

                      return (
                        <Fragment key={ms.id}>
                          <tr 
                             onClick={() => toggleRow(ms.id)}
                             className={`group cursor-pointer transition-all duration-300 ${ms.status === 'CANCELLED' ? 'opacity-50 grayscale bg-[#AEBFC3]/5' : isExpanded ? 'bg-[#CE9F6B]/5 ring-2 ring-[#CE9F6B]/20' : index % 2 === 0 ? 'bg-white' : 'bg-[#96AEC2]/5'} hover:bg-white hover:shadow-xl hover:translate-y-[-1px] hover:z-[5] relative`}
                          >
                            <td className="py-4 px-3 text-center">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isExpanded ? 'bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white shadow-lg shadow-[#CE9F6B]/30 rotate-180' : 'bg-[#AEBFC3]/10 text-[#546A7A] group-hover:bg-gradient-to-br group-hover:from-[#6F8A9D] group-hover:to-[#546A7A] group-hover:text-white group-hover:shadow-lg'}`}>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </td>
                            
                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                               <Link href={`/finance/ar/milestones/${ms.id}`} className="flex flex-col group/so">
                                  <div className="flex items-center gap-2 mb-1.5">
                                     <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10 flex items-center justify-center group-hover/so:from-[#6F8A9D] group-hover/so:to-[#546A7A] transition-all shadow-sm">
                                        <Layers className="w-3 h-3 text-[#6F8A9D] group-hover/so:text-white" />
                                     </div>
                                     <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">SO Number</span>
                                        <span className="text-xs font-bold text-[#546A7A] tracking-tight group-hover/so:text-[#6F8A9D]">{ms.soNo || 'SO-N/A'}</span>
                                     </div>
                                  </div>
                               </Link>
                               <div className="flex items-center gap-2 group/inv">
                                  <div className="w-6 h-6 rounded-lg bg-[#AEBFC3]/15 flex items-center justify-center">
                                     <ExternalLink className="w-3 h-3 text-[#546A7A]" />
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Invoice No</span>
                                     <span className="text-xs font-bold text-[#92A2A5] truncate max-w-[100px]">{ms.invoiceNumber || 'PENDING'}</span>
                                  </div>
                               </div>
                            </td>

                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                               <Link href={`/finance/ar/milestones/${ms.id}`} className="flex flex-col group/po">
                                  <div className="flex items-center gap-2 mb-1.5">
                                     <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10 flex items-center justify-center">
                                        <Tag className="w-3 h-3 text-[#CE9F6B]" />
                                     </div>
                                     <span className="text-sm font-bold text-[#976E44] group-hover/po:text-[#CE9F6B] transition-colors">{ms.poNo || 'NO-PO-REF'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <Calendar className="w-3 h-3 text-[#92A2A5]" />
                                     <span className="text-[10px] font-bold text-[#546A7A] uppercase tracking-wide">{formatARMonth(ms.bookingMonth) || 'NO MONTH'}</span>
                                  </div>
                               </Link>
                            </td>

                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col group/cust">
                                {ms.customerName && (
                                  <span className="text-sm font-bold text-[#546A7A] mb-1 leading-snug">{ms.customerName}</span>
                                )}
                                <div className="flex items-center gap-2">
                                  {ms.bpCode ? (
                                    <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#6F8A9D]/10 to-[#546A7A]/5 text-[9px] font-black uppercase tracking-tight border border-[#6F8A9D]/20">{ms.bpCode}</span>
                                  ) : !ms.customerName && (
                                    <div className="w-16 h-3 bg-[#AEBFC3]/10 rounded animate-pulse" />
                                  )}
                                  {ms.region && ms.region.toUpperCase() !== 'GLOBAL' && (
                                    <div className="flex items-center gap-1 text-[9px] text-[#92A2A5] font-black uppercase">
                                      <ShieldCheck className="w-2.5 h-2.5 text-[#82A094]" />
                                      <span>{ms.region}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4">
                               <div className="flex flex-col gap-2.5">
                                  {/* Category */}
                                  {ms.type && (() => {
                                    const type = ms.type;
                                    const configObj: Record<string, any> = {
                                      'LCS': { bg: 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10', text: 'text-[#4F6A64]', icon: 'text-[#82A094]', border: 'border-[#82A094]/20' },
                                      'NB': { bg: 'bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10', text: 'text-[#546A7A]', icon: 'text-[#6F8A9D]', border: 'border-[#6F8A9D]/20' },
                                      'FINANCE': { bg: 'bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10', text: 'text-[#976E44]', icon: 'text-[#CE9F6B]', border: 'border-[#CE9F6B]/20' }
                                    };
                                    const config = configObj[type] || { bg: 'bg-gradient-to-br from-[#6F8A9D]/20 to-[#546A7A]/10', text: 'text-[#546A7A]', icon: 'text-[#6F8A9D]', border: 'border-[#6F8A9D]/20' };

                                    return (
                                      <div className="flex items-center gap-2 group/cat">
                                         <div className={`w-6 h-6 rounded-lg ${config.bg} flex items-center justify-center transition-all group-hover/cat:scale-110 shadow-sm border ${config.border}`}>
                                            <Tag className={`w-3 h-3 ${config.icon}`} />
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Category</span>
                                            <span className={`text-[10px] font-bold tracking-tight ${config.text}`}>{type}</span>
                                         </div>
                                      </div>
                                    );
                                  })()}
                                  
                                  {/* Accounting Status */}
                                  {(() => {
                                    const status = ms.accountingStatus;
                                    const config = status === 'REVENUE_RECOGNISED' 
                                      ? { bg: 'bg-gradient-to-br from-[#82A094]/20 to-[#4F6A64]/10', text: 'text-[#4F6A64]', label: 'Revenue Recognised', border: 'border-[#82A094]/20' }
                                      : status === 'BACKLOG'
                                      ? { bg: 'bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10', text: 'text-[#9E3B47]', label: 'Backlog', border: 'border-[#E17F70]/20' }
                                      : { bg: 'bg-gradient-to-br from-[#CE9F6B]/20 to-[#976E44]/10', text: 'text-[#976E44]', label: 'Acknowledged', border: 'border-[#CE9F6B]/20' };

                                    return (
                                      <div className="flex items-center gap-2 group/acc">
                                         <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all group-hover/acc:scale-110 shadow-sm ${config.bg} border ${config.border}`}>
                                            <ShieldCheck className={`w-3 h-3 ${config.text}`} />
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-[#92A2A5] uppercase tracking-wide leading-none mb-0.5">Acct Status</span>
                                            <span className={`text-[9px] font-bold tracking-tight leading-tight ${config.text}`}>
                                              {config.label}
                                            </span>
                                         </div>
                                      </div>
                                    );
                                  })()}
                               </div>
                            </td>

                            <td className="py-4 px-4">
                               {ms.remarks && ms.remarks.length > 0 ? (
                                 <div className="group/rem relative p-3 rounded-xl bg-gradient-to-br from-white to-[#CE9F6B]/5 border-2 border-[#CE9F6B]/20 shadow-lg max-w-[220px] hover:shadow-xl hover:border-[#CE9F6B]/40 transition-all">
                                    <div className="flex items-start gap-2.5">
                                       <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#CE9F6B]/20">
                                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                                       </div>
                                       <div className="flex flex-col min-w-0">
                                          <TooltipProvider>
                                            <Tooltip delayDuration={300}>
                                              <TooltipTrigger asChild>
                                                <p className="text-xs font-bold text-[#546A7A] leading-snug line-clamp-2 italic cursor-help">
                                                  &ldquo;{ms.remarks[0].content}&rdquo;
                                                </p>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-[300px] p-3 text-xs bg-white text-[#546A7A] border-2 border-[#CE9F6B]/20 shadow-xl whitespace-pre-wrap break-words z-50">
                                                {ms.remarks[0].content}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          <div className="flex items-center gap-1.5 mt-1.5">
                                             <span className="text-[9px] font-bold text-[#976E44] uppercase tracking-tight">{ms.remarks[0].createdBy?.name?.split(' ')[0] || 'AI'}</span>
                                             <span className="w-1 h-1 rounded-full bg-[#CE9F6B]/40" />
                                             <span className="text-[9px] font-bold text-[#CE9F6B]">{new Date(ms.remarks[0].createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 opacity-40 px-2">
                                    <div className="p-1.5 rounded-lg bg-[#AEBFC3]/10">
                                       <Sparkles className="w-3 h-3 text-[#AEBFC3]" />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#92A2A5]">No activity logged</span>
                                 </div>
                               )}
                            </td>

                            <td className="py-4 px-4 text-right">
                               <div className="flex flex-col items-end gap-1.5">
                                  <div className="relative">
                                     <p className="font-bold text-[#4F6A64] text-base tracking-tight leading-none">{formatARCurrency(Number(ms.totalAmount))}</p>
                                     <div className="absolute -left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-[#82A094] to-transparent rounded-full" />
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                     <div className="flex flex-col items-end gap-1.5">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all ${Number(ms.totalReceipts) > 0 ? 'bg-gradient-to-r from-[#82A094]/20 to-[#4F6A64]/10 border-[#82A094]/40 shadow-sm' : 'bg-[#AEBFC3]/5 border-[#AEBFC3]/20'}`}>
                                           <span className="text-[10px] font-black text-[#4F6A64] uppercase tracking-wider">Received</span>
                                           <span className="text-xs font-black text-[#4F6A64]">{formatARCurrency(Number(ms.totalReceipts))}</span>
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all ${Number(ms.balance) <= 0 ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] border-transparent shadow-lg shadow-[#82A094]/20' : 'bg-gradient-to-r from-[#E17F70]/10 to-[#9E3B47]/5 border-[#E17F70]/30'}`}>
                                           <span className={`text-[10px] font-black uppercase tracking-wider ${Number(ms.balance) <= 0 ? 'text-white' : 'text-[#9E3B47]'}`}>
                                              {forecastDate && ms.forecastAmount !== undefined && Number(ms.balance) > 0 ? 'Due By' : 'Balance'}
                                           </span>
                                           <span className={`text-xs font-black ${Number(ms.balance) <= 0 ? 'text-white' : 'text-[#9E3B47]'}`}>
                                              {Number(ms.balance) <= 0 ? (
                                                <span className="flex items-center gap-1.5">
                                                  <CheckCircle2 className="w-3.5 h-3.5" /> PAID
                                                </span>
                                              ) : (forecastDate && ms.forecastAmount !== undefined ? formatARCurrency(ms.forecastAmount) : formatARCurrency(Number(ms.balance)))}
                                           </span>
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </td>

                            <td className="py-4 px-4">
                               <div 
                                 onClick={(e) => { e.stopPropagation(); toggleRow(ms.id); }}
                                 className={`group/aging flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 ${
                                    ms.status === 'CANCELLED'
                                    ? 'bg-[#AEBFC3]/20 border-[#AEBFC3]/40 text-[#5D6E73]'
                                    : criticalAging && criticalAging > 0 
                                    ? 'bg-gradient-to-br from-[#E17F70]/15 to-[#9E3B47]/10 border-[#E17F70]/30 text-[#9E3B47] shadow-lg shadow-[#E17F70]/10' 
                                    : 'bg-gradient-to-br from-[#82A094]/15 to-[#4F6A64]/10 border-[#82A094]/30 text-[#4F6A64] shadow-lg shadow-[#82A094]/10'
                                 } hover:scale-105 hover:border-current`}
                               >
                                  <div className="flex items-center gap-2 mb-1">
                                     {ms.status === 'CANCELLED' ? (
                                        <XCircle className="w-4 h-4 text-[#5D6E73]" />
                                     ) : criticalAging && criticalAging > 0 ? (
                                       <div className="relative">
                                         <AlertTriangle className="w-4 h-4 text-[#E17F70] animate-bounce" />
                                         <div className="absolute inset-0 bg-[#E17F70] blur-md opacity-30 animate-pulse" />
                                       </div>
                                     ) : <Timer className="w-4 h-4 text-[#82A094]" />}
                                     <span className="text-xs font-bold uppercase tracking-wide">
                                       {ms.status === 'CANCELLED' ? 'CANCELLED' : criticalAging && criticalAging > 0 ? `${criticalAging}d Risk` : 'Optimal'}
                                     </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg bg-black/5 text-[9px] font-bold tracking-wide uppercase opacity-70">
                                     {terms.length} Stages <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                               </div>
                            </td>
                            <td className="py-4 px-3 text-center">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setViewRecord({ ...ms, _type: 'milestone' }); }}
                                 className="w-10 h-10 rounded-xl bg-[#CE9F6B]/15 text-[#976E44] flex items-center justify-center hover:bg-[#CE9F6B]/30 hover:scale-110 transition-all border border-[#CE9F6B]/30 shadow-sm group/vbtn"
                                 title="View In Popup"
                               >
                                  <Eye className="w-5 h-5 group-hover/vbtn:scale-120 transition-transform" />
                               </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${ms.id}-timeline`}><td colSpan={9} className="p-0 border-x-2 border-b-2 border-[#CE9F6B]/20 shadow-inner bg-[#CE9F6B]/[0.02]"><MilestoneTimelineView invoice={ms} /></td></tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                  {/* Summary Footer */}
                  {filteredMilestones.length > 0 && milestoneData?.summary && (
                    <tr className="bg-gradient-to-r from-[#F8FAFB] to-white border-t-2 border-[#AEBFC3]/30">
                      <td colSpan={6} className="py-4 px-4 text-[10px] font-black text-[#546A7A] uppercase">Total</td>
                      <td className="py-4 px-4 text-right flex flex-col items-end gap-1">
                         <div className="font-bold text-[#4F6A64] text-sm">{formatARCurrency(milestoneData.summary.totalAmount)}</div>
                         <div className="text-xs text-[#9E3B47] font-bold">OS: {formatARCurrency(milestoneData.summary.totalOutstanding)}</div>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {msTotalPages > 1 && (
              <div className="relative p-5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-[#AEBFC3]/5 via-transparent to-white border-t-2 border-[#AEBFC3]/30 mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#92A2A5] tracking-wide">Showing</span>
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#546A7A]/10 to-[#6F8A9D]/5 text-xs font-black text-[#546A7A] border border-[#6F8A9D]/20">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredMilestones.length)}</span>
                  <span className="text-xs font-bold text-[#92A2A5]">of</span>
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#CE9F6B]/10 to-[#976E44]/5 text-xs font-black text-[#976E44] border border-[#CE9F6B]/20">{filteredMilestones.length}</span>
                  <span className="text-xs font-bold text-[#92A2A5] tracking-wide">records</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(0)} disabled={page === 0} className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm" title="First page"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-[#AEBFC3]/30 rounded-lg text-xs font-bold text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all">Prev</button>
                  <div className="flex items-center gap-1 mx-1">
                    {getPageNumbers(page, msTotalPages).map((p, i) => (
                      p === '...' ? (
                        <span key={`ms-ell-${i}`} className="w-8 text-center text-xs font-bold text-[#92A2A5] select-none">…</span>
                      ) : (
                        <button key={p} onClick={() => setPage(Number(p) - 1)}
                          className={`w-9 h-9 rounded-xl text-xs font-bold transition-all duration-200 ${
                            page === (Number(p) - 1)
                              ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white shadow-lg shadow-[#546A7A]/25 scale-110 ring-2 ring-[#6F8A9D]/30'
                              : 'bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] hover:scale-105 shadow-sm'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    ))}
                  </div>
                  <button onClick={() => setPage(p => Math.min(msTotalPages - 1, p + 1))} disabled={page === msTotalPages - 1} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] rounded-lg text-xs font-bold text-white hover:shadow-lg hover:shadow-[#546A7A]/20 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg transition-all">Next</button>
                  <button onClick={() => setPage(msTotalPages - 1)} disabled={page === msTotalPages - 1} className="p-2 rounded-lg bg-white border-2 border-[#AEBFC3]/30 text-[#546A7A] hover:bg-[#AEBFC3]/10 hover:border-[#6F8A9D] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm" title="Last page"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Milestone Card View (Aligned with Dashboards) */}
          <div className="md:hidden space-y-5 mb-8">
            {pagedMilestones.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-[#6F8A9D]/20 shadow-xl">
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#AEBFC3]/10 flex items-center justify-center">
                       <Sparkles className="w-8 h-8 text-[#AEBFC3]/40" />
                    </div>
                    <p className="text-[#92A2A5] font-bold text-lg">No milestone records match your criteria</p>
                 </div>
              </div>
            ) : (
              pagedMilestones.map((ms: any) => {
                const isExpanded = expandedRows.has(ms.id);
                const criticalAging = ms.maxOverdueDays || 0;

                return (
                  <div key={ms.id} className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 shadow-lg overflow-hidden ${isExpanded ? 'border-[#CE9F6B]/50 ring-4 ring-[#CE9F6B]/10' : 'border-[#6F8A9D]/30'}`}>
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#96AEC2]" />
                    <div className="p-5" onClick={() => toggleRow(ms.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center shadow-lg shadow-[#6F8A9D]/20">
                            <Layers className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-black text-[#546A7A] text-[15px]">{ms.soNo || 'SO-N/A'}</div>
                            <div className="text-[10px] font-black text-[#976E44] uppercase tracking-widest">{ms.poNo || 'PO-N/A'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setViewRecord({ ...ms, _type: 'milestone' }); }}
                            className="w-9 h-9 rounded-xl bg-[#CE9F6B]/15 text-[#976E44] flex items-center justify-center shadow-lg border border-[#CE9F6B]/30 active:scale-90 transition-all"
                            title="View In Popup"
                          >
                             <Eye className="w-4 h-4" />
                          </button>
                          <Link 
                            href={`/finance/ar/milestones/${ms.id}`}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] text-white flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20 active:scale-90 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] text-white rotate-180 shadow-lg' : 'bg-[#AEBFC3]/20 text-[#546A7A]'}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      <div className="mb-5">
                         <h3 className="font-extrabold text-[#546A7A] text-base leading-tight mb-1">{ms.customerName}</h3>
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest">{ms.bpCode}</span>
                            <span className="w-1 h-1 rounded-full bg-[#AEBFC3]" />
                            <span className="text-[10px] font-black text-[#6F8A9D] uppercase tracking-widest">{ms.region}</span>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-5 border-t-2 border-[#AEBFC3]/15">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-[#92A2A5] uppercase tracking-widest">
                            {forecastDate && ms.forecastAmount !== undefined ? 'FORECAST DUE' : 'Outstanding Balance'}
                          </p>
                          <p className="text-xl font-black text-[#E17F70] tracking-tighter">
                            {forecastDate && ms.forecastAmount !== undefined ? formatARCurrency(ms.forecastAmount) : formatARCurrency(Number(ms.balance))}
                          </p>
                        </div>
                        <div className="flex flex-col items-end justify-center">
                           <div className={`px-4 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${criticalAging && criticalAging > 0 ? 'bg-gradient-to-r from-[#E17F70]/20 to-[#E17F70]/10 border-[#E17F70]/40 text-[#9E3B47]' : 'bg-gradient-to-r from-[#82A094]/20 to-[#82A094]/10 border-[#82A094]/40 text-[#4F6A64]'}`}>
                              {criticalAging && criticalAging > 0 ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 animate-pulse" />
                                  {criticalAging}D Risk
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  On Track
                                </>
                              )}
                           </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t-2 border-[#AEBFC3]/10 bg-[#CE9F6B]/[0.02]">
                        <MilestoneTimelineView invoice={ms} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>

      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CUSTOMER OUTSTANDING REPORT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!loading && activeTab === 'customer' && customerData?.summary && (() => {
        const cs = customerData.summary;
        const paged = filteredCustomers.slice(page * pageSize, (page + 1) * pageSize);
        const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
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
                  <span className="text-xs font-medium opacity-80">{filteredCustomers.length} customers matched</span>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#F8FAFB] shadow-sm">
                      {[
                        { f: '_idx', l: '#' },
                        { f: 'customerName', l: 'Customer' }, { f: 'bpCode', l: 'BP Code' },
                        { f: 'region', l: 'Region' }, { f: 'invoiceCount', l: 'Invoices' },
                        { f: 'totalInvoiced', l: 'Invoiced' }, { f: 'totalCollected', l: 'Collected' },
                        { f: 'outstanding', l: 'Outstanding' }, { f: 'collectionRate', l: 'Rate' },
                        { f: 'maxDaysOverdue', l: 'Aging' }, { f: 'riskClass', l: 'Risk' }
                      ].map(col => (
                        <th key={col.f} onClick={() => col.f !== '_idx' && handleSort(col.f)}
                          className={`text-left py-3 px-3 border-b-2 border-[#AEBFC3]/30 text-[10px] font-bold uppercase text-[#546A7A] ${col.f !== '_idx' ? 'cursor-pointer hover:bg-[#AEBFC3]/10' : ''} transition-colors whitespace-nowrap bg-[#F8FAFB]`}>
                          {col.l}{col.f !== '_idx' && <SortIcon field={col.f} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr><td colSpan={12} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-[#AEBFC3]" />
                          <span className="text-[#92A2A5] font-bold">No customers found</span>
                          {hasFilters && <button onClick={clearFilters} className="text-xs text-[#6F8A9D] hover:text-[#546A7A] font-bold">Clear filters →</button>}
                        </div>
                      </td></tr>
                    ) : paged.map((c: any, idx: number) => {
                      const isExpanded = expandedRows.has(`cust-${c.bpCode}`);
                      return (
                        <Fragment key={c.bpCode || idx}>
                          <tr onClick={() => toggleRow(`cust-${c.bpCode}`)}
                            className={`border-b border-[#AEBFC3]/15 hover:bg-[#4F6A64]/5 hover:shadow-md cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFB]/40'} ${c.overdueCount > 0 ? 'border-l-4 border-l-[#E17F70]' : 'border-l-4 border-l-transparent'}`}>
                            <td className="py-2.5 px-3 text-[10px] font-bold text-[#92A2A5]">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${isExpanded ? 'bg-[#4F6A64] text-white rotate-180' : 'bg-[#AEBFC3]/20 text-[#546A7A]'}`}>
                                  <ChevronDown className="w-3 h-3" />
                                </div>
                                {page * pageSize + idx + 1}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-xs font-semibold truncate max-w-[160px]">
                              <div className="flex flex-col">
                                <span className="truncate">{c.customerName}</span>
                                {c.invoices?.length > 0 && (
                                  <span className="text-[9px] text-[#92A2A5] font-bold uppercase tracking-tighter">{c.invoices.length} Outstanding Invoices</span>
                                )}
                              </div>
                            </td>
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
                            <td className="py-2.5 px-3 text-center">
                              <button onClick={(e) => { e.stopPropagation(); setViewRecord({ ...c, _type: 'customer' }); }}
                                className="p-1.5 rounded-lg bg-white border border-[#4F6A64]/20 text-[#4F6A64] hover:bg-[#4F6A64]/10 shadow-sm transition-all"
                                title="View Trends">
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${c.bpCode}-details`}>
                              <td colSpan={12} className="p-0 border-x-2 border-b-2 border-[#4F6A64]/20 bg-[#4F6A64]/[0.02] shadow-inner">
                                <div className="p-4 sm:p-6 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-[#4F6A64] flex items-center justify-center shadow-lg">
                                        <FileText className="w-4 h-4 text-white" />
                                      </div>
                                      <h4 className="text-sm font-black text-[#546A7A] uppercase tracking-wider">Outstanding Invoices for {c.customerName}</h4>
                                    </div>
                                    <div className="text-[10px] font-black text-[#92A2A5] uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-[#AEBFC3]/30 shadow-sm">
                                      {c.invoices?.length || 0} Records
                                    </div>
                                  </div>
                                  
                                  <div className="rounded-xl border border-[#4F6A64]/20 bg-white shadow-sm overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-[#F8FAFB] border-b border-[#4F6A64]/10">
                                          <th className="py-2 px-3 text-left font-bold text-[#92A2A5] uppercase tracking-tighter">Invoice No</th>
                                          <th className="py-2 px-3 text-left font-bold text-[#92A2A5] uppercase tracking-tighter">Date</th>
                                          <th className="py-2 px-3 text-left font-bold text-[#92A2A5] uppercase tracking-tighter">PO No</th>
                                          <th className="py-2 px-3 text-right font-bold text-[#92A2A5] uppercase tracking-tighter">Amount</th>
                                          <th className="py-2 px-3 text-right font-bold text-[#92A2A5] uppercase tracking-tighter">Balance</th>
                                          <th className="py-2 px-3 text-center font-bold text-[#92A2A5] uppercase tracking-tighter">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#AEBFC3]/10">
                                        {(c.invoices || []).map((inv: any) => (
                                          <tr key={inv.id} className="hover:bg-[#4F6A64]/5 transition-colors group/inv">
                                            <td className="py-2.5 px-3 font-bold text-[#546A7A]">{inv.invoiceNumber}</td>
                                            <td className="py-2.5 px-3 text-[#92A2A5]">{new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                            <td className="py-2.5 px-3 text-[#92A2A5] font-medium">{inv.poNo || '-'}</td>
                                            <td className="py-2.5 px-3 text-right text-[#546A7A] font-medium">{formatARCurrency(inv.totalAmount)}</td>
                                            <td className="py-2.5 px-3 text-right text-[#E17F70] font-black">{formatARCurrency(inv.balance)}</td>
                                            <td className="py-2.5 px-3 text-center">
                                              <div className="flex items-center justify-center gap-1.5">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded leading-none ${
                                                  inv.status === 'OVERDUE' ? 'bg-[#E17F70]/15 text-[#9E3B47] border border-[#E17F70]/30' : 
                                                  inv.status === 'PARTIAL' ? 'bg-[#CE9F6B]/15 text-[#976E44] border border-[#CE9F6B]/30' : 
                                                  'bg-[#AEBFC3]/15 text-[#546A7A] border border-[#AEBFC3]/30'
                                                }`}>
                                                  {inv.status}
                                                </span>
                                                {inv.daysOverdue > 0 && (
                                                  <span className="text-[10px] text-[#9E3B47] font-bold">({inv.daysOverdue}d)</span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  {/* Summary Footer */}
                  {filteredCustomers.length > 0 && customerData?.summary && (
                    <tfoot>
                      <tr className="bg-gradient-to-r from-[#F8FAFB] to-[#EDF2F4] border-t-2 border-[#AEBFC3]/30">
                        <td colSpan={5} className="py-2.5 px-3 text-[10px] font-bold text-[#546A7A] uppercase">Filtered Total ({filteredCustomers.length})</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#4F6A64] text-right whitespace-nowrap">{formatARCurrency(customerData.summary.totalInvoiced)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#82A094] text-right whitespace-nowrap">{formatARCurrency(customerData.summary.totalCollected)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#E17F70] text-right whitespace-nowrap">{formatARCurrency(customerData.summary.totalOutstanding)}</td>
                        <td className="py-2.5 px-3 text-xs font-bold text-[#546A7A] text-center">{customerData.summary.collectionRate}%</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t-2 border-[#AEBFC3]/15 flex items-center justify-between bg-[#F8FAFB]/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#92A2A5] font-medium">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredCustomers.length)} of {filteredCustomers.length}</span>
                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                      className="text-xs border border-[#AEBFC3]/40 rounded-lg px-2 py-1 bg-white text-[#546A7A] font-bold focus:outline-none focus:border-[#6F8A9D]">
                      {[25, 50, 100, 200].map(s => <option key={s} value={s}>{s}/page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button disabled={page === 0} onClick={() => setPage(0)} className="p-1.5 rounded-lg bg-white border border-[#AEBFC3]/30 text-[#546A7A] disabled:opacity-30 hover:bg-[#F0F4F5] transition-colors text-xs font-bold">«</button>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg bg-white border border-[#AEBFC3]/30 text-[#546A7A] disabled:opacity-30 hover:bg-[#F0F4F5] transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-[#546A7A] px-2">{page + 1} / {totalPages}</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg bg-white border border-[#AEBFC3]/30 text-[#546A7A] disabled:opacity-30 hover:bg-[#F0F4F5] transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="p-1.5 rounded-lg bg-white border border-[#AEBFC3]/30 text-[#546A7A] disabled:opacity-30 hover:bg-[#F0F4F5] transition-colors text-xs font-bold">»</button>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}

    </div>
  );
}
