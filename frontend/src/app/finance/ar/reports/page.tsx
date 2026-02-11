'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    RefreshCw, FileText, Download, BarChart3, Clock, DollarSign, 
    AlertTriangle, CheckCircle, Users, TrendingUp, PieChart, Loader2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { 
    arApi, formatARCurrency, formatARDate,
    AgingSummaryData, CollectionTrendsData, TopCustomersData, 
    DSOData, InvoiceStatusData, CustomerRiskData, RiskAgingData
} from '@/lib/ar-api';

// ═══════════════════════════════════════════════════════════════════════════
// REPORT TYPES CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const AR_REPORT_TYPES = [
    { value: 'aging-summary', label: 'Aging Summary' },
    { value: 'aging-detailed', label: 'Detailed Aging Report' },
    { value: 'collection-trends', label: 'Collection Trends' },
    { value: 'dso-report', label: 'DSO Analysis' },
    { value: 'top-customers', label: 'Top Outstanding Customers' },
    { value: 'customer-risk', label: 'Customer Risk Distribution' },
    { value: 'invoice-status', label: 'Invoice Status Summary' },
];

// ═══════════════════════════════════════════════════════════════════════════
// FILTERS COMPONENT (FSM Style)
// ═══════════════════════════════════════════════════════════════════════════

interface ReportFilters {
    reportType: string;
    fromDate: Date;
    toDate: Date;
    status?: string;
    riskClass?: string;
}

interface ARReportFiltersProps {
    filters: ReportFilters;
    onFilterChange: (filters: Partial<ReportFilters>) => void;
    onGenerate: () => void;
    loading: boolean;
}

const ARReportFilters: React.FC<ARReportFiltersProps> = ({
    filters,
    onFilterChange,
    onGenerate,
    loading
}) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Report Type */}
                <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">Report Type</Label>
                    <Select
                        value={filters.reportType}
                        onValueChange={(value) => onFilterChange({ reportType: value })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select report type" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                            {AR_REPORT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* From Date */}
                <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">From Date</Label>
                    <Input
                        type="date"
                        value={format(filters.fromDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                            if (e.target.value) {
                                onFilterChange({ fromDate: new Date(e.target.value) });
                            }
                        }}
                        className="w-full"
                    />
                </div>

                {/* To Date */}
                <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">To Date</Label>
                    <Input
                        type="date"
                        value={format(filters.toDate, 'yyyy-MM-dd')}
                        onChange={(e) => {
                            if (e.target.value) {
                                onFilterChange({ toDate: new Date(e.target.value) });
                            }
                        }}
                        className="w-full"
                    />
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">Status</Label>
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) => onFilterChange({ status: value === 'all' ? undefined : value })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="PARTIAL">Partial</SelectItem>
                            <SelectItem value="OVERDUE">Overdue</SelectItem>
                            <SelectItem value="PAID">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Risk Class Filter */}
                <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">Risk Class</Label>
                    <Select
                        value={filters.riskClass || 'all'}
                        onValueChange={(value) => onFilterChange({ riskClass: value === 'all' ? undefined : value })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="All risk classes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Risk Classes</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button 
                    onClick={onGenerate} 
                    disabled={loading}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Generate Report
                        </>
                    )}
                </Button>
                <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                </Button>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY CARDS (FSM Style)
// ═══════════════════════════════════════════════════════════════════════════

const SummaryCard = ({ 
    title, 
    value, 
    subValue, 
    icon: Icon, 
    trend,
    color = 'blue'
}: { 
    title: string; 
    value: string; 
    subValue?: string;
    icon: any;
    trend?: { value: string; positive: boolean };
    color?: 'blue' | 'green' | 'red' | 'yellow';
}) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        yellow: 'bg-yellow-50 text-yellow-600',
    };

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                        {subValue && (
                            <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
                        )}
                        {trend && (
                            <Badge 
                                variant={trend.positive ? "default" : "destructive"} 
                                className="mt-2"
                            >
                                {trend.positive ? '↑' : '↓'} {trend.value}
                            </Badge>
                        )}
                    </div>
                    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// AGING SUMMARY REPORT
// ═══════════════════════════════════════════════════════════════════════════

const AgingSummaryReport = ({ data }: { data: AgingSummaryData }) => {
    const bucketColors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
    const maxAmount = Math.max(...data.buckets.map(b => b.amount));

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    title="Total Outstanding"
                    value={formatARCurrency(data.total.amount)}
                    subValue={`${data.total.count} invoices`}
                    icon={DollarSign}
                    color="blue"
                />
                <SummaryCard
                    title="Overdue Amount"
                    value={formatARCurrency(data.buckets.filter(b => b.key !== 'current').reduce((sum, b) => sum + b.amount, 0))}
                    subValue={`${data.buckets.filter(b => b.key !== 'current').reduce((sum, b) => sum + b.count, 0)} overdue`}
                    icon={AlertTriangle}
                    color="red"
                />
                <SummaryCard
                    title="Current Amount"
                    value={formatARCurrency(data.buckets.find(b => b.key === 'current')?.amount || 0)}
                    subValue={`${data.buckets.find(b => b.key === 'current')?.count || 0} current`}
                    icon={CheckCircle}
                    color="green"
                />
            </div>

            {/* Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Aging Distribution
                    </CardTitle>
                    <CardDescription>Outstanding amounts by aging bucket</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-6 h-48 items-end">
                        {data.buckets.map((bucket, i) => (
                            <div key={bucket.key} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex-1 flex items-end">
                                    <div 
                                        className={`w-full ${bucketColors[i]} rounded-t transition-all duration-500`}
                                        style={{ height: `${(bucket.amount / maxAmount) * 100}%`, minHeight: '4px' }}
                                    />
                                </div>
                                <div className="mt-3 text-center">
                                    <p className="text-xs text-muted-foreground">{bucket.label}</p>
                                    <p className="text-sm font-semibold">{formatARCurrency(bucket.amount)}</p>
                                    <p className="text-xs text-muted-foreground">{bucket.count} inv</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        Bucket Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Bucket</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Count</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Amount</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">% of Total</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.buckets.map((bucket, i) => (
                                    <tr key={bucket.key} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded ${bucketColors[i]}`} />
                                                {bucket.label}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">{bucket.count}</td>
                                        <td className="py-3 px-4 font-medium">{formatARCurrency(bucket.amount)}</td>
                                        <td className="py-3 px-4">{bucket.percentage}%</td>
                                        <td className="py-3 px-4">
                                            <div className="w-full bg-muted rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full ${bucketColors[i]}`}
                                                    style={{ width: `${bucket.percentage}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION TRENDS REPORT
// ═══════════════════════════════════════════════════════════════════════════

const CollectionTrendsReport = ({ data, dso }: { data: CollectionTrendsData; dso: DSOData | null }) => {
    const maxTrend = Math.max(...data.trends.map(t => t.amount));

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Collected"
                    value={formatARCurrency(data.summary.totalCollected)}
                    subValue={`${data.summary.totalPayments} payments`}
                    icon={DollarSign}
                    color="green"
                />
                <SummaryCard
                    title="Avg Monthly Collection"
                    value={formatARCurrency(data.summary.avgCollection)}
                    icon={TrendingUp}
                    color="blue"
                />
                <SummaryCard
                    title="Current DSO"
                    value={`${dso?.current.dso || 0} days`}
                    subValue={dso?.current.status}
                    icon={Clock}
                    color={dso?.current.status === 'GOOD' ? 'green' : dso?.current.status === 'AVERAGE' ? 'yellow' : 'red'}
                />
                <SummaryCard
                    title="Periods Covered"
                    value={data.summary.periods.toString()}
                    icon={BarChart3}
                    color="blue"
                />
            </div>

            {/* Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        Monthly Collection Trend
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 h-48 items-end">
                        {data.trends.map((trend, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex-1 flex items-end">
                                    <div 
                                        className="w-full bg-green-500 rounded-t transition-all duration-500"
                                        style={{ height: `${(trend.amount / maxTrend) * 100}%`, minHeight: '4px' }}
                                    />
                                </div>
                                <div className="mt-3 text-center">
                                    <p className="text-xs text-muted-foreground">{trend.period}</p>
                                    <p className="text-sm font-semibold">{formatARCurrency(trend.amount)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* DSO Table */}
            {dso && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            DSO Trend (Days Sales Outstanding)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Period</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Total Sales</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Receivables</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">DSO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dso.monthly.map((m, i) => (
                                        <tr key={i} className="border-b hover:bg-muted/50">
                                            <td className="py-3 px-4">{m.period}</td>
                                            <td className="py-3 px-4">{formatARCurrency(m.totalSales)}</td>
                                            <td className="py-3 px-4">{formatARCurrency(m.endingReceivables)}</td>
                                            <td className="py-3 px-4">
                                                <Badge variant={m.dso <= 30 ? "default" : m.dso <= 60 ? "secondary" : "destructive"}>
                                                    {m.dso} days
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOP CUSTOMERS REPORT
// ═══════════════════════════════════════════════════════════════════════════

const TopCustomersReport = ({ data, riskData }: { data: TopCustomersData; riskData: CustomerRiskData | null }) => {
    const riskColors: Record<string, string> = {
        LOW: 'bg-green-100 text-green-800',
        MEDIUM: 'bg-yellow-100 text-yellow-800',
        HIGH: 'bg-orange-100 text-orange-800',
        CRITICAL: 'bg-red-100 text-red-800',
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    title="Top 10 Concentration"
                    value={`${data.summary.concentration}%`}
                    subValue="of total outstanding"
                    icon={Users}
                    color="blue"
                />
                <SummaryCard
                    title="Top 10 Balance"
                    value={formatARCurrency(data.summary.topCustomersBalance)}
                    icon={DollarSign}
                    color="yellow"
                />
                <SummaryCard
                    title="High Risk Customers"
                    value={riskData?.summary.highRiskCount.toString() || '0'}
                    subValue={formatARCurrency(riskData?.summary.highRiskBalance || 0)}
                    icon={AlertTriangle}
                    color="red"
                />
            </div>

            {/* Risk Distribution */}
            {riskData && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-orange-600" />
                            Customer Risk Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {riskData.distribution.map((d) => (
                                <div key={d.riskClass} className="text-center p-4 rounded-lg bg-muted/50">
                                    <Badge className={riskColors[d.riskClass]}>{d.riskClass}</Badge>
                                    <p className="text-2xl font-bold mt-2">{d.count}</p>
                                    <p className="text-sm text-muted-foreground">customers</p>
                                    <p className="text-sm font-medium mt-1">{formatARCurrency(d.balance)}</p>
                                    <p className="text-xs text-muted-foreground">{d.percentage}% of total</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Top Customers Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        Top Outstanding Customers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">#</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Code</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Invoices</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Balance</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Risk</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.customers.map((c) => (
                                    <tr key={c.bpCode} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4 font-bold text-red-600">{c.rank}</td>
                                        <td className="py-3 px-4 font-medium">{c.customerName}</td>
                                        <td className="py-3 px-4 text-muted-foreground">{c.bpCode}</td>
                                        <td className="py-3 px-4">{c.invoiceCount}</td>
                                        <td className="py-3 px-4 font-semibold text-green-600">{formatARCurrency(c.totalBalance)}</td>
                                        <td className="py-3 px-4">
                                            <Badge className={riskColors[c.riskClass]}>{c.riskClass}</Badge>
                                        </td>
                                        <td className="py-3 px-4">{c.percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE STATUS REPORT
// ═══════════════════════════════════════════════════════════════════════════

const InvoiceStatusReport = ({ data }: { data: InvoiceStatusData }) => {
    const statusColors: Record<string, string> = {
        PENDING: 'bg-gray-500',
        PARTIAL: 'bg-blue-500',
        PAID: 'bg-green-500',
        OVERDUE: 'bg-red-500',
        CANCELLED: 'bg-gray-400',
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Invoices"
                    value={data.summary.totalInvoices.toString()}
                    subValue={formatARCurrency(data.summary.totalAmount)}
                    icon={FileText}
                    color="blue"
                />
                <SummaryCard
                    title="Collection Rate"
                    value={`${data.summary.collectionRate}%`}
                    icon={CheckCircle}
                    color="green"
                />
                <SummaryCard
                    title="Collected"
                    value={formatARCurrency(data.summary.paidAmount)}
                    icon={DollarSign}
                    color="green"
                />
                <SummaryCard
                    title="Pending"
                    value={formatARCurrency(data.summary.pendingAmount)}
                    icon={Clock}
                    color="yellow"
                />
            </div>

            {/* Status Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-blue-600" />
                        Invoice Status Distribution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Count</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Amount</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Balance</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">% of Total</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Distribution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.statuses.filter(s => s.count > 0).map((s) => (
                                    <tr key={s.status} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4">
                                            <Badge className={`${statusColors[s.status]} text-white`}>{s.status}</Badge>
                                        </td>
                                        <td className="py-3 px-4">{s.count}</td>
                                        <td className="py-3 px-4 font-medium">{formatARCurrency(s.totalAmount)}</td>
                                        <td className="py-3 px-4">{formatARCurrency(s.balance)}</td>
                                        <td className="py-3 px-4">{s.countPercentage}%</td>
                                        <td className="py-3 px-4">
                                            <div className="w-full bg-muted rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full ${statusColors[s.status]}`}
                                                    style={{ width: `${s.countPercentage}%` }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ARReportsPage() {
    const [filters, setFilters] = useState<ReportFilters>({
        reportType: 'aging-summary',
        fromDate: subDays(new Date(), 30),
        toDate: new Date(),
    });
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);

    const handleFilterChange = (newFilters: Partial<ReportFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    };

    const generateReport = useCallback(async () => {
        setLoading(true);
        setReportData(null);

        try {
            let data: any = {};

            switch (filters.reportType) {
                case 'aging-summary':
                    data.agingSummary = await arApi.getAgingSummary();
                    break;
                case 'aging-detailed':
                    data.agingDetailed = await arApi.getDetailedAgingReport({
                        fromDate: format(filters.fromDate, 'yyyy-MM-dd'),
                        toDate: format(filters.toDate, 'yyyy-MM-dd'),
                        status: filters.status,
                        riskClass: filters.riskClass,
                    });
                    break;
                case 'collection-trends':
                    const [trends, dso] = await Promise.all([
                        arApi.getCollectionTrends({ months: 6 }),
                        arApi.getDSOReport({ months: 6 })
                    ]);
                    data.collectionTrends = trends;
                    data.dso = dso;
                    break;
                case 'dso-report':
                    data.dso = await arApi.getDSOReport({ months: 12 });
                    data.collectionTrends = await arApi.getCollectionTrends({ months: 12 });
                    break;
                case 'top-customers':
                    const [customers, risk] = await Promise.all([
                        arApi.getTopOutstandingCustomers(10),
                        arApi.getCustomerRiskReport()
                    ]);
                    data.topCustomers = customers;
                    data.customerRisk = risk;
                    break;
                case 'customer-risk':
                    data.customerRisk = await arApi.getCustomerRiskReport();
                    data.topCustomers = await arApi.getTopOutstandingCustomers(10);
                    break;
                case 'invoice-status':
                    data.invoiceStatus = await arApi.getInvoiceStatusSummary({
                        fromDate: format(filters.fromDate, 'yyyy-MM-dd'),
                        toDate: format(filters.toDate, 'yyyy-MM-dd'),
                    });
                    break;
            }

            setReportData(data);
        } catch (error) {
            console.error('Failed to generate report:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Auto-generate on mount
    useEffect(() => {
        generateReport();
    }, []);

    const renderReport = () => {
        if (loading) {
            return (
                <Card className="p-16">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
                        <p className="text-muted-foreground">Generating report...</p>
                    </div>
                </Card>
            );
        }

        if (!reportData) {
            return (
                <Card className="p-16">
                    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <BarChart3 className="w-12 h-12" />
                        <p>Select filters and click Generate Report</p>
                    </div>
                </Card>
            );
        }

        switch (filters.reportType) {
            case 'aging-summary':
            case 'aging-detailed':
                return reportData.agingSummary ? (
                    <AgingSummaryReport data={reportData.agingSummary} />
                ) : null;
            case 'collection-trends':
            case 'dso-report':
                return reportData.collectionTrends ? (
                    <CollectionTrendsReport data={reportData.collectionTrends} dso={reportData.dso} />
                ) : null;
            case 'top-customers':
            case 'customer-risk':
                return reportData.topCustomers ? (
                    <TopCustomersReport data={reportData.topCustomers} riskData={reportData.customerRisk} />
                ) : null;
            case 'invoice-status':
                return reportData.invoiceStatus ? (
                    <InvoiceStatusReport data={reportData.invoiceStatus} />
                ) : null;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#96AEC2]/10 to-[#A2B9AF]/10 p-2 sm:p-3 lg:p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <BarChart3 className="w-7 h-7 text-red-500" />
                        AR Reports
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Comprehensive accounts receivable analytics and insights
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Report Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <ARReportFilters
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onGenerate={generateReport}
                        loading={loading}
                    />
                </CardContent>
            </Card>

            {/* Report Content */}
            {renderReport()}
        </div>
    );
}
