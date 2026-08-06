'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, CheckCircle, AlertTriangle, RefreshCw, Sparkles, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface ContractEditFormProps {
  id: number;
  role: string;
  backUrl: string;
}

export default function ContractEditForm({ id, role, backUrl }: ContractEditFormProps) {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [editCustName, setEditCustName] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editPoNo, setEditPoNo] = useState('');
  const [editPoDate, setEditPoDate] = useState('');
  const [editMcType, setEditMcType] = useState('Flex Care');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [editZoneName, setEditZoneName] = useState('');
  const [editMachines, setEditMachines] = useState('1');
  const [editValue, setEditValue] = useState('');
  const [editVisits, setEditVisits] = useState('3');
  const [editBdCount, setEditBdCount] = useState('0');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [selectedEngineers, setSelectedEngineers] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editSoftwareSupport, setEditSoftwareSupport] = useState(false);
  const [editStatus, setEditStatus] = useState('Active');
  const [contractNumber, setContractNumber] = useState('');

  // Fetch contract and dependencies
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cData, zData, uData, contract] = await Promise.all([
          apiService.getCustomers({ limit: 1000 }),
          apiService.getZones(),
          apiService.getUsers({ limit: 1000 }),
          apiService.getContract(id)
        ]);

        const zonesArray = Array.isArray(zData) ? zData : (zData?.data || []);
        setCustomers(cData);
        setZones(zonesArray);
        setUsersList(uData.users || uData || []);

        if (contract) {
          setContractNumber(contract.contractNumber || '');
          setSelectedCustomerId(String(contract.customerId || ''));
          setEditCustName(contract.customerName || '');
          setEditPlace(contract.place || '');
          setEditPoNo(contract.poNo || '');
          setEditPoDate(contract.poDate ? contract.poDate.substring(0, 10) : '');
          setEditMcType(contract.mcType || 'Flex Care');
          setSelectedZoneId(String(contract.zoneId || ''));
          setEditZoneName(contract.zoneName || '');
          setEditMachines(String(contract.noOfMachine || 1));
          setEditValue(String(contract.amount || ''));
          setEditVisits(String(contract.noOfVisits || 3));
          setEditBdCount(contract.bdCount === 999 ? 'Unlimited' : String(contract.bdCount || 0));
          setEditStartDate(contract.startDate ? contract.startDate.substring(0, 10) : '');
          setEditEndDate(contract.endDate ? contract.endDate.substring(0, 10) : '');
          const resp = contract.responsible || '';
          setEditResponsible(resp);
          setSelectedEngineers(resp.split(/[\/,]+/).map((s: string) => s.trim()).filter(Boolean));
          setEditPaymentTerms(contract.paymentTerms || '');
          setEditSoftwareSupport(contract.softwareSupport || false);
          setEditStatus(contract.status || 'Active');
        }
      } catch (err) {
        console.error('Failed to load edit form data', err);
        toast.error('Failed to load contract details from database');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  const handleToggleEngineer = (engName: string) => {
    setSelectedEngineers(prev => {
      const isChecked = prev.includes(engName);
      const updated = isChecked ? prev.filter(name => name !== engName) : [...prev, engName];
      setEditResponsible(updated.join(' / '));
      return updated;
    });
  };

  const handleCustomerChange = (idStr: string) => {
    setSelectedCustomerId(idStr);
    const idNum = Number(idStr);
    const selectedCust = customers.find(c => c.id === idNum);
    if (selectedCust) {
      setEditCustName(selectedCust.companyName);
      setEditPlace(selectedCust.address || 'India');

      if (selectedCust.serviceZone) {
        setEditZoneName(selectedCust.serviceZone.name);
        setSelectedZoneId(String(selectedCust.serviceZoneId));
      }
    }
  };

  const handleUpdateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !editPlace || !editPoNo || !editValue || !editStartDate || !editEndDate || !selectedZoneId) {
      toast.error('Please fill in all mandatory fields');
      return;
    }

    const val = parseFloat(editValue);
    const machines = parseInt(editMachines);
    const visits = parseInt(editVisits);
    const bdStr = String(editBdCount).trim().toLowerCase();
    const bds = (bdStr === 'unlimited' || bdStr === 'ul') ? 999 : (parseInt(bdStr, 10) || 0);

    if (isNaN(val) || isNaN(machines) || isNaN(visits)) {
      toast.error('Please enter valid numerical values');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.updateContract(id, {
        customerName: editCustName,
        place: editPlace,
        poNo: editPoNo,
        poDate: editPoDate || editStartDate,
        mcType: editMcType,
        noOfMachine: machines,
        amount: val,
        noOfVisits: visits,
        startDate: editStartDate,
        endDate: editEndDate,
        responsible: editResponsible,
        zoneName: editZoneName,
        bdCount: bds,
        paymentTerms: editPaymentTerms,
        softwareSupport: editSoftwareSupport,
        status: editStatus,
        customerId: Number(selectedCustomerId),
        zoneId: Number(selectedZoneId)
      });
      toast.success('Contract agreement updated successfully!');
      router.push(backUrl);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to update contract');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-[#82A094] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-semibold">Loading agreement details...</p>
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
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Edit Agreement</h1>
              <p className="text-white/60 text-xs mt-1">Modifying contract serial <span className="font-mono text-white font-bold">{contractNumber}</span>.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Editing Card */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleUpdateContract} className="space-y-6 text-xs font-semibold">

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
                {(() => {
                  const seenLabels = new Set<string>();
                  return customers
                    .filter(c => {
                      const name = (c.companyName || '').trim();
                      return name && name !== '*';
                    })
                    .map(c => {
                      const zoneName = c.serviceZone?.name || zones.find((z: any) => Number(z.id) === Number(c.serviceZoneId))?.name;
                      const addressStr = (c.address || '').trim();
                      const label = `${c.companyName}${addressStr ? ` - ${addressStr}` : ''}${zoneName ? ` (${zoneName} Zone)` : ''}`;
                      return { id: c.id, label };
                    })
                    .filter(item => {
                      if (seenLabels.has(item.label)) return false;
                      seenLabels.add(item.label);
                      return true;
                    })
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ));
                })()}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Place (Location) *</label>
              <input
                type="text"
                required
                readOnly
                placeholder="Auto-filled from Customer"
                value={editPlace}
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
                value={editPoNo}
                onChange={(e) => setEditPoNo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">PO Date</label>
              <input
                type="date"
                value={editPoDate}
                onChange={(e) => setEditPoDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">MC Contract Type</label>
              <select
                value={editMcType}
                onChange={(e) => setEditMcType(e.target.value)}
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
                value={editZoneName}
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
                value={editMachines}
                onChange={(e) => setEditMachines(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contract Value Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 150000"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Number of Visits</label>
              <select
                value={editVisits}
                onChange={(e) => setEditVisits(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    {v} PM {v === 1 ? 'Visit' : 'Visits'} / Year
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">BDs Logged / Incidents</label>
              <input
                type="text"
                placeholder='Enter count or "Unlimited"'
                value={editBdCount}
                onChange={(e) => setEditBdCount(e.target.value)}
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
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Contract End Date *</label>
              <input
                type="date"
                required
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Responsible Eng</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full min-h-[38px] px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs font-semibold shadow-sm transition-all text-[#546A7A] flex flex-wrap items-center gap-1.5 justify-between text-left"
                >
                  <div className="flex flex-wrap gap-1.5 max-w-[90%]">
                    {selectedEngineers.length === 0 ? (
                      <span className="text-slate-400">-- Choose Engineers --</span>
                    ) : (
                      selectedEngineers.map((eng) => (
                        <span
                          key={eng}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#82A094]/15 text-[#4F6A64] text-[10px] font-bold border border-[#82A094]/30 animate-in zoom-in-95 duration-100"
                        >
                          {eng}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleEngineer(eng);
                            }}
                            className="hover:bg-[#82A094]/30 rounded px-0.5 cursor-pointer text-[#82A094] leading-none"
                          >
                            ×
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                  <span className="text-slate-400">▼</span>
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100 custom-scrollbar">
                      {(() => {
                        const filtered = usersList.filter((u: any) => {
                          const role = (u.role || '').toUpperCase();
                          return role === 'ZONE_USER' || role === 'ZONE_MANAGER' || role.includes('ZONE');
                        });
                        const listToUse = filtered.length > 0 ? filtered : usersList;
                        
                        const seen = new Set<string>();
                        const uniqueList = listToUse.filter((u: any) => {
                          const nameStr = (u.name || u.email || '').trim();
                          if (!nameStr) return false;
                          const firstWord = nameStr.split(/\s+/)[0].toLowerCase();
                          let normalized = firstWord;
                          if (normalized === 'asharf') normalized = 'ashraf';
                          
                          if (seen.has(normalized)) return false;
                          seen.add(normalized);
                          return true;
                        });
                        
                        return uniqueList.map((u: any) => {
                          const nameVal = u.name || u.email;
                          const isChecked = selectedEngineers.includes(nameVal);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold transition-all hover:bg-slate-50 ${isChecked ? 'bg-[#82A094]/5 text-[#4F6A64]' : 'text-[#546A7A]'}`}
                            >
                              <span>{nameVal}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleEngineer(nameVal)}
                                className="w-4 h-4 rounded border-slate-300 text-[#82A094] focus:ring-[#82A094]/20 cursor-pointer"
                              />
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
              <input
                type="text"
                value={editPaymentTerms}
                onChange={(e) => setEditPaymentTerms(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Agreement Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#82A094]/20 text-xs"
              >
                <option value="Active">Active</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="sw_support_edit"
                checked={editSoftwareSupport}
                onChange={(e) => setEditSoftwareSupport(e.target.checked)}
                className="w-4 h-4 text-[#82A094] border-slate-300 rounded focus:ring-[#82A094] cursor-pointer"
              />
              <label htmlFor="sw_support_edit" className="text-slate-600 font-bold select-none cursor-pointer">Include Software Support License</label>
            </div>
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
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
