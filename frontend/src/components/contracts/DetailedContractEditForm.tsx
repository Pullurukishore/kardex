'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Cpu, Building2, Calendar, Shield, IndianRupee,
  Save, X, Loader2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface DetailedContractEditFormProps {
  id: number;
  role: string;
  backUrl: string;
}

export default function DetailedContractEditForm({ id, role, backUrl }: DetailedContractEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerClass, setCustomerClass] = useState('A');
  const [place, setPlace] = useState('');
  const [department, setDepartment] = useState('');
  const [zoneName, setZoneName] = useState('West');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [engineerName, setEngineerName] = useState('');

  // Machine Specs
  const [serialNumber, setSerialNumber] = useState('');
  const [unitType, setUnitType] = useState('Shuttle NT');
  const [controlType, setControlType] = useState('');
  const [installationYear, setInstallationYear] = useState('');
  const [softwareName, setSoftwareName] = useState('');
  const [contractType, setContractType] = useState('UMC');

  // MC Period
  const [mcPoNumber, setMcPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [mcStartDate, setMcStartDate] = useState('');
  const [mcEndDate, setMcEndDate] = useState('');
  const [mcValue, setMcValue] = useState('');
  const [pmVisitsCount, setPmVisitsCount] = useState('3');
  const [bdVisitsCount, setBdVisitsCount] = useState('3');

  // Warranty & Auxiliary
  const [warrantyStartDate, setWarrantyStartDate] = useState('');
  const [warrantyEndDate, setWarrantyEndDate] = useState('');
  const [softwarePoNo, setSoftwarePoNo] = useState('');
  const [softwareStartDate, setSoftwareStartDate] = useState('');
  const [softwareEndDate, setSoftwareEndDate] = useState('');
  const [remoteSupportStartDate, setRemoteSupportStartDate] = useState('');
  const [remoteSupportEndDate, setRemoteSupportEndDate] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [cData, zData, contract] = await Promise.all([
          apiService.getCustomers({ limit: 1000 }),
          apiService.getZones(),
          apiService.getDetailedContract(id),
        ]);

        setCustomers(Array.isArray(cData) ? cData : (cData?.customers || []));
        setZones(Array.isArray(zData) ? zData : (zData?.data || []));

        if (contract) {
          setCustomerName(contract.customerName || '');
          setSelectedCustomerId(contract.customerId ? String(contract.customerId) : '');
          setCustomerClass(contract.customerClass || 'A');
          setPlace(contract.place || '');
          setDepartment(contract.department || '');
          setZoneName(contract.zoneName || 'West');
          setSelectedZoneId(contract.zoneId ? String(contract.zoneId) : '');
          setEngineerName(contract.engineerName || '');

          setSerialNumber(contract.serialNumber || '');
          setUnitType(contract.unitType || 'Shuttle NT');
          setControlType(contract.controlType || '');
          setInstallationYear(contract.installationYear || '');
          setSoftwareName(contract.softwareName || '');
          setContractType(contract.contractType || 'UMC');

          setMcPoNumber(contract.mcPoNumber || '');
          setPoDate(contract.poDate ? contract.poDate.substring(0, 10) : '');
          setMcStartDate(contract.mcStartDate ? contract.mcStartDate.substring(0, 10) : '');
          setMcEndDate(contract.mcEndDate ? contract.mcEndDate.substring(0, 10) : '');
          setMcValue(contract.mcValue !== null && contract.mcValue !== undefined ? String(contract.mcValue) : '');
          setPmVisitsCount(String(contract.pmVisitsCount || 0));
          setBdVisitsCount(String(contract.bdVisitsCount || 0));

          setWarrantyStartDate(contract.warrantyStartDate ? contract.warrantyStartDate.substring(0, 10) : '');
          setWarrantyEndDate(contract.warrantyEndDate ? contract.warrantyEndDate.substring(0, 10) : '');
          setSoftwarePoNo(contract.softwarePoNo || '');
          setSoftwareStartDate(contract.softwareStartDate ? contract.softwareStartDate.substring(0, 10) : '');
          setSoftwareEndDate(contract.softwareEndDate ? contract.softwareEndDate.substring(0, 10) : '');
          setRemoteSupportStartDate(contract.remoteSupportStartDate ? contract.remoteSupportStartDate.substring(0, 10) : '');
          setRemoteSupportEndDate(contract.remoteSupportEndDate ? contract.remoteSupportEndDate.substring(0, 10) : '');
        }
      } catch (err) {
        console.error('Failed to load contract for editing:', err);
        toast.error('Failed to load contract details');
      } finally {
        setLoading(false);
      }
    };

    if (id) loadData();
  }, [id]);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedCustomerId(cid);
    const found = customers.find(c => String(c.id) === cid);
    if (found) {
      setCustomerName(found.companyName);
      if (found.city) setPlace(found.city);
      if (found.zone?.name) {
        setZoneName(found.zone.name);
        setSelectedZoneId(String(found.zone.id));
      }
    }
  };

  const handleZoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zid = e.target.value;
    setSelectedZoneId(zid);
    const found = zones.find(z => String(z.id) === zid);
    if (found) setZoneName(found.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!serialNumber.trim()) {
      toast.error('Serial number is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        customerName: customerName.trim(),
        customerId: selectedCustomerId ? parseInt(selectedCustomerId) : null,
        customerClass,
        place: place.trim() || null,
        department: department.trim() || null,
        zoneName,
        zoneId: selectedZoneId ? parseInt(selectedZoneId) : null,
        engineerName: engineerName.trim() || null,

        serialNumber: serialNumber.trim(),
        unitType: unitType.trim() || null,
        controlType: controlType.trim() || null,
        installationYear: installationYear.trim() || null,
        softwareName: softwareName.trim() || null,
        contractType: contractType.trim() || null,

        mcPoNumber: mcPoNumber.trim() || null,
        poDate: poDate || null,
        mcStartDate: mcStartDate || null,
        mcEndDate: mcEndDate || null,
        mcValue: mcValue ? parseFloat(mcValue) : null,
        pmVisitsCount: parseInt(pmVisitsCount) || 0,
        bdVisitsCount: parseInt(bdVisitsCount) || 0,

        warrantyStartDate: warrantyStartDate || null,
        warrantyEndDate: warrantyEndDate || null,
        softwarePoNo: softwarePoNo.trim() || null,
        softwareStartDate: softwareStartDate || null,
        softwareEndDate: softwareEndDate || null,
        remoteSupportStartDate: remoteSupportStartDate || null,
        remoteSupportEndDate: remoteSupportEndDate || null,
      };

      await apiService.updateDetailedContract(id, payload);
      toast.success('Machine contract updated successfully!');
      router.push(backUrl);
    } catch (err: any) {
      console.error('Failed to update contract:', err);
      toast.error(err.response?.data?.error || 'Failed to update contract');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
        <div className="w-10 h-10 border-3 border-[#82A094]/30 border-t-[#82A094] rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-700">Loading Contract Editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Hero Header ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#3D4F5C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#82A094]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-[#CE9F6B]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(backUrl)}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 mb-2 backdrop-blur-md">
                <Cpu className="w-3.5 h-3.5 text-[#82A094]" />
                <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                  Edit Machine Contract #{id}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Edit {customerName || 'Contract'} ({serialNumber})
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Multi-Section Edit Form ────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer & Ownership */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#6F8A9D]" />
            1. Customer & Regional Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Link Existing Customer</label>
              <select
                value={selectedCustomerId}
                onChange={handleCustomerSelect}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              >
                <option value="">-- Custom / Unlinked Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Bosch Ltd"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Customer Category (Class)</label>
              <select
                value={customerClass}
                onChange={e => setCustomerClass(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              >
                <option value="A">Class A (Strategic Key Account)</option>
                <option value="B">Class B (Standard Account)</option>
                <option value="C">Class C (Occasional Account)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Location / City</label>
              <input
                type="text"
                value={place}
                onChange={e => setPlace(e.target.value)}
                placeholder="e.g. Nasik, Bangalore"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Department / Plant</label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. SO22 nazzl Stores"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Service Zone</label>
              <select
                value={selectedZoneId || zoneName}
                onChange={handleZoneSelect}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              >
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.name} Zone</option>
                ))}
                {zones.length === 0 && (
                  <>
                    <option value="West">West Zone</option>
                    <option value="South">South Zone</option>
                    <option value="North">North Zone</option>
                    <option value="East">East Zone</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Assigned Service Engineer</label>
              <input
                type="text"
                value={engineerName}
                onChange={e => setEngineerName(e.target.value)}
                placeholder="e.g. Rahul, Vinay/Nitin"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Machine Specifications */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Cpu className="w-4 h-4 text-[#82A094]" />
            2. Machine Asset Specifications
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Serial Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="e.g. 97007156/001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Type of Unit / Model</label>
              <input
                type="text"
                value={unitType}
                onChange={e => setUnitType(e.target.value)}
                placeholder="e.g. Shuttle NT, Megamat RS"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Control System</label>
              <input
                type="text"
                value={controlType}
                onChange={e => setControlType(e.target.value)}
                placeholder="e.g. C2000, T88, T3LCD"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Installation Year</label>
              <input
                type="text"
                value={installationYear}
                onChange={e => setInstallationYear(e.target.value)}
                placeholder="e.g. 1997, 2005"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Software Name / Version</label>
              <input
                type="text"
                value={softwareName}
                onChange={e => setSoftwareName(e.target.value)}
                placeholder="e.g. Power Pick Global"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Contract Agreement Type</label>
              <select
                value={contractType}
                onChange={e => setContractType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              >
                <option value="UMC">UMC (Unit Maintenance Contract)</option>
                <option value="CMC">CMC (Comprehensive Maintenance Contract)</option>
                <option value="AMC">AMC (Annual Maintenance Contract)</option>
                <option value="Warranty">Warranty</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Annual Maintenance Contract (MC) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-4 h-4 text-[#CE9F6B]" />
            3. Annual Maintenance Contract (MC) Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">MC PO Number</label>
              <input
                type="text"
                value={mcPoNumber}
                onChange={e => setMcPoNumber(e.target.value)}
                placeholder="e.g. 85446648"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">PO Date</label>
              <input
                type="date"
                value={poDate}
                onChange={e => setPoDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Annual MC Value (₹)</label>
              <input
                type="number"
                value={mcValue}
                onChange={e => setMcValue(e.target.value)}
                placeholder="e.g. 76440"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">MC Period Start Date</label>
              <input
                type="date"
                value={mcStartDate}
                onChange={e => setMcStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">MC Period End Date</label>
              <input
                type="date"
                value={mcEndDate}
                onChange={e => setMcEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">PM Visits Count</label>
                <input
                  type="number"
                  value={pmVisitsCount}
                  onChange={e => setPmVisitsCount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">BD Visits Count</label>
                <input
                  type="number"
                  value={bdVisitsCount}
                  onChange={e => setBdVisitsCount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Warranty & Auxiliary Support */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-[#546A7A] uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <Shield className="w-4 h-4 text-[#82A094]" />
            4. Warranty & Auxiliary Contracts
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Warranty Start Date</label>
              <input
                type="date"
                value={warrantyStartDate}
                onChange={e => setWarrantyStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Warranty End Date</label>
              <input
                type="date"
                value={warrantyEndDate}
                onChange={e => setWarrantyEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Software PO Number</label>
              <input
                type="text"
                value={softwarePoNo}
                onChange={e => setSoftwarePoNo(e.target.value)}
                placeholder="e.g. SWPO-2026-90"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Software Contract Start</label>
              <input
                type="date"
                value={softwareStartDate}
                onChange={e => setSoftwareStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Software Contract End</label>
              <input
                type="date"
                value={softwareEndDate}
                onChange={e => setSoftwareEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Remote Support Start</label>
              <input
                type="date"
                value={remoteSupportStartDate}
                onChange={e => setRemoteSupportStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Remote Support End</label>
              <input
                type="date"
                value={remoteSupportEndDate}
                onChange={e => setRemoteSupportEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/30 focus:border-[#6F8A9D]"
              />
            </div>
          </div>
        </div>

        {/* ─── Bottom Actions Bar ────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-sm flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push(backUrl)}
            disabled={submitting}
            className="px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-2.5 rounded-2xl bg-[#82A094] hover:bg-[#6e8a7f] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{submitting ? 'Saving Changes...' : 'Save Contract'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
