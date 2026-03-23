'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { arApi, ARActivity, ARActivityStats, ARActivityFilters } from '@/lib/ar-api';

// Kardex Brand Colors:
// Primary: #6F8A9D (slate-blue), #546A7A (dark slate), #96AEC2 (light blue), #AEBFC3 (pale blue)
// Accent Green: #82A094, #4F6A64
// Accent Orange/Coral: #E17F70, #CE9F6B
// Error/Red: #9E3B47
// Neutral: #5D6E73, #92A2A5

// Action color and icon mapping with Kardex brand colors
const actionConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: string; label: string }> = {
    LOGIN: { color: 'text-[#6F8A9D]', bgColor: 'bg-[#96AEC2]/10', borderColor: 'border-[#96AEC2]/30', icon: '🔐', label: 'Login' },
    LOGOUT: { color: 'text-[#5D6E73]', bgColor: 'bg-[#AEBFC3]/15', borderColor: 'border-[#AEBFC3]/30', icon: '🔓', label: 'Logout' },
    LOGIN_FAILED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '⚠️', label: 'Failed Login' },
    INVOICE_CREATED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/10', borderColor: 'border-[#82A094]/30', icon: '📄', label: 'Invoice Created' },
    INVOICE_UPDATED: { color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/10', borderColor: 'border-[#6F8A9D]/30', icon: '✏️', label: 'Invoice Updated' },
    INVOICE_DELETED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🗑️', label: 'Invoice Deleted' },
    PAYMENT_RECORDED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/15', borderColor: 'border-[#82A094]/30', icon: '💰', label: 'Payment Recorded' },
    PAYMENT_UPDATED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/15', borderColor: 'border-[#82A094]/30', icon: '📝', label: 'Payment Updated' },
    PAYMENT_DELETED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🗑️', label: 'Payment Deleted' },
    STATUS_CHANGED: { color: 'text-[#CE9F6B]', bgColor: 'bg-[#CE9F6B]/10', borderColor: 'border-[#CE9F6B]/30', icon: '🔄', label: 'Status Changed' },
    DELIVERY_UPDATED: { color: 'text-[#E17F70]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🚚', label: 'Delivery Updated' },
    REMARK_ADDED: { color: 'text-[#6F8A9D]', bgColor: 'bg-[#96AEC2]/10', borderColor: 'border-[#96AEC2]/30', icon: '💬', label: 'Remark Added' },
    REMARK_UPDATED: { color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/10', borderColor: 'border-[#6F8A9D]/30', icon: '📝', label: 'Remark Updated' },
    REMARK_DELETED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🗑️', label: 'Remark Deleted' },
    INVOICE_IMPORTED: { color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/15', borderColor: 'border-[#6F8A9D]/30', icon: '📥', label: 'Invoice Imported' },
    MILESTONE_LINKED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/10', borderColor: 'border-[#82A094]/30', icon: '🔗', label: 'Milestone Linked' },
    LINKED_TO_INVOICE: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/10', borderColor: 'border-[#82A094]/30', icon: '🔗', label: 'Linked to Invoice' },
};

const getActionConfig = (action: string) => {
    return actionConfig[action] || { color: 'text-[#5D6E73]', bgColor: 'bg-[#AEBFC3]/10', borderColor: 'border-[#AEBFC3]/30', icon: '📋', label: action };
};

// Format date for display
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
};

const formatShortDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' • ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// Group activities by date
const groupByDate = (activities: ARActivity[]) => {
    const groups: Record<string, ARActivity[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    activities.forEach(activity => {
        const actDate = new Date(activity.createdAt);
        actDate.setHours(0, 0, 0, 0);

        let key: string;
        if (actDate.getTime() === today.getTime()) {
            key = 'Today';
        } else if (actDate.getTime() === yesterday.getTime()) {
            key = 'Yesterday';
        } else {
            key = formatDate(activity.createdAt);
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(activity);
    });

    return groups;
};

export default function ActivitiesPage() {
    const [activities, setActivities] = useState<ARActivity[]>([]);
    const [stats, setStats] = useState<ARActivityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

    // Filters
    const [filters, setFilters] = useState<ARActivityFilters>({
        activityType: 'ALL',
        page: 1,
        limit: 100
    });
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Load activities
    const loadActivities = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params: ARActivityFilters = {
                ...filters,
                ...(fromDate && { fromDate }),
                ...(toDate && { toDate }),
                ...(actionFilter && { action: actionFilter }),
                ...(searchQuery && { search: searchQuery })
            };

            const [activitiesRes, statsRes] = await Promise.all([
                arApi.getAllActivities(params),
                arApi.getActivityStats()
            ]);

            setActivities(activitiesRes.data);
            setPagination(activitiesRes.pagination);
            setStats(statsRes);
        } catch (err: any) {
            setError(err.message || 'Failed to load activities');
            console.error('Error loading activities:', err);
        } finally {
            setLoading(false);
        }
    }, [filters, fromDate, toDate, actionFilter, searchQuery]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    // Handle filter changes
    const handleActivityTypeChange = (type: 'ALL' | 'INVOICE' | 'SESSION') => {
        setFilters(prev => ({ ...prev, activityType: type, page: 1 }));
    };

    const handleSearch = () => {
        setFilters(prev => ({ ...prev, page: 1 }));
    };

    const handleClearFilters = () => {
        setFromDate('');
        setToDate('');
        setActionFilter('');
        setSearchQuery('');
        setFilters({ activityType: 'ALL', page: 1, limit: 50 });
    };

    const groupedActivities = groupByDate(activities);

    return (
        <div className="min-h-screen bg-white p-6">
            {/* Decorative Background Elements - Kardex Colors */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#96AEC2]/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-[#82A094]/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#6F8A9D]/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-2xl shadow-lg shadow-[#6F8A9D]/30">
                            📊
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-[#546A7A] tracking-tight">
                                Activity Center
                            </h1>
                            <p className="text-[#92A2A5] mt-0.5">Track all invoice and session activities in real-time</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Today Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#96AEC2] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#6F8A9D]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#96AEC2]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Today</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.today}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6F8A9D]/10 text-[#6F8A9D] text-xs font-medium">
                                            📄 {stats.todayBreakdown.invoice}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#82A094]/10 text-[#4F6A64] text-xs font-medium">
                                            🔐 {stats.todayBreakdown.session}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] flex items-center justify-center text-2xl shadow-lg shadow-[#6F8A9D]/30 group-hover:scale-110 transition-transform">
                                    📅
                                </div>
                            </div>
                        </div>

                        {/* This Week Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#82A094] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#82A094]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">This Week</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.thisWeek}</p>
                                    <div className="mt-2 h-1.5 w-24 bg-[#AEBFC3]/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-[#82A094] to-[#4F6A64] rounded-full" style={{ width: `${Math.min(100, (stats.thisWeek / 100) * 100)}%` }}></div>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center text-2xl shadow-lg shadow-[#82A094]/30 group-hover:scale-110 transition-transform">
                                    📆
                                </div>
                            </div>
                        </div>

                        {/* This Month Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#CE9F6B] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#CE9F6B]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#CE9F6B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">This Month</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.thisMonth}</p>
                                    <div className="mt-2 h-1.5 w-24 bg-[#AEBFC3]/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-[#CE9F6B] to-[#E17F70] rounded-full" style={{ width: `${Math.min(100, (stats.thisMonth / 500) * 100)}%` }}></div>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#E17F70] flex items-center justify-center text-2xl shadow-lg shadow-[#CE9F6B]/30 group-hover:scale-110 transition-transform">
                                    🗓️
                                </div>
                            </div>
                        </div>

                        {/* Total Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#6F8A9D] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#6F8A9D]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Total</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.total.toLocaleString()}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6F8A9D]/10 text-[#6F8A9D] text-xs font-medium">
                                            📄 {stats.byType.invoice}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#82A094]/10 text-[#4F6A64] text-xs font-medium">
                                            🔐 {stats.byType.session}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-2xl shadow-lg shadow-[#6F8A9D]/30 group-hover:scale-110 transition-transform">
                                    📊
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 mb-6 shadow-sm">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Activity Type Toggle */}
                        <div>
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">Activity Type</label>
                            <div className="flex rounded-xl bg-[#AEBFC3]/15 p-1 gap-1">
                                {(['ALL', 'INVOICE', 'SESSION'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => handleActivityTypeChange(type)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                            filters.activityType === type
                                                ? 'bg-gradient-to-r from-[#6F8A9D] to-[#82A094] text-white shadow-lg shadow-[#6F8A9D]/25'
                                                : 'text-[#5D6E73] hover:text-[#546A7A] hover:bg-[#AEBFC3]/20'
                                        }`}
                                    >
                                        {type === 'ALL' ? '🌐 All' : type === 'INVOICE' ? '📄 Invoice' : '🔐 Session'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">From Date</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] placeholder-[#92A2A5] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">To Date</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] placeholder-[#92A2A5] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] transition-all"
                            />
                        </div>

                        {/* Action Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">Action</label>
                            <select
                                value={actionFilter}
                                onChange={e => setActionFilter(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] transition-all min-w-[160px]"
                            >
                                <option value="">All Actions</option>
                                <optgroup label="Session">
                                    <option value="LOGIN">Login</option>
                                    <option value="LOGOUT">Logout</option>
                                </optgroup>
                                <optgroup label="Invoice">
                                    <option value="INVOICE_CREATED">Invoice Created</option>
                                    <option value="INVOICE_UPDATED">Invoice Updated</option>
                                    <option value="INVOICE_DELETED">Invoice Deleted</option>
                                    <option value="PAYMENT_RECORDED">Payment Recorded</option>
                                    <option value="PAYMENT_UPDATED">Payment Updated</option>
                                    <option value="PAYMENT_DELETED">Payment Deleted</option>
                                    <option value="REMARK_ADDED">Remark Added</option>
                                    <option value="REMARK_UPDATED">Remark Updated</option>
                                    <option value="REMARK_DELETED">Remark Deleted</option>
                                    <option value="MILESTONE_LINKED">Milestone Linked</option>
                                </optgroup>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="flex-1 min-w-[250px]">
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">Search</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    placeholder="Search by user, description..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] placeholder-[#92A2A5] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] transition-all"
                                />
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92A2A5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Buttons */}
                        <button
                            onClick={handleSearch}
                            className="px-6 py-2.5 bg-gradient-to-r from-[#6F8A9D] to-[#82A094] text-white rounded-xl text-sm font-semibold hover:from-[#546A7A] hover:to-[#4F6A64] transition-all shadow-lg shadow-[#6F8A9D]/25 hover:shadow-[#6F8A9D]/40"
                        >
                            Apply Filters
                        </button>
                        <button
                            onClick={handleClearFilters}
                            className="px-6 py-2.5 bg-[#AEBFC3]/15 text-[#5D6E73] rounded-xl text-sm font-semibold hover:bg-[#AEBFC3]/25 transition-all border border-[#AEBFC3]/30"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Activity Timeline */}
                <div className="rounded-2xl bg-white border border-[#AEBFC3]/30 overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="relative w-16 h-16 mx-auto mb-4">
                                <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-[#6F8A9D] border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-[#92A2A5] text-lg">Loading activities...</p>
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#E17F70]/10 flex items-center justify-center text-4xl">
                                ⚠️
                            </div>
                            <p className="text-[#9E3B47] text-lg mb-4">{error}</p>
                            <button
                                onClick={loadActivities}
                                className="px-6 py-2.5 bg-gradient-to-r from-[#6F8A9D] to-[#82A094] text-white rounded-xl text-sm font-semibold hover:from-[#546A7A] hover:to-[#4F6A64] transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#AEBFC3]/15 flex items-center justify-center text-4xl">
                                📭
                            </div>
                            <p className="text-[#5D6E73] text-lg">No activities found</p>
                            <p className="text-[#92A2A5] text-sm mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <div>
                            {Object.entries(groupedActivities).map(([date, items], groupIndex) => (
                                <div key={date}>
                                    {/* Date Header */}
                                    <div className="sticky top-0 z-10 bg-gradient-to-r from-[#AEBFC3]/10 to-[#96AEC2]/10 backdrop-blur-sm px-5 py-3 border-b border-[#AEBFC3]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6F8A9D] to-[#82A094] flex items-center justify-center text-sm shadow-lg">
                                                📅
                                            </div>
                                            <span className="text-base font-semibold text-[#546A7A]">{date}</span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-[#AEBFC3]/20 text-[#5D6E73] text-xs font-medium">
                                                {items.length} {items.length === 1 ? 'activity' : 'activities'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Activities */}
                                    <div className="divide-y divide-[#AEBFC3]/20">
                                        {items.map((activity, index) => {
                                            const config = getActionConfig(activity.action);
                                            return (
                                                <div
                                                    key={activity.id}
                                                    className="group px-5 py-4 hover:bg-[#96AEC2]/5 transition-all duration-200"
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        {/* Timeline Connector */}
                                                        <div className="relative flex flex-col items-center">
                                                            <div className={`w-12 h-12 rounded-xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center text-xl shadow-md group-hover:scale-110 transition-transform`}>
                                                                {config.icon}
                                                            </div>
                                                            {index < items.length - 1 && (
                                                                <div className="absolute top-14 w-0.5 h-full bg-gradient-to-b from-[#AEBFC3] to-transparent"></div>
                                                            )}
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    {/* Action + Links Row */}
                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                        <span className={`text-sm font-semibold ${config.color}`}>
                                                                            {config.label}
                                                                        </span>
                                                                        {activity.type === 'INVOICE' && activity.invoiceNumber && (
                                                                            activity.invoiceNumber !== 'Deleted Invoice' && activity.invoiceId ? (
                                                                                <Link
                                                                                    href={`/finance/ar/${activity.invoiceType === 'MILESTONE' ? 'milestones' : 'invoices'}/${activity.invoiceId}`}
                                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white text-xs font-semibold shadow-lg shadow-[#6F8A9D]/20 hover:shadow-[#6F8A9D]/40 hover:-translate-y-0.5 transition-all duration-200"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                    </svg>
                                                                                    View
                                                                                    <span className="bg-white/20 px-1.5 py-0.5 rounded ml-0.5">{activity.invoiceNumber}</span>
                                                                                </Link>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#E17F70]/10 text-[#9E3B47] text-xs font-medium border border-[#E17F70]/30">
                                                                                    <span>📄</span>
                                                                                    {activity.invoiceNumber}
                                                                                </span>
                                                                            )
                                                                        )}
                                                                        {activity.customerName && (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#AEBFC3]/15 text-[#5D6E73] text-xs font-medium">
                                                                                <span>👤</span>
                                                                                {activity.customerName}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Description */}
                                                                    <p className="text-sm text-[#5D6E73] leading-relaxed">
                                                                        {activity.description}
                                                                    </p>

                                                                    {/* Old/New values */}
                                                                    {activity.oldValue && activity.newValue && (
                                                                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#AEBFC3]/10 border border-[#AEBFC3]/20 text-sm">
                                                                            <span className="text-[#9E3B47] line-through font-mono">{activity.oldValue}</span>
                                                                            <span className="text-[#92A2A5]">→</span>
                                                                            <span className="text-[#4F6A64] font-mono">{activity.newValue}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Meta Info */}
                                                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                                        <span className="inline-flex items-center gap-1.5 text-xs text-[#92A2A5]">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            {formatShortDateTime(activity.createdAt)}
                                                                        </span>
                                                                        {activity.performedBy && (
                                                                            <span className="inline-flex items-center gap-1.5 text-xs text-[#92A2A5]">
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                </svg>
                                                                                {activity.performedBy}
                                                                            </span>
                                                                        )}
                                                                        {activity.ipAddress && (
                                                                            <span className="inline-flex items-center gap-1.5 text-xs text-[#AEBFC3]">
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                                                </svg>
                                                                                {activity.ipAddress}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Type Badge */}
                                                                <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                                                                    activity.type === 'SESSION'
                                                                        ? 'bg-[#82A094]/10 text-[#4F6A64] border border-[#82A094]/30'
                                                                        : activity.invoiceType === 'MILESTONE'
                                                                            ? 'bg-[#82A094]/10 text-[#4F6A64] border border-[#82A094]/30'
                                                                            : 'bg-[#6F8A9D]/10 text-[#546A7A] border border-[#6F8A9D]/30'
                                                                }`}>
                                                                    {activity.type === 'SESSION' ? '🔐 Session' : activity.invoiceType === 'MILESTONE' ? '📄 Milestone' : '📄 Invoice'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && activities.length > 0 && (
                        <div className="px-5 py-4 bg-[#AEBFC3]/10 border-t border-[#AEBFC3]/30 flex items-center justify-between">
                            <span className="text-sm text-[#92A2A5]">
                                Showing <span className="font-semibold text-[#546A7A]">{activities.length}</span> of <span className="font-semibold text-[#546A7A]">{pagination.total}</span> activities
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))}
                                    disabled={filters.page === 1}
                                    className="px-4 py-2 text-sm font-medium bg-white text-[#5D6E73] rounded-xl hover:bg-[#96AEC2]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#AEBFC3]/30"
                                >
                                    ← Previous
                                </button>
                                <span className="px-4 py-2 text-sm font-medium text-[#92A2A5]">
                                    Page <span className="text-[#546A7A]">{pagination.page}</span> of <span className="text-[#546A7A]">{pagination.totalPages}</span>
                                </span>
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                                    disabled={filters.page === pagination.totalPages}
                                    className="px-4 py-2 text-sm font-medium bg-white text-[#5D6E73] rounded-xl hover:bg-[#96AEC2]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#AEBFC3]/30"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
