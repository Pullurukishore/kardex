"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import { 
    Download, 
    Search, 
    CheckCircle2, 
    AlertCircle, 
    FileText, 
    Building2,
    ArrowUpRight,
    TrendingUp,
    ShieldCheck,
    ArrowDownToLine,
    Eye,
    Copy,
    Check,
    Globe,
    Landmark,
    Activity,
    User,
    CreditCard,
    Sparkles,
    Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { arApi } from '@/lib/ar-api';
import { toast } from 'sonner';

// Lazy-load FilePreview — it pulls in heavy libraries like xlsx
const FilePreview = dynamic(() => import('@/components/FilePreview'), {
  ssr: false,
  loading: () => null,
});

export default function BankAccountReportsPage() {
    const [auditData, setAuditData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [audit, compliance] = await Promise.all([
                arApi.getVendorMasterAudit(),
                arApi.getBankComplianceMetrics()
            ]);
            setAuditData(audit.data);
            setSummary(audit.summary);
            setMetrics(compliance);
        } catch (error) {
            console.error('Failed to fetch report data:', error);
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    const handleExportMaster = async () => {
        if (exporting || auditData.length === 0) return;
        
        try {
            setExporting(true);
            const toastId = toast.loading('Preparing master export...');
            
            // Format data for Excel
            const exportRows = auditData.map(row => ({
                'Vendor Name': row.vendorName,
                'BP Code': row.bpCode || 'N/A',
                'Account Number': row.accountNumber,
                'Beneficiary Name': row.beneficiaryName || row.vendorName,
                'Bank Name': row.beneficiaryBankName,
                'IFSC/SWIFT': row.ifscCode,
                'Currency': row.currency,
                'Account Type': row.accountType || 'Savings',
                'Category': row.accountCategory,
                'PAN Number': row.panNumber || '—',
                'GST Number': row.gstNumber || '—',
                'MSME Status': row.isMSME ? 'Registered' : 'Regular',
                'Udyam Number': row.udyamRegNum || '—',
                'Email ID': row.emailId || '—',
                'KYC Status': row.kycStatus,
                'Registration Date': new Date(row.createdAt).toLocaleDateString()
            }));

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Vendor Bank Master");

            // Auto-size columns (rough estimate)
            const maxWidths = Object.keys(exportRows[0] || {}).map(key => ({
                wch: Math.max(key.length, ...exportRows.map(row => String((row as any)[key]).length)) + 2
            }));
            ws['!cols'] = maxWidths;

            // Generate and download file
            XLSX.writeFile(wb, `Vendor_Bank_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            toast.dismiss(toastId);
            toast.success('Master export downloaded successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export master data');
        } finally {
            setExporting(false);
        }
    };

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    }, []);

    const handleDownloadDocument = (attachmentId: string) => {
        arApi.downloadBankAccountAttachment(attachmentId);
    };

    const handlePreviewDocument = (file: any) => {
        setPreviewFile(file);
        setShowPreview(true);
    };

    const filteredAudit = auditData.filter(acc => 
        acc.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.bpCode && acc.bpCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        acc.accountNumber.includes(searchTerm) ||
        (acc.beneficiaryName && acc.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 md:p-6 space-y-6 bg-[#F8FAFB] min-h-screen">
            {/* Header section with glassmorphism */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/70">Intelligence Hub</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-[#1A3352]">Bank Account Reports</h1>
                    <p className="text-[#92A2A5] text-sm font-medium mt-1">Audit vendor master, compliance status, and payment operations.</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={handleExportMaster}
                        disabled={exporting || auditData.length === 0}
                        className="rounded-xl border-[#AEBFC3]/30 text-[#546A7A] font-bold h-11 px-5 hover:bg-[#F8FAFB]"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {exporting ? 'Exporting...' : 'Export Master'}
                    </Button>
                    <Button onClick={fetchData} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold h-11 px-5 shadow-lg shadow-blue-200">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg bg-gradient-to-br from-[#1A3352] to-[#2C5282] text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
                    <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-blue-100/70 text-[10px] font-black uppercase tracking-[0.15em]">Total Vendors</p>
                                <h3 className="text-4xl font-black mt-2 text-white">{summary?.totalAccounts || 0}</h3>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                                <Building2 className="h-6 w-6 text-white" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center justify-between">
                            <span className="text-xs text-blue-100/60 font-bold uppercase tracking-wider">System Registered</span>
                            <ArrowUpRight className="h-4 w-4 text-blue-300" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-green-50 rounded-full -mr-8 -mb-8 transition-transform group-hover:scale-150 duration-700" />
                    <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[#92A2A5] text-[10px] font-black uppercase tracking-[0.15em]">KYC Verified</p>
                                <h3 className="text-4xl font-black mt-2 text-[#1A3352]">{summary?.verifiedAccounts || 0}</h3>
                            </div>
                            <div className="p-3 bg-green-50 rounded-2xl border border-green-100 transition-colors group-hover:bg-green-100">
                                <ShieldCheck className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                        <div className="mt-6">
                            <Badge className="bg-green-50 text-green-700 border-green-100 hover:bg-green-100 font-black text-[10px] px-3 py-1">
                                {metrics?.compliance?.kycRate || 0}% Verification Rate
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-8 -mb-8 transition-transform group-hover:scale-150 duration-700" />
                    <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[#92A2A5] text-[10px] font-black uppercase tracking-[0.15em]">MSME Scale</p>
                                <h3 className="text-4xl font-black mt-2 text-[#1A3352]">{metrics?.distribution?.msme || 0}</h3>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 transition-colors group-hover:bg-purple-100">
                                <FileText className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                        <div className="mt-6 text-[11px] font-bold text-[#92A2A5] uppercase tracking-wider">
                            {metrics?.distribution?.nonMsme || 0} Standard Profiles
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-700" />
                    <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[#92A2A5] text-[10px] font-black uppercase tracking-[0.15em]">Critical Gaps</p>
                                <h3 className="text-4xl font-black mt-2 text-red-600">{summary?.pendingAccounts || 0}</h3>
                            </div>
                            <div className="p-3 bg-red-50 rounded-2xl border border-red-100 transition-colors group-hover:bg-red-100">
                                <AlertCircle className="h-6 w-6 text-red-600 animate-pulse" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2">
                             <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                             <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">KYC Action Required</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="audit" className="w-full">
                <TabsList className="bg-white/50 backdrop-blur-sm border border-[#AEBFC3]/20 p-1.5 h-14 rounded-2xl gap-2 shadow-sm">
                    <TabsTrigger value="audit" className="px-8 rounded-xl font-bold text-sm data-[state=active]:bg-[#1A3352] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Vendor Master Audit</TabsTrigger>
                    <TabsTrigger value="compliance" className="px-8 rounded-xl font-bold text-sm data-[state=active]:bg-[#1A3352] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Compliance Summary</TabsTrigger>
                    <TabsTrigger value="payments" className="px-8 rounded-xl font-bold text-sm data-[state=active]:bg-[#1A3352] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Payment Insights</TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="mt-6">
                    <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="p-8 border-b border-[#AEBFC3]/10">
                            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Building2 className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <CardTitle className="text-2xl font-black text-[#1A3352]">Vendor Detail & Document Control</CardTitle>
                                    </div>
                                    <CardDescription className="text-[#92A2A5] font-medium text-base">Comprehensive audit of all vendor financial master data and verification documents.</CardDescription>
                                </div>
                                <div className="relative w-full lg:w-96 shadow-sm hover:shadow-md transition-shadow duration-300">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#92A2A5]" />
                                    <Input 
                                        placeholder="Search by vendor, code, or account..." 
                                        className="h-14 pl-12 rounded-2xl bg-white border-[#AEBFC3]/20 focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all font-medium"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="w-full">
                                <Table className="border-collapse min-w-[2000px]">
                                    <TableHeader className="bg-[#F8FAFB]">
                                        <TableRow className="hover:bg-transparent border-b border-[#AEBFC3]/10">
                                            <TableHead className="w-[300px] border-r border-[#AEBFC3]/10 px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Primary Vendor Info</TableHead>
                                            <TableHead className="w-[120px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">BP Code</TableHead>
                                            <TableHead className="w-[280px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Account Details</TableHead>
                                            <TableHead className="w-[220px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Bank & Routing</TableHead>
                                            <TableHead className="w-[180px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Compliance Status</TableHead>
                                            <TableHead className="w-[200px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Tax Information</TableHead>
                                            <TableHead className="w-[200px] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">MSME Registry</TableHead>
                                            <TableHead className="px-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#546A7A]">Audit Evidence (Docs)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <div className="h-10 w-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                                        <span className="text-sm font-bold text-[#92A2A5] uppercase tracking-widest">Compiling Database Audit...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredAudit.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-64 text-center">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <Search className="h-12 w-12 text-[#AEBFC3]/30" />
                                                        <span className="text-sm font-bold text-[#92A2A5] uppercase tracking-widest">No matching master data found</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredAudit.map((row) => (
                                                <TableRow key={row.id} className="hover:bg-[#F8FAFB]/50 border-b border-[#AEBFC3]/5 transition-colors group">
                                                    {/* Primary Vendor Info */}
                                                    <TableCell className="px-6 py-6 border-r border-[#AEBFC3]/5 sticky left-0 bg-white z-10 group-hover:bg-[#F8FAFB]/50 transition-colors">
                                                        <div className="flex items-start gap-4">
                                                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 flex items-center justify-center font-black text-blue-600 text-lg shadow-sm shrink-0">
                                                                {row.vendorName.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black text-[#1A3352] text-base truncate group-hover:text-blue-700 transition-colors" title={row.vendorName}>{row.vendorName}</div>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <Mail className="h-3 w-3 text-[#92A2A5]" />
                                                                    <span className="text-xs font-bold text-[#92A2A5] truncate max-w-[150px]">{row.emailId || 'no-email@vendor.com'}</span>
                                                                </div>
                                                                {row.nickName && (
                                                                    <div className="inline-block mt-2 px-2 py-0.5 rounded-md bg-[#F4F7F9] text-[10px] font-bold text-[#546A7A] uppercase tracking-wider">
                                                                        AKA: {row.nickName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* BP Code */}
                                                    <TableCell className="px-6">
                                                        <div className="font-mono font-black text-xs text-[#546A7A] bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 inline-block">
                                                            {row.bpCode || 'N/A'}
                                                        </div>
                                                    </TableCell>

                                                    {/* Account Details */}
                                                    <TableCell className="px-6">
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#AEBFC3]">Account Num</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono text-sm font-black text-[#1A3352] tracking-wider">{row.accountNumber}</span>
                                                                    <button onClick={() => copyToClipboard(row.accountNumber, `acc-${row.id}`)} className="h-6 w-6 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors">
                                                                        {copied === `acc-${row.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-[#92A2A5]" />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between pt-1 border-t border-[#AEBFC3]/5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#AEBFC3]">Beneficiary</span>
                                                                <span className="text-[11px] font-black text-[#546A7A] truncate ml-4" title={row.beneficiaryName || row.vendorName}>
                                                                    {row.beneficiaryName || row.vendorName}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <Badge className="bg-[#6F8A9D]/10 text-[#1A3352] border-0 text-[9px] font-black uppercase">
                                                                    {row.accountType || 'Savings'}
                                                                </Badge>
                                                                <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px] font-black">
                                                                    {row.currency}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Bank & Routing */}
                                                    <TableCell className="px-6">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                                                                <Landmark className="h-4 w-4 text-[#92A2A5]" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-black text-[#1A3352] text-xs truncate max-w-[150px]" title={row.beneficiaryBankName}>{row.beneficiaryBankName}</div>
                                                                <div className="font-mono text-[11px] font-black text-blue-600 mt-1 flex items-center gap-1.5">
                                                                    {row.ifscCode}
                                                                    <button onClick={() => copyToClipboard(row.ifscCode, `ifsc-${row.id}`)} className="h-5 w-5 rounded-md hover:bg-blue-50 flex items-center justify-center transition-colors">
                                                                         {copied === `ifsc-${row.id}` ? <Check className="h-2.5 w-2.5 text-green-600" /> : <Copy className="h-2.5 w-2.5 text-blue-400" />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Compliance Status */}
                                                    <TableCell className="px-6">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2">
                                                                {row.kycStatus === 'VERIFIED' ? (
                                                                    <Badge className="bg-green-50 text-green-700 border-green-100 hover:bg-green-50 flex items-center gap-1.5 py-1 px-3 shadow-sm rounded-lg">
                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                        <span className="text-[10px] font-black uppercase tracking-wider">Verified</span>
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-50 flex items-center gap-1.5 py-1 px-3 shadow-sm rounded-lg">
                                                                        <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                                                                        <span className="text-[10px] font-black uppercase tracking-wider">Pending</span>
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                                row.accountCategory === 'DOMESTIC' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                row.accountCategory === 'INTERNATIONAL' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                                'bg-amber-50 text-amber-700 border border-amber-100'
                                                            }`}>
                                                                {row.accountCategory === 'DOMESTIC' ? '🏠 Domestic' :
                                                                 row.accountCategory === 'INTERNATIONAL' ? '🌐 Intl' :
                                                                 '👤 Employee'}
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Tax Info */}
                                                    <TableCell className="px-6">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#92A2A5]">PAN</span>
                                                                <span className="font-mono text-[11px] font-black text-[#1A3352]">{row.panNumber || '—'}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#92A2A5]">GST</span>
                                                                <span className="font-mono text-[11px] font-black text-[#546A7A] truncate max-w-[120px]" title={row.gstNumber}>{row.gstNumber || '—'}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* MSME Registry */}
                                                    <TableCell className="px-6">
                                                        <div className="space-y-2">
                                                            <Badge variant="outline" className={`rounded-lg py-1 px-3 font-black text-[10px] uppercase border-2 ${
                                                                row.isMSME ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-slate-50 border-slate-200 text-slate-400"
                                                            }`}>
                                                                {row.isMSME ? '⭐ MSME Registered' : 'Regular Vendor'}
                                                            </Badge>
                                                            {row.isMSME && row.udyamRegNum && (
                                                                <div className="text-[9px] font-bold text-[#92A2A5] font-mono mt-1 pt-1 border-t border-purple-100">
                                                                    UDYAM-{row.udyamRegNum}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Audit Evidence (Docs) */}
                                                    <TableCell className="px-6 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {row.attachments && row.attachments.length > 0 ? (
                                                                row.attachments.map((att: any) => (
                                                                    <div key={att.id} className="flex bg-white rounded-xl border border-[#AEBFC3]/20 shadow-sm overflow-hidden divide-x divide-[#AEBFC3]/10">
                                                                        <button 
                                                                            onClick={() => handlePreviewDocument(att)}
                                                                            className="px-3 py-2 text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                                                                            title={`Preview ${att.filename || 'Document'}`}
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                            <span className="text-[10px] font-black uppercase">Preview</span>
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDownloadDocument(att.id)}
                                                                            className="px-3 py-2 text-[#546A7A] hover:bg-slate-50 transition-colors"
                                                                            title={`Download ${att.filename || 'Document'}`}
                                                                        >
                                                                            <ArrowDownToLine className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="group flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-100 text-red-400">
                                                                    <FileText className="h-4 w-4 opacity-50" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest italic group-hover:animate-pulse">Audit Gap</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                        {summary && (
                            <div className="bg-[#F8FAFB] px-8 py-5 border-t border-[#AEBFC3]/10 flex flex-wrap gap-8 items-center justify-between">
                                <div className="flex flex-wrap gap-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                                        <span className="text-xs font-bold text-[#546A7A]">Total Records: <span className="font-black text-[#1A3352]">{summary.totalAccounts}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                        <span className="text-xs font-bold text-[#546A7A]">Verified: <span className="font-black text-[#1A3352]">{summary.verifiedAccounts}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse" />
                                        <span className="text-xs font-bold text-[#546A7A]">Audit Required: <span className="font-black text-[#1A3352] text-red-600">{summary.pendingAccounts}</span></span>
                                    </div>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#AEBFC3]">Reports sync with ERP • Real-time Data Feed</p>
                            </div>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="compliance">
                    <Card className="border-0 shadow-xl rounded-3xl overflow-hidden min-h-[500px] flex flex-col items-center justify-center p-12 text-center bg-white relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-white pointer-events-none" />
                        <div className="relative">
                            <div className="h-20 w-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-6 mx-auto border-2 border-dashed border-indigo-200">
                                <Activity className="h-10 w-10 text-indigo-400" />
                            </div>
                            <h3 className="text-2xl font-black text-[#1A3352] mb-3">Compliance Analytics</h3>
                            <p className="text-[#92A2A5] font-medium max-w-sm mx-auto mb-8 leading-relaxed">
                                Generating high-fidelity distribution charts for KYC completion and Vendor classification.
                            </p>
                            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Domestic</div>
                                    <div className="text-3xl font-black text-[#1A3352]">{metrics?.distribution?.domestic || 0}</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-shadow">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">International</div>
                                    <div className="text-3xl font-black text-[#1A3352]">{metrics?.distribution?.international || 0}</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="payments">
                    <Card className="border-0 shadow-xl rounded-3xl overflow-hidden min-h-[500px] flex flex-col items-center justify-center p-12 text-center bg-white relative">
                         <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-white pointer-events-none" />
                         <div className="relative">
                            <div className="h-20 w-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mb-6 mx-auto border-2 border-dashed border-emerald-200">
                                <CreditCard className="h-10 w-10 text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-black text-[#1A3352] mb-3">Payment Distribution Insights</h3>
                            <p className="text-[#92A2A5] font-medium max-w-sm mx-auto mb-8 leading-relaxed">
                                Detailed analysis of payment volumes, merchant distribution, and treasury routing.
                            </p>
                            <div className="inline-flex items-center gap-3 px-6 py-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 font-black text-[10px] uppercase tracking-widest animate-pulse">
                                <TrendingUp className="h-4 w-4" />
                                Synchronizing Treasury Data...
                            </div>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Document Preview Dialog */}
            <FilePreview 
                isOpen={showPreview} 
                onClose={() => setShowPreview(false)} 
                file={previewFile} 
            />
        </div>
    );
}
