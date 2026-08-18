'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, FileText, MapPin, Shield, Building2,
  CheckCircle, AlertTriangle, Clock, User, ShieldCheck, Trash2,
  RefreshCw, Printer, IndianRupee, Pencil, Cpu, Settings2,
  Wrench, Layers, AlertCircle, Timer, Phone, Mail, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface DetailedContract {
  id: number;
  slNo: number | null;
  customerName: string;
  customerId: number | null;
  customerClass: string | null;
  place: string | null;
  department: string | null;
  zoneName: string;
  zoneId: number | null;
  engineerName: string | null;
  unitType: string | null;
  controlType: string | null;
  serialNumber: string;
  softwareName: string | null;
  installationYear: string | null;
  contractType: string | null;
  mcPoNumber: string | null;
  poDate: string | null;
  mcStartDate: string | null;
  mcEndDate: string | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  softwarePoNo: string | null;
  softwareStartDate: string | null;
  softwareEndDate: string | null;
  remoteSupportStartDate: string | null;
  remoteSupportEndDate: string | null;
  pmVisitsCount: number;
  bdVisitsCount: number;
  mcValue: number | null;
  mcExpiry?: { status: string; daysLeft: number | null; bucket: string };
  warrantyExpiry?: { status: string; daysLeft: number | null; bucket: string };
  softwareExpiry?: { status: string; daysLeft: number | null; bucket: string };
  remoteSupportExpiry?: { status: string; daysLeft: number | null; bucket: string };
  createdAt?: string;
  updatedAt?: string;
}

interface DetailedContractDetailsProps {
  id: number;
  role: string;
  backUrl: string;
}

const formatCurrency = (val: number | null) => {
  if (val === null || val === undefined) return '—';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const formatDate = (val: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getExpiryBadge = (expiry?: { status: string; daysLeft: number | null; bucket: string }) => {
  if (!expiry || expiry.bucket === 'na' || !expiry.status || expiry.status === 'N/A') {
    return <span className="text-xs text-slate-400 font-medium">—</span>;
  }

  const daysText = expiry.daysLeft !== null
    ? (expiry.daysLeft < 0 ? `${Math.abs(expiry.daysLeft)}d overdue` : `${expiry.daysLeft}d remaining`)
    : '';

  switch (expiry.bucket) {
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-sm">
          <AlertCircle className="w-3.5 h-3.5" />
          {daysText || 'Expired'}
        </span>
      );
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E17F70]/15 text-[#E17F70] border border-[#E17F70]/30 shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5" />
          {daysText}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#CE9F6B]/15 text-[#B8874E] border border-[#CE9F6B]/30 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          {daysText}
        </span>
      );
    case 'attention':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#6F8A9D]/15 text-[#546A7A] border border-[#6F8A9D]/30 shadow-sm">
          <Timer className="w-3.5 h-3.5" />
          {daysText}
        </span>
      );
    case 'healthy':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#82A094]/15 text-[#4E7D6D] border border-[#82A094]/30 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5" />
          {daysText || 'Active'}
        </span>
      );
  }
};

export default function DetailedContractDetails({ id, role, backUrl }: DetailedContractDetailsProps) {
  const router = useRouter();
  const [contract, setContract] = useState<DetailedContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === 'Admin' || role === 'Zone Manager';

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const data = await apiService.getDetailedContract(id);
      setContract(data);
    } catch (err) {
      console.error('Failed to load detailed contract:', err);
      toast.error('Failed to load contract details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiService.deleteDetailedContract(id);
      toast.success('Machine contract deleted successfully');
      router.push(backUrl);
    } catch (err) {
      console.error('Failed to delete detailed contract:', err);
      toast.error('Failed to delete contract');
      setDeleting(false);
    }
  };

  const getEditUrl = () => {
    if (role === 'Admin') return `/admin/contracts/detailed/${id}/edit`;
    if (role === 'Zone Manager') return `/zone-manager/contracts/detailed/${id}/edit`;
    return `/admin/contracts/detailed/${id}/edit`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
        <div className="w-10 h-10 border-3 border-[#82A094]/30 border-t-[#82A094] rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-700">Loading Machine Contract Details...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center shadow-sm">
        <AlertTriangle className="w-12 h-12 text-[#CE9F6B] mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Contract Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-6">The requested machine contract record could not be found.</p>
        <button
          onClick={() => router.push(backUrl)}
          className="px-5 py-2.5 rounded-2xl bg-[#546A7A] text-white font-bold text-xs flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Contracts</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Hero Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3D4F5C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#82A094]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-[#CE9F6B]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <button
              onClick={() => router.push(backUrl)}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 mb-2 backdrop-blur-md">
                <Cpu className="w-3.5 h-3.5 text-[#82A094]" />
                <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                  Machine Serial: {contract.serialNumber}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {contract.customerName}
              </h1>
              <div className="flex items-center gap-3 text-white/80 text-xs sm:text-sm mt-1.5 flex-wrap font-medium">
                {contract.place && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#82A094]" />
                    <span>{contract.place}</span>
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-[#CE9F6B]" />
                  <span>{contract.zoneName} Zone</span>
                </span>
                {contract.customerClass && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/20 font-bold text-[11px]">
                      Class {contract.customerClass}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm backdrop-blur-sm"
            >
              <Printer className="w-4 h-4 text-[#82A094]" />
              <span>Print</span>
            </button>

            {canEdit && (
              <>
                <button
                  onClick={() => router.push(getEditUrl())}
                  className="px-5 py-2.5 rounded-2xl bg-[#82A094] hover:bg-[#6e8a7f] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit Contract</span>
                </button>

                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="w-10 h-10 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 flex items-center justify-center transition-colors"
                  title="Delete Contract"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Metric Summary Banner ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Value</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">
            {formatCurrency(contract.mcValue)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MC Expiry Countdown</p>
          <div className="mt-1.5">{getExpiryBadge(contract.mcExpiry)}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Type</p>
          <p className="text-base font-extrabold text-[#546A7A] mt-1">
            {contract.contractType || 'UMC'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visits Allocated</p>
          <p className="text-base font-extrabold text-slate-800 mt-1">
            {contract.pmVisitsCount} PM / {contract.bdVisitsCount} BD
          </p>
        </div>
      </div>

      {/* ─── Detailed Spec Cards ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machine Asset Specifications */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-4 h-4 text-[#82A094]" />
            Machine & Asset Specifications
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Serial Number</p>
              <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{contract.serialNumber}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Unit Type</p>
              <p className="font-semibold text-slate-800 text-sm mt-0.5">{contract.unitType || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Control System</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.controlType || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Installation Year</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.installationYear || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Software Version</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.softwareName || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Department / Plant</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.department || '—'}</p>
            </div>
          </div>
        </div>

        {/* Customer & Engineer Details */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#6F8A9D]" />
            Customer & Regional Ownership
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Customer Name</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{contract.customerName}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Customer Class</p>
              <p className="font-semibold text-slate-800 mt-0.5">Class {contract.customerClass || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Location / City</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.place || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Service Zone</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.zoneName} Zone</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Kardex Service Engineer</p>
              <p className="font-semibold text-slate-800 mt-0.5">{contract.engineerName || '—'}</p>
            </div>
          </div>
        </div>

        {/* Maintenance Contract (MC) Period */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-4 h-4 text-[#CE9F6B]" />
            Annual Maintenance Contract (MC)
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">MC PO Number</p>
              <p className="font-mono font-bold text-slate-800 mt-0.5">{contract.mcPoNumber || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">PO Date</p>
              <p className="font-semibold text-slate-800 mt-0.5">{formatDate(contract.poDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">MC Start Date</p>
              <p className="font-semibold text-slate-800 mt-0.5">{formatDate(contract.mcStartDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">MC End Date</p>
              <p className="font-semibold text-slate-800 mt-0.5">{formatDate(contract.mcEndDate)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Contract Annual Value</p>
              <p className="font-extrabold text-slate-800 text-sm mt-0.5">{formatCurrency(contract.mcValue)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Expiry Urgency</p>
              <div className="mt-1">{getExpiryBadge(contract.mcExpiry)}</div>
            </div>
          </div>
        </div>

        {/* Warranty & Auxiliary Support */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-[#82A094]" />
            Warranty & Auxiliary Support
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Warranty Period</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {contract.warrantyStartDate || contract.warrantyEndDate ? (
                  `${formatDate(contract.warrantyStartDate)} → ${formatDate(contract.warrantyEndDate)}`
                ) : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Warranty Status</p>
              <div className="mt-1">{getExpiryBadge(contract.warrantyExpiry)}</div>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Software Contract</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {contract.softwareStartDate || contract.softwareEndDate ? (
                  `${formatDate(contract.softwareStartDate)} → ${formatDate(contract.softwareEndDate)}`
                ) : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Remote Support</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {contract.remoteSupportStartDate || contract.remoteSupportEndDate ? (
                  `${formatDate(contract.remoteSupportStartDate)} → ${formatDate(contract.remoteSupportEndDate)}`
                ) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Delete Confirmation Modal ──────────────────────── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Delete Machine Contract?</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Are you sure you want to delete the contract record for machine{' '}
                <span className="font-bold text-slate-700">{contract.serialNumber}</span> ({contract.customerName})? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
