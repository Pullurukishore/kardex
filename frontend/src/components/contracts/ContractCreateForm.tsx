'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, CheckCircle, RefreshCw, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

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
  const [newZoneName, setNewZoneName] = useState('West');
  const [newMachines, setNewMachines] = useState('1');
  const [newValue, setNewValue] = useState('');
  const [newVisits, setNewVisits] = useState('3');
  const [newBdCount, setNewBdCount] = useState('0');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newResponsible, setNewResponsible] = useState('Rahul');
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
        
        setCustomers(cData);
        setZones(zData);
        const users = uData.users || uData || [];
        setUsersList(users);
        
        if (users.length > 0) {
          setNewResponsible(users[0].name || users[0].email || 'Rahul');
        }
        if (zData.length > 0) {
          setNewZoneName(zData[0].name || 'West');
          setSelectedZoneId(String(zData[0].id));
        }
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

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newPlace || !newPoNo || !newValue || !newStartDate || !newEndDate || !selectedZoneId) {
      toast.error('Please fill in all mandatory fields');
      return;
    }

    const val = parseFloat(newValue);
    const machines = parseInt(newMachines);
    const visits = parseInt(newVisits);
    const bds = parseInt(newBdCount);

    if (isNaN(val) || isNaN(machines) || isNaN(visits) || isNaN(bds)) {
      toast.error('Please enter valid numerical values');
      return;
    }

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
      toast.success('Contract agreement created successfully!');
      router.push(backUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create contract');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-semibold">Loading agreement form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-medium text-slate-800">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#E17F70]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-[#82A094]/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push(backUrl)}
              className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 active:scale-95 transition-all text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#82A094]/15 border border-[#82A094]/30 mb-2">
                <Sparkles className="w-4 h-4 text-[#82A094]" />
                <span className="text-[10px] font-bold text-[#82A094] tracking-wider uppercase">{role} View</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Add Service Agreement</h1>
              <p className="text-white/60 text-xs mt-1">Register a new contract and distribute preventive maintenance cycle schedules.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleAddContract} className="space-y-6 text-xs font-semibold">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Select Customer *</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Place (Location) *</label>
              <input
                type="text"
                required
                readOnly
                placeholder="Auto-filled from Customer"
                value={newPlace}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">PO Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. PO-12345"
                value={newPoNo}
                onChange={(e) => setNewPoNo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">PO Date</label>
              <input
                type="date"
                value={newPoDate}
                onChange={(e) => setNewPoDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">MC Contract Type</label>
              <select
                value={newMcType}
                onChange={(e) => setNewMcType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                <option value="Flex Care">Flex Care</option>
                <option value="Active Care">Active Care</option>
                <option value="Premium Care">Premium Care</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Service Zone</label>
              <input
                type="text"
                readOnly
                value={newZoneName}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Machines Covered</label>
              <input
                type="number"
                min="1"
                value={newMachines}
                onChange={(e) => setNewMachines(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Value Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 150000"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Number of Visits</label>
              <select
                value={newVisits}
                onChange={(e) => setNewVisits(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                <option value="1">1 PM Visit</option>
                <option value="2">2 PM Visits</option>
                <option value="3">3 PM Visits</option>
                <option value="4">4 PM Visits</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">BDs Logged / Incidents</label>
              <input
                type="number"
                min="0"
                value={newBdCount}
                onChange={(e) => setNewBdCount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Start Date *</label>
              <input
                type="date"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contract End Date *</label>
              <input
                type="date"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Responsible Eng</label>
              <select
                value={newResponsible}
                onChange={(e) => setNewResponsible(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                {usersList.map((u: any) => (
                  <option key={u.id} value={u.name || u.email}>{u.name || u.email}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
              <input
                type="text"
                value={newPaymentTerms}
                onChange={(e) => setNewPaymentTerms(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="sw_support"
              checked={newSoftwareSupport}
              onChange={(e) => setNewSoftwareSupport(e.target.checked)}
              className="w-4 h-4 text-[#82A094] border-slate-300 rounded focus:ring-[#82A094] cursor-pointer"
            />
            <label htmlFor="sw_support" className="text-slate-600 font-bold select-none cursor-pointer">Include Software Support License</label>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100 justify-end">
            <button
              type="button"
              onClick={() => router.push(backUrl)}
              className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 text-xs transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#82A094] hover:bg-[#6e897e] rounded-xl font-bold text-white text-xs transition-all active:scale-[0.98] shadow-lg shadow-[#82A094]/15 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Create Agreement
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
