'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { arApi, BankAccountActivityLog } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { ArrowLeft, Activity, Clock, User, Globe, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert, Lock } from 'lucide-react';

// Kardex Brand Colors
// Primary: #6F8A9D, #546A7A, #96AEC2, #AEBFC3
// Accent Green: #82A094, #4F6A64
// Accent Orange/Coral: #E17F70, #CE9F6B
// Error/Red: #9E3B47
// Neutral: #5D6E73, #92A2A5

// Action color and icon mapping
const actionConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: string; label: string }> = {
    BANK_ACCOUNT_CREATED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/10', borderColor: 'border-[#82A094]/30', icon: '🏦', label: 'Account Created' },
    BANK_ACCOUNT_UPDATED: { color: 'text-[#546A7A]', bgColor: 'bg-[#6F8A9D]/10', borderColor: 'border-[#6F8A9D]/30', icon: '✏️', label: 'Account Updated' },
    BANK_ACCOUNT_DEACTIVATED: { color: 'text-[#CE9F6B]', bgColor: 'bg-[#CE9F6B]/10', borderColor: 'border-[#CE9F6B]/30', icon: '⏸️', label: 'Account Deactivated' },
    BANK_ACCOUNT_DELETED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🗑️', label: 'Account Deleted' },
    CHANGE_REQUEST_CREATED: { color: 'text-[#6F8A9D]', bgColor: 'bg-[#96AEC2]/10', borderColor: 'border-[#96AEC2]/30', icon: '📝', label: 'Change Request Created' },
    CHANGE_REQUEST_APPROVED: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/15', borderColor: 'border-[#82A094]/30', icon: '✅', label: 'Request Approved' },
    CHANGE_REQUEST_REJECTED: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '❌', label: 'Request Rejected' },
    USER_LOGIN: { color: 'text-[#4F6A64]', bgColor: 'bg-[#82A094]/10', borderColor: 'border-[#82A094]/30', icon: '🔑', label: 'User Login' },
    USER_LOGOUT: { color: 'text-[#9E3B47]', bgColor: 'bg-[#E17F70]/10', borderColor: 'border-[#E17F70]/30', icon: '🚪', label: 'User Logout' },
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

const formatShortDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' • ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

// Group activities by date
const groupByDate = (activities: BankAccountActivityLog[]) => {
    const groups: Record<string, BankAccountActivityLog[]> = {};
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

interface ActivityStats {
    total: number;
    byAction: Record<string, number>;
}

export default function BankAccountActivitiesPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [activities, setActivities] = useState<BankAccountActivityLog[]>([]);
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    // Filters
    const [actionFilter, setActionFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

    // Load activities
    const loadActivities = useCallback(async () => {
        if (!isAdmin) return;
        
        try {
            setLoading(true);
            setError(null);

            const [activitiesRes, statsRes] = await Promise.all([
                arApi.getRecentBankAccountActivities(200),
                arApi.getBankAccountActivityStats()
            ]);

            let filteredActivities = activitiesRes || [];

            // Apply filters
            if (actionFilter) {
                filteredActivities = filteredActivities.filter(a => a.action === actionFilter);
            }
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filteredActivities = filteredActivities.filter(a =>
                    a.description?.toLowerCase().includes(query) ||
                    a.performedBy?.toLowerCase().includes(query)
                );
            }

            setTotalCount(filteredActivities.length);
            const startIdx = (page - 1) * limit;
            setActivities(filteredActivities.slice(startIdx, startIdx + limit));
            setStats(statsRes);
        } catch (err: any) {
            setError(err.message || 'Failed to load activities');
            console.error('Error loading activities:', err);
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, searchQuery, isAdmin]);

    useEffect(() => {
        if (isAdmin) {
            loadActivities();
        }
    }, [loadActivities, isAdmin]);

    const handleClearFilters = () => {
        setActionFilter('');
        setSearchQuery('');
        setPage(1);
    };

    const groupedActivities = groupByDate(activities);
    const totalPages = Math.ceil(totalCount / limit);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-[#CE9F6B] border-t-transparent animate-spin"></div>
                </div>
                <p className="text-[#92A2A5] font-medium animate-pulse">Verifying access...</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-white p-6 flex items-center justify-center relative overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#96AEC2]/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#E17F70]/10 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 max-w-md w-full bg-white rounded-3xl border border-[#AEBFC3]/30 p-8 shadow-2xl text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] flex items-center justify-center shadow-lg shadow-[#E17F70]/30">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-[#546A7A] mb-3">Access Restricted</h2>
                    <p className="text-[#92A2A5] mb-8 leading-relaxed">
                        This administrative section is only available to <strong>Finance Admins</strong>. 
                        Your current role does not have permission to view activity logs.
                    </p>

                    <div className="space-y-3">
                        <Link
                            href="/finance/bank-accounts"
                            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-[#CE9F6B]/30 hover:scale-[1.02] transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Module
                        </Link>
                        
                        <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-[#AEBFC3] font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Security Protocol Active
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white p-6">
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#96AEC2]/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-[#82A094]/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-[#CE9F6B]/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <Link
                            href="/finance/bank-accounts"
                            className="p-3 rounded-xl bg-white border border-[#AEBFC3]/30 text-[#5D6E73] hover:text-[#CE9F6B] hover:border-[#CE9F6B]/30 hover:shadow-lg transition-all duration-300"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg shadow-[#CE9F6B]/30">
                            <Activity className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-[#546A7A] tracking-tight">
                                Vendor Bank Account Activity Center
                            </h1>
                            <p className="text-[#92A2A5] mt-0.5">Track all vendor bank account activities and changes</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Total Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#CE9F6B] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#CE9F6B]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#CE9F6B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Total Activities</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.total}</p>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center text-2xl shadow-lg shadow-[#CE9F6B]/30 group-hover:scale-110 transition-transform">
                                    📊
                                </div>
                            </div>
                        </div>

                        {/* Created Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#82A094] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#82A094]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#82A094]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Accounts Created</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.byAction?.BANK_ACCOUNT_CREATED || 0}</p>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center text-2xl shadow-lg shadow-[#82A094]/30 group-hover:scale-110 transition-transform">
                                    🏦
                                </div>
                            </div>
                        </div>

                        {/* Updated Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#6F8A9D] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#6F8A9D]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Accounts Updated</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">{stats.byAction?.BANK_ACCOUNT_UPDATED || 0}</p>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] flex items-center justify-center text-2xl shadow-lg shadow-[#6F8A9D]/30 group-hover:scale-110 transition-transform">
                                    ✏️
                                </div>
                            </div>
                        </div>

                        {/* Change Requests Card */}
                        <div className="group relative overflow-hidden rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 hover:border-[#96AEC2] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-[#96AEC2]/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#96AEC2]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[#92A2A5] uppercase tracking-wider">Change Requests</p>
                                    <p className="text-4xl font-bold text-[#546A7A] mt-1">
                                        {(stats.byAction?.CHANGE_REQUEST_CREATED || 0) + (stats.byAction?.CHANGE_REQUEST_APPROVED || 0) + (stats.byAction?.CHANGE_REQUEST_REJECTED || 0)}
                                    </p>
                                </div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#96AEC2] to-[#6F8A9D] flex items-center justify-center text-2xl shadow-lg shadow-[#96AEC2]/30 group-hover:scale-110 transition-transform">
                                    📝
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="rounded-2xl bg-white border border-[#AEBFC3]/30 p-5 mb-6 shadow-sm">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Action Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">
                                <Filter className="w-4 h-4 inline mr-1" />
                                Action Type
                            </label>
                            <select
                                value={actionFilter}
                                onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                                className="px-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] focus:ring-2 focus:ring-[#CE9F6B] focus:border-[#CE9F6B] transition-all min-w-[200px]"
                            >
                                <option value="">All Actions</option>
                                <optgroup label="Account Operations">
                                    <option value="BANK_ACCOUNT_CREATED">Account Created</option>
                                    <option value="BANK_ACCOUNT_UPDATED">Account Updated</option>
                                    <option value="BANK_ACCOUNT_DEACTIVATED">Account Deactivated</option>
                                    <option value="BANK_ACCOUNT_DELETED">Account Deleted</option>
                                </optgroup>
                                <optgroup label="Change Requests">
                                    <option value="CHANGE_REQUEST_CREATED">Request Created</option>
                                    <option value="CHANGE_REQUEST_APPROVED">Request Approved</option>
                                    <option value="CHANGE_REQUEST_REJECTED">Request Rejected</option>
                                </optgroup>
                                <optgroup label="System Events">
                                    <option value="USER_LOGIN">User Login</option>
                                    <option value="USER_LOGOUT">User Logout</option>
                                </optgroup>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="flex-1 min-w-[250px]">
                            <label className="block text-sm font-medium text-[#546A7A] mb-2">
                                <Search className="w-4 h-4 inline mr-1" />
                                Search
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                    placeholder="Search by description or user..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#AEBFC3]/50 rounded-xl text-sm text-[#546A7A] placeholder-[#92A2A5] focus:ring-2 focus:ring-[#CE9F6B] focus:border-[#CE9F6B] transition-all"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92A2A5]" />
                            </div>
                        </div>

                        {/* Buttons */}
                        <button
                            onClick={loadActivities}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl text-sm font-semibold hover:from-[#976E44] hover:to-[#7A5A36] transition-all shadow-lg shadow-[#CE9F6B]/25"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
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
                                <div className="absolute inset-0 rounded-full border-4 border-[#CE9F6B] border-t-transparent animate-spin"></div>
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
                                className="px-6 py-2.5 bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white rounded-xl text-sm font-semibold hover:from-[#976E44] hover:to-[#7A5A36] transition-all"
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
                            <p className="text-[#92A2A5] text-sm mt-1">Try adjusting your filters or check back later</p>
                        </div>
                    ) : (
                        <div>
                            {Object.entries(groupedActivities).map(([date, items]) => (
                                <div key={date}>
                                    {/* Date Header */}
                                    <div className="sticky top-0 z-10 bg-gradient-to-r from-[#CE9F6B]/10 to-[#96AEC2]/10 backdrop-blur-sm px-5 py-3 border-b border-[#AEBFC3]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center text-sm shadow-lg">
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
                                                    className="group px-5 py-4 hover:bg-[#CE9F6B]/5 transition-all duration-200"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        {/* Icon */}
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
                                                                    {/* Action Label */}
                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                        <span className={`text-sm font-semibold ${config.color}`}>
                                                                            {config.label}
                                                                        </span>
                                                                    </div>

                                                                    {/* Description */}
                                                                    <p className="text-sm text-[#5D6E73] leading-relaxed">
                                                                        {activity.description}
                                                                    </p>

                                                                    {/* Field Change */}
                                                                    {activity.fieldName && activity.oldValue && activity.newValue && (
                                                                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#AEBFC3]/10 border border-[#AEBFC3]/20 text-sm">
                                                                            <span className="text-[#5D6E73] font-medium">{activity.fieldName}:</span>
                                                                            <span className="text-[#9E3B47] line-through font-mono">{activity.oldValue}</span>
                                                                            <span className="text-[#92A2A5]">→</span>
                                                                            <span className="text-[#4F6A64] font-mono">{activity.newValue}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Meta Info */}
                                                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                                        <span className="inline-flex items-center gap-1.5 text-xs text-[#92A2A5]">
                                                                            <Clock className="w-3.5 h-3.5" />
                                                                            {formatShortDateTime(activity.createdAt)}
                                                                        </span>
                                                                        {activity.performedBy && (
                                                                            <span className="inline-flex items-center gap-1.5 text-xs text-[#92A2A5]">
                                                                                <User className="w-3.5 h-3.5" />
                                                                                {activity.performedBy}
                                                                            </span>
                                                                        )}
                                                                        {activity.ipAddress && (
                                                                            <span className="inline-flex items-center gap-1.5 text-xs text-[#AEBFC3]">
                                                                                <Globe className="w-3.5 h-3.5" />
                                                                                {activity.ipAddress}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Link to account */}
                                                                {activity.bankAccountId && (
                                                                    <Link
                                                                        href={`/finance/bank-accounts/${activity.bankAccountId}`}
                                                                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#CE9F6B]/10 text-[#976E44] border border-[#CE9F6B]/30 hover:bg-[#CE9F6B]/20 transition-all"
                                                                    >
                                                                        View Account →
                                                                    </Link>
                                                                )}
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
                                Showing <span className="font-semibold text-[#546A7A]">{activities.length}</span> of <span className="font-semibold text-[#546A7A]">{totalCount}</span> activities
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    disabled={page === 1}
                                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-white text-[#5D6E73] rounded-xl hover:bg-[#CE9F6B]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#AEBFC3]/30"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-sm font-medium text-[#92A2A5]">
                                    Page <span className="text-[#546A7A]">{page}</span> of <span className="text-[#546A7A]">{totalPages || 1}</span>
                                </span>
                                <button
                                    onClick={() => setPage(prev => prev + 1)}
                                    disabled={page >= totalPages}
                                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-white text-[#5D6E73] rounded-xl hover:bg-[#CE9F6B]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#AEBFC3]/30"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
