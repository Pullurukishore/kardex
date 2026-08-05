'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, CheckCircle, RefreshCw, Sparkles,
  Building2, Calendar, IndianRupee, UserCheck, ShieldCheck,
  Clock, AlertCircle, Check, Layers, Wrench, ShieldAlert,
  MapPin, Hash, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { kardexBlue, kardexGreen, kardexSand, kardexRed, kardexGrey } from '@/lib/kardex-colors';

interface ContractCreateFormProps {
  role: string;
  backUrl: string;
}

export default function ContractCreateForm({ role, backUrl }: ContractCreateFormProps) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newPlace, setNewPlace] = useState('');
  const [newPoNo, setNewPoNo] = useState('');
  const [newPoDate, setNewPoDate] = useState('');
  const [newMcType, setNewMcType] = useState('Flex Care');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newMachines, setNewMachines] = useState('1');
  const [newValue, setNewValue] = useState('');
  const [newVisits, setNewVisits] = useState('3');
  const [newBdCount, setNewBdCount] = useState('0');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newPaymentTerms, setNewPaymentTerms] = useState('30 Days Net');
  const [newSoftwareSupport, setNewSoftwareSupport] = useState(false);

  // Load dependencies
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cData, zData, uData] = await Promise.all([
          apiService.getCustomers({ limit: 1000 }),
          apiService.getZones(),
          apiService.getUsers()
        ]);

        const zonesArray = Array.isArray(zData) ? zData : (zData?.data || []);
        setCustomers(cData);
        setZones(zonesArray);
        const users = uData.users || uData || [];
        setUsersList(users);

        const engineers = users.filter((u: any) => {
          const role = (u.role || '').toUpperCase();
          return role === 'ZONE_USER' || role === 'ZONE_MANAGER';
        });
        const availableEngineers = engineers.length > 0 ? engineers : users;
        if (availableEngineers.length > 0) {
          setNewResponsible(availableEngineers[0].name || availableEngineers[0].email || 'Rahul');
        }
        // Do not auto-default to zonesArray[0], let it be populated via selected customer
      } catch (err) {
        console.error('Failed to load create form details', err);
        toast.error('Failed to load customer list from database');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCustomerChange = (idStr: string) => {
    setSelectedCustomerId(idStr);
    const idNum = Number(idStr);
    const selectedCust = customers.find(c => c.id === idNum);
    if (selectedCust) {
      setNewCustName(selectedCust.companyName);
      setNewPlace(selectedCust.address || 'India');

      if (selectedCust.serviceZone) {
        setNewZoneName(selectedCust.serviceZone.name);
        setSelectedZoneId(String(selectedCust.serviceZoneId));
      }
    }
  };

  // Compute duration
  const durationInfo = useMemo(() => {
    if (!newStartDate || !newEndDate) return null;
    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime <= 0) return null;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = (days / 30.44).toFixed(1);
    return { days, months };
  }, [newStartDate, newEndDate]);

  // Form validity check for preview
  const isCustomerValid = Boolean(selectedCustomerId);
  const isPoValid = Boolean(newPoNo.trim());
  const isAmountValid = Boolean(newValue && !isNaN(Number(newValue)) && Number(newValue) > 0);
  const isDatesValid = Boolean(newStartDate && newEndDate && durationInfo);
  const isFormValid = isCustomerValid && isPoValid && isAmountValid && isDatesValid && Boolean(selectedZoneId);

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error('Please complete all mandatory fields with valid values');
      return;
    }

    const val = parseFloat(newValue);
    const machines = parseInt(newMachines);
    const visits = parseInt(newVisits);
    const bdStr = String(newBdCount).trim().toLowerCase();
    const bds = (bdStr === 'unlimited' || bdStr === 'ul') ? 999 : (parseInt(bdStr, 10) || 0);

    setSubmitting(true);
    try {
      await apiService.createContract({
        customerName: newCustName,
        place: newPlace,
        poNo: newPoNo,
        poDate: newPoDate || newStartDate,
        mcType: newMcType,
        noOfMachine: machines,
        amount: val,
        noOfVisits: visits,
        startDate: newStartDate,
        endDate: newEndDate,
        responsible: newResponsible,
        zoneName: newZoneName,
        bdCount: bds,
        paymentTerms: newPaymentTerms,
        softwareSupport: newSoftwareSupport,
        customerId: Number(selectedCustomerId),
        zoneId: Number(selectedZoneId)
      });
      toast.success('Service Agreement created successfully!');
      router.push(backUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create service agreement');
    } finally {
      setSubmitting(false);
    }
  };

  // Kardex Official Palette SLA Badges
  const getSlaBadgeClass = (mcType: string) => {
    if (mcType.includes('Premium')) return 'bg-[#546A7A] text-white shadow-sm';
    if (mcType.includes('Active')) return 'bg-[#CE9F6B] text-white shadow-sm';
    return 'bg-[#82A094] text-white shadow-sm';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#546A7A] text-sm font-bold tracking-wide">Loading Agreement Creation Workspace...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 font-medium text-[#546A7A]">

      {/* Header Banner - Kardex Official Deep Blue Gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3d4f5c] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 bg-[#82A094]/25 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-60 h-60 bg-[#CE9F6B]/20 rounded-full blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(backUrl)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl active:scale-95 transition-all text-white border border-white/15 shadow-inner"
              title="Return to Contracts"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#82A094]/25 border border-[#82A094]/40 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#A2B9AF]" />
                <span className="text-[10px] font-extrabold text-[#A2B9AF] tracking-wider uppercase">{role} Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Create Service Agreement</h1>
              <p className="text-white/80 text-xs sm:text-sm mt-1 max-w-2xl">
                Register a new FSM customer contract, configure Care SLAs, setup billing PO records, and map Preventive Maintenance visit schedules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15"
            >
              Discard Draft
            </button>
            <button
              type="button"
              onClick={handleAddContract}
              disabled={submitting || !isFormValid}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 ${isFormValid && !submitting
                ? 'bg-[#82A094] hover:bg-[#4F6A64] text-white shadow-[#82A094]/25 active:scale-95'
                : 'bg-[#546A7A]/40 text-white/50 cursor-not-allowed border border-white/10'
                }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Publish Agreement</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Full-Width Form Layout (8 Cols Form / 4 Cols Live Summary Panel) */}
      <form onSubmit={handleAddContract} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Form Content (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Section 1: Customer & Territory Information */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-[#82A094]/15 text-[#4F6A64] flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#546A7A]">1. Customer & Location Profile</h3>
                <p className="text-[#6F8A9D]/80 text-xs">Select customer account to auto-populate site address and assigned service zone.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Customer Account</span>
                  <span className="text-[#9E3B47]">*</span>
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => {
                    const zoneName = c.serviceZone?.name || zones.find((z: any) => Number(z.id) === Number(c.serviceZoneId))?.name;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.companyName}{zoneName ? ` (${zoneName} Zone)` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Site Location (Place)</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly
                  placeholder="Auto-filled from Customer Record"
                  value={newPlace}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-[#546A7A] focus:outline-none text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Assigned Service Zone</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={newZoneName}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-[#546A7A] focus:outline-none text-xs font-semibold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Lead Service Engineer</span>
                </label>
                <select
                  value={newResponsible}
                  onChange={(e) => setNewResponsible(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                >
                  {(usersList.filter((u: any) => {
                    const role = (u.role || '').toUpperCase();
                    return role === 'ZONE_USER' || role === 'ZONE_MANAGER' || role.includes('ZONE');
                  }).length > 0
                    ? usersList.filter((u: any) => {
                      const role = (u.role || '').toUpperCase();
                      return role === 'ZONE_USER' || role === 'ZONE_MANAGER' || role.includes('ZONE');
                    })
                    : usersList
                  ).map((u: any) => (
                    <option key={u.id} value={u.name || u.email}>
                      {u.name || u.email}{u.role ? ` (${u.role.replace('_', ' ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Agreement Care Tier & PO Billing */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-[#CE9F6B]/15 text-[#976E44] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#546A7A]">2. Service Tier & Purchase Order</h3>
                <p className="text-[#6F8A9D]/80 text-xs">Define SLA level, PO billing reference number, and payment terms.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Contract Care Level</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Flex Care', color: 'bg-[#82A094] border-[#82A094]' },
                    { name: 'Active Care', color: 'bg-[#CE9F6B] border-[#CE9F6B]' },
                    { name: 'Premium Care', color: 'bg-[#546A7A] border-[#546A7A]' }
                  ].map((care) => (
                    <button
                      key={care.name}
                      type="button"
                      onClick={() => setNewMcType(care.name)}
                      className={`py-2.5 px-2 rounded-xl text-[11px] font-extrabold transition-all border text-center ${newMcType === care.name
                        ? `${care.color} text-white shadow-sm`
                        : 'bg-slate-50 hover:bg-slate-100 text-[#546A7A] border-slate-200'
                        }`}
                    >
                      {care.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider">
                  PO Number <span className="text-[#9E3B47]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PO-2026-8849"
                  value={newPoNo}
                  onChange={(e) => setNewPoNo(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>PO Date</span>
                </label>
                <input
                  type="date"
                  value={newPoDate}
                  onChange={(e) => setNewPoDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Payment Terms</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 30 Days Net / Advance"
                  value={newPaymentTerms}
                  onChange={(e) => setNewPaymentTerms(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Value, Machines & PM Frequency */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-[#82A094]/15 text-[#4F6A64] flex items-center justify-center font-bold">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#546A7A]">3. Financial Scope & Visit Frequency</h3>
                <p className="text-[#6F8A9D]/80 text-xs">Specify contract monetary value, machine count, and PM visit cycles.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1">
                  <span>Contract Value (₹)</span>
                  <span className="text-[#9E3B47]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F8A9D] font-bold text-xs">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="150000"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-bold text-[#546A7A] shadow-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider">
                  Machines Covered
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMachines}
                  onChange={(e) => setNewMachines(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider">
                  PM Visit Frequency
                </label>
                <select
                  value={newVisits}
                  onChange={(e) => setNewVisits(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
                    <option key={v} value={v}>
                      {v} {v === 1 ? 'Visit' : 'Visits'} / Year
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#9E3B47]" />
                  <span>Initial Breakdown Log Count</span>
                </label>
                <input
                  type="text"
                  placeholder='Enter count or "Unlimited"'
                  value={newBdCount}
                  onChange={(e) => setNewBdCount(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSoftwareSupport}
                    onChange={(e) => setNewSoftwareSupport(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#82A094]"></div>
                  <span className="ml-3 text-xs font-bold text-[#546A7A]">Include Software Support License</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Agreement Validity Timeline */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-[#6F8A9D]/15 text-[#546A7A] flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#546A7A]">4. Validity Period & Timeline</h3>
                <p className="text-[#6F8A9D]/80 text-xs">Set start and expiration dates for SLA active tracking.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>Start Date</span> <span className="text-[#9E3B47]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#546A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#6F8A9D]" />
                  <span>End Date</span> <span className="text-[#9E3B47]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-xs font-semibold shadow-sm transition-all text-[#546A7A]"
                />
              </div>
            </div>

            {durationInfo && (
              <div className="p-4 rounded-2xl bg-[#96AEC2]/15 border border-[#96AEC2]/30 flex items-center justify-between text-xs text-[#546A7A]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6F8A9D]" />
                  <span className="font-bold">Calculated Term Duration:</span>
                </div>
                <div className="font-extrabold text-[#546A7A]">
                  {durationInfo.months} Months ({durationInfo.days} Days)
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Live Executive Summary Panel (4 Cols) - Kardex Colors */}
        <div className="lg:col-span-4 space-y-6">

          <div className="sticky top-6 space-y-6">

            {/* Live Agreement Card - Kardex Deep Blue Palette */}
            <div className="bg-gradient-to-br from-[#546A7A] via-[#3d4f5c] to-[#2c3e50] rounded-3xl p-6 text-white shadow-xl space-y-6 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-[#82A094]/25 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-center pb-4 border-b border-white/15">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#A2B9AF]">Live Executive Summary</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${getSlaBadgeClass(newMcType)}`}>
                  {newMcType}
                </span>
              </div>

              {/* Customer Banner */}
              <div>
                <p className="text-[10px] uppercase font-bold text-white/60">Customer Account</p>
                <h4 className="text-lg font-black text-white mt-0.5 truncate">
                  {newCustName || 'Select Customer...'}
                </h4>
                <p className="text-xs text-white/70 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-[#A2B9AF]" />
                  <span>{newPlace || 'Location Pending'}</span>
                  <span>•</span>
                  <span className="text-[#A2B9AF] font-bold">{newZoneName} Zone</span>
                </p>
              </div>

              {/* Financial Value & PO */}
              <div className="grid grid-cols-2 gap-4 py-3 bg-white/10 rounded-2xl p-3.5 border border-white/10">
                <div>
                  <p className="text-[10px] uppercase font-bold text-white/70">Portfolio Value</p>
                  <p className="text-base font-black text-[#A2B9AF] mt-0.5">
                    {newValue ? `₹${Number(newValue).toLocaleString('en-IN')}` : '₹0'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-white/70">PO Ref #</p>
                  <p className="text-xs font-mono font-bold text-white mt-1 truncate">
                    {newPoNo || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Visit Schedule Matrix */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-white/70 uppercase">
                  <span>Preventive Maintenance Visits</span>
                  <span className="text-[#A2B9AF] font-extrabold">{newVisits} Cycle(s)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-1">
                  {Array.from({ length: Math.max(Number(newVisits) || 1, 4) }, (_, i) => i + 1).map(num => {
                    const active = num <= Number(newVisits);
                    return (
                      <div
                        key={num}
                        className={`py-1.5 rounded-xl text-center text-[10px] font-bold border transition-all ${active
                          ? 'bg-[#82A094]/30 border-[#82A094]/60 text-white shadow-sm'
                          : 'bg-white/5 border-white/10 text-white/40'
                          }`}
                      >
                        PM {num}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Software Support & Engineer */}
              <div className="flex justify-between items-center text-xs pt-2 border-t border-white/15">
                <span className="text-white/70 text-[11px]">Assigned Engineer:</span>
                <span className="font-bold text-white">{newResponsible}</span>
              </div>
            </div>

            {/* Checklist Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-extrabold text-[#546A7A] uppercase tracking-wider">Mandatory Checklist</h4>
              <div className="space-y-2 text-xs font-semibold">
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${isCustomerValid ? 'text-[#4F6A64] bg-[#82A094]/15 border border-[#82A094]/30' : 'text-slate-400 bg-slate-50'}`}>
                  <Check className={`w-4 h-4 ${isCustomerValid ? 'text-[#82A094]' : 'text-slate-300'}`} />
                  <span>Customer Selected</span>
                </div>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${isPoValid ? 'text-[#4F6A64] bg-[#82A094]/15 border border-[#82A094]/30' : 'text-slate-400 bg-slate-50'}`}>
                  <Check className={`w-4 h-4 ${isPoValid ? 'text-[#82A094]' : 'text-slate-300'}`} />
                  <span>PO Reference Provided</span>
                </div>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${isAmountValid ? 'text-[#4F6A64] bg-[#82A094]/15 border border-[#82A094]/30' : 'text-slate-400 bg-slate-50'}`}>
                  <Check className={`w-4 h-4 ${isAmountValid ? 'text-[#82A094]' : 'text-slate-300'}`} />
                  <span>Contract Amount Value Set</span>
                </div>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${isDatesValid ? 'text-[#4F6A64] bg-[#82A094]/15 border border-[#82A094]/30' : 'text-slate-400 bg-slate-50'}`}>
                  <Check className={`w-4 h-4 ${isDatesValid ? 'text-[#82A094]' : 'text-slate-300'}`} />
                  <span>Valid Timeline Specified</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !isFormValid}
                  className={`w-full py-3.5 rounded-2xl text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-2 ${isFormValid && !submitting
                    ? 'bg-[#82A094] hover:bg-[#4F6A64] text-white shadow-[#82A094]/25 active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm & Save Contract</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

      </form>
    </div>
  );
}
