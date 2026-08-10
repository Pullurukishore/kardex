'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, FileText, MapPin, Shield, Building2, 
  Activity, DollarSign, CheckCircle, AlertTriangle, Info, Clock, 
  User, ShieldCheck, Trash2, RefreshCw, Printer, IndianRupee, Pencil, X
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface PMSchedule {
  id: number;
  pmNumber: 1 | 2 | 3 | 4;
  range: string;
  status: 'Completed' | 'Pending' | 'Not Applicable';
  completedAt?: string;
}

interface Contract {
  id: number;
  contractNumber: string;
  customerName: string;
  place: string;
  poNo: string;
  poDate: string;
  mcType: string;
  noOfMachine: number;
  amount: number;
  noOfVisits: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  softwareSupport: boolean;
  pmSchedules: PMSchedule[];
  responsible: string;
  zoneName: string;
  bdCount: number;
  paymentTerms: string;
  scheduledMonth: string;
  customerId?: number;
  zoneId?: number;
}

interface ContractDetailsProps {
  id: number;
  role: string;
  backUrl: string;
}

export default function ContractDetails({ id, role, backUrl }: ContractDetailsProps) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);



  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedPmId, setSelectedPmId] = useState<number | null>(null);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch contract details
  const fetchContractDetails = async () => {
    setLoading(true);
    try {
      const data = await apiService.getContract(id);
      setContract(data);
    } catch (err: any) {
      console.error('Failed to fetch contract details', err);
      toast.error('Failed to load contract details from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchContractDetails();
    }
  }, [id]);



  // Toggle PM Status
  const handleTogglePMStatus = async (pmId: number, currentStatus: string) => {
    if (currentStatus === 'Pending') {
      setSelectedPmId(pmId);
      setCompletedDate(new Date().toISOString().split('T')[0]);
      setDateModalOpen(true);
    } else {
      if (!confirm('Are you sure you want to change this PM visit status back to Pending? This will clear the completion date.')) {
        return;
      }
      // Toggle back to Pending
      try {
        await apiService.updatePMSchedule(pmId, 'Pending');
        toast.success('PM Visit status set to Pending!');
        if (contract) {
          const updatedSchedules = contract.pmSchedules.map(pm => 
            pm.id === pmId ? { ...pm, status: 'Pending' as any, completedAt: undefined } : pm
          );
          setContract({ ...contract, pmSchedules: updatedSchedules });
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to update PM schedule status');
      }
    }
  };

  const handleConfirmCompletion = async () => {
    if (!selectedPmId) return;
    try {
      await apiService.updatePMSchedule(selectedPmId, 'Completed', completedDate);
      toast.success('PM Visit marked as Completed!');
      if (contract) {
        const updatedSchedules = contract.pmSchedules.map(pm => 
          pm.id === selectedPmId ? { ...pm, status: 'Completed' as any, completedAt: completedDate } : pm
        );
        setContract({ ...contract, pmSchedules: updatedSchedules });
      }
      setDateModalOpen(false);
      setSelectedPmId(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update PM schedule status');
    }
  };

  // Delete Contract
  const handleDeleteContract = async () => {
    if (confirm('Are you sure you want to delete this contract? This action is permanent.')) {
      try {
        await apiService.deleteContract(id);
        toast.success('Contract deleted successfully!');
        router.push(backUrl);
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete contract');
      }
    }
  };

  const getStatusBadge = (status: Contract['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'Expiring Soon':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'Expired':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getSlaColor = (mcType: string) => {
    if (mcType.includes('Premium')) {
      return 'from-violet-600 to-indigo-600';
    } else if (mcType.includes('Active')) {
      return 'from-[#CE9F6B] to-[#976E44]';
    }
    return 'from-slate-400 to-slate-600';
  };

  const formatDateLabel = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-12">
        <div className="w-12 h-12 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm">Loading agreement details...</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-12 space-y-4">
        <AlertTriangle className="w-16 h-16 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-800">Contract Not Found</h2>
        <p className="text-slate-500 text-sm">The contract you are trying to view does not exist or has been deleted.</p>
        <button 
          onClick={() => router.push(backUrl)}
          className="px-4 py-2 bg-[#82A094] text-white rounded-xl text-sm font-semibold hover:bg-[#6e897e]"
        >
          Back to Contracts
        </button>
      </div>
    );
  }

  // Calculate PM visits counts
  const totalPMs = contract.pmSchedules.filter(p => p.status !== 'Not Applicable').length;
  const completedPMs = contract.pmSchedules.filter(p => p.status === 'Completed').length;
  const pmPercentage = totalPMs > 0 ? Math.round((completedPMs / totalPMs) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push(backUrl)}
            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Service Contract</span>
              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadge(contract.status)}`}>
                {contract.status}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#82A094]" />
              <span>{contract.contractNumber}</span>
            </h1>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => window.print()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Contract</span>
          </button>

          {(role === 'Admin' || role === 'Zone Manager') && (
            <button 
              onClick={() => router.push(`${backUrl}/${id}/edit`)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-indigo-600 rounded-xl shadow-sm transition-all"
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Details</span>
            </button>
          )}

          {role === 'Admin' && (
            <button 
              onClick={handleDeleteContract}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 rounded-xl shadow-sm transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Contract</span>
            </button>
          )}

          <button 
            onClick={() => {
              toast.success('Simulation: Renewal workflow initiated!');
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-[#82A094] hover:bg-[#6e897e] text-xs font-bold text-white rounded-xl shadow-sm transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
            <span>Renew Contract</span>
          </button>
        </div>
      </div>

      {/* Main Grid Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Details & Cycles */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card Info Grid */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-[#82A094]" />
              <span>Contract & Customer Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">Customer Name</span>
                    <span className="font-extrabold text-slate-800 text-sm block">{contract.customerName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">Location & Zone</span>
                    <span className="text-slate-700 text-sm font-semibold block">{contract.place} ({contract.zoneName} Zone)</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">Responsible Engineer</span>
                    <span className="text-slate-700 text-sm font-semibold block">{contract.responsible}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">MC Contract Type</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-r ${getSlaColor(contract.mcType)}`}>
                        {contract.mcType}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">{contract.noOfMachine} Covered Machines</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">Contract Duration</span>
                    <span className="text-slate-700 text-sm font-semibold block">
                      {formatDateLabel(contract.startDate)} — {formatDateLabel(contract.endDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-1">Software Support License</span>
                    <span className="text-sm font-bold block mt-1">
                      {contract.softwareSupport ? (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          Active License
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-medium">Excluded from Contract</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PM Visits Section */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Preventive Maintenance (PM) Cycle Tracker</span>
              </h2>
              <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-bold">
                {completedPMs} of {totalPMs} Visits Completed ({pmPercentage}%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contract.pmSchedules.map((pm, idx) => {
                if (pm.status === 'Not Applicable') {
                  return (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 flex justify-between items-center text-xs opacity-60">
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Visit {pm.pmNumber}</span>
                        <span className="text-slate-400 italic">Not Applicable for this Contract</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 font-bold text-[10px]">N/A</span>
                    </div>
                  );
                }

                const isCompleted = pm.status === 'Completed';
                return (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-2xl border flex justify-between items-center text-xs transition-all ${
                      isCompleted 
                        ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm' 
                        : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className={`font-bold block text-[10px] uppercase tracking-wider ${isCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                        Visit {pm.pmNumber}
                      </span>
                      <span className="font-mono font-semibold text-slate-700 block">{pm.range}</span>
                      {isCompleted && pm.completedAt && (
                        <span className="text-[10px] font-bold text-emerald-600 block">
                          Done: {formatDateLabel(pm.completedAt)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePMStatus(pm.id, pm.status)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${
                        isCompleted
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm hover:bg-emerald-600'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/20'
                      }`}
                    >
                      {isCompleted ? '✓ Completed' : '• Pending'}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 flex gap-2 items-center text-xs text-slate-500">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <p>You can click the status badges above to quickly toggle maintenance cycle logs in the database.</p>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Billing & Incidents */}
        <div className="space-y-6">
          
          {/* Portfolio Value */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden min-h-[140px]">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Contract Value</span>
              <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">₹{Number(contract.amount).toLocaleString('en-IN')}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold bg-amber-500/10 w-fit px-2.5 py-1 rounded-lg mt-4">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Full Portfolio Active Value</span>
            </div>
          </div>

          {/* Incidents / Breakdowns */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between relative overflow-hidden min-h-[140px]">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Breakdown Incidents</span>
              <h3 className="text-3xl font-extrabold text-rose-600 tracking-tight mt-1">{contract.bdCount === 999 ? 'Unlimited' : contract.bdCount} Visits</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-500/10 w-fit px-2.5 py-1 rounded-lg mt-4">
              <Activity className="w-3.5 h-3.5" />
              <span>SLA Response Incidents Logged</span>
            </div>
          </div>

          {/* Billing Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="w-4.5 h-4.5 text-[#82A094]" />
              <span>Purchase Order & Billing</span>
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-bold uppercase text-[9px]">PO Number</span>
                <span className="font-mono font-bold text-slate-800">{contract.poNo}</span>
              </div>
              
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-bold uppercase text-[9px]">PO Date</span>
                <span className="font-semibold text-slate-700">{formatDateLabel(contract.poDate)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Payment Terms</span>
                <span className="font-semibold text-slate-700">{contract.paymentTerms}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Sched Month</span>
                <span className="font-bold text-slate-800">{contract.scheduledMonth || 'N/A'}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Premium Date Completion Modal */}
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Mark PM Visit Completed</span>
              </h3>
              <button 
                onClick={() => setDateModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Date Completed</label>
              <input
                type="date"
                value={completedDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setCompletedDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#82A094]/30 text-slate-800"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDateModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCompletion}
                className="flex-1 px-4 py-2 bg-[#82A094] hover:bg-[#6e897e] text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
