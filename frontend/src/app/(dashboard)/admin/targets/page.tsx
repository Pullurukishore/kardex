'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/user.types';
import { apiService } from '@/services/api';
import { 
  Plus, Target, TrendingUp, Users, Package, Building2, Pencil as Edit2, Eye, RefreshCw, 
  Filter, BarChart3, Calendar, ChevronDown, ChevronUp,
  Percent, Zap, Loader2, Trophy, Flame, Star, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@/types/reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ZoneTarget {
  id: number;
  serviceZoneId: number;
  targetPeriod: string;
  periodType: 'MONTHLY' | 'YEARLY';
  productType?: string;
  targetValue: number;
  targetOfferCount?: number;
  actualValue: number;
  actualOfferCount: number;
  achievement: number;
  serviceZone: {
    id: number;
    name: string;
  };
  targetCount?: number;
  isDerived?: boolean;
}

interface UserTarget {
  id: number;
  userId: number;
  targetPeriod: string;
  periodType: 'MONTHLY' | 'YEARLY';
  targetValue: number;
  targetOfferCount?: number;
  productType?: string;
  actualValue: number;
  actualOfferCount: number;
  achievement: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  targetCount?: number;
  isDerived?: boolean;
}

interface ProductTypeBreakdown {
  productType: string;
  targetValue: number;
  actualValue: number;
  achievement: number;
  count: number;
}

type TargetType = 'ZONE' | 'USER';

const PRODUCT_TYPE_COLORS: { [key: string]: string } = {
  'RELOCATION': 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]',
  'CONTRACT': 'bg-[#82A094]/20 text-[#4F6A64] border-[#A2B9AF]/40',
  'SPARE_PARTS': 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]',
  'KARDEX_CONNECT': 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]/40',
  'UPGRADE_KIT': 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]/40',
  'SOFTWARE': 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]/40',
  'OTHERS': 'bg-[#EEC1BF]/20 text-[#9E3B47] border-[#EEC1BF]/40',
  'BD_SPARE': 'bg-[#546A7A]/20 text-[#546A7A] border-[#546A7A]',
  'RETROFIT_KIT': 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]',
  'Overall': 'bg-[#AEBFC3]/20 text-[#5D6E73] border-[#92A2A5]',
};

export default function TargetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TargetType>(
    (searchParams.get('type') as TargetType) || 'ZONE'
  );
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'YEARLY'>(
    (searchParams.get('periodType') as 'MONTHLY' | 'YEARLY') || 'YEARLY'
  );
  const [targetPeriod, setTargetPeriod] = useState<string>(
    searchParams.get('period') || ''
  );
  const [loading, setLoading] = useState(false);
  const [showProductBreakdown, setShowProductBreakdown] = useState(false);

  const [zoneTargets, setZoneTargets] = useState<ZoneTarget[]>([]);
  const [userTargets, setUserTargets] = useState<UserTarget[]>([]);
  const [productTypeData, setProductTypeData] = useState<ProductTypeBreakdown[]>([]);

  // Protect this page - only ADMIN can access
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/auth/login?callbackUrl=' + encodeURIComponent('/admin/targets'))
        return
      }
      if (user?.role !== UserRole.ADMIN) {
        router.push('/admin/dashboard')
        return
      }
    }
  }, [authLoading, isAuthenticated, user?.role, router])

  // Initialize with current period
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    if (!targetPeriod) {
      const currentPeriod = periodType === 'MONTHLY' ? `${year}-${month}` : `${year}`;
      setTargetPeriod(currentPeriod);
    } else {
      if (periodType === 'MONTHLY') {
        if (targetPeriod.length === 4) {
          setTargetPeriod(`${targetPeriod}-${month}`);
        }
      } else {
        if (targetPeriod.includes('-')) {
          setTargetPeriod(targetPeriod.split('-')[0]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType]);

  // Fetch data
  useEffect(() => {
    if (!targetPeriod) return;
    
    if (periodType === 'YEARLY' && targetPeriod.length < 4) return;
    
    if (periodType === 'MONTHLY') {
      if (!targetPeriod.includes('-')) return;
      const parts = targetPeriod.split('-');
      if (parts.length !== 2 || parts[0].length !== 4 || parts[1].length !== 2) return;
    }
    
    const timeoutId = setTimeout(() => {
      fetchTargets();
    }, 300);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, targetPeriod, periodType]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const fetchTargetPeriod = periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod;
      
      const params = { 
        targetPeriod: fetchTargetPeriod, 
        periodType: 'YEARLY', 
        grouped: 'true',
        ...(periodType === 'MONTHLY' && { actualValuePeriod: targetPeriod })
      };
      
      if (activeTab === 'ZONE') {
        const response = await apiService.getZoneTargets(params);
        let targets = response.targets || [];
        
        if (periodType === 'MONTHLY') {
          targets = targets.map((t: ZoneTarget) => ({ ...t, isDerived: true }));
        }
        
        setZoneTargets(targets);
        calculateProductTypeBreakdown(targets);
      } else if (activeTab === 'USER') {
        const response = await apiService.getUserTargets(params);
        let targets = response.targets || [];
        
        if (periodType === 'MONTHLY') {
          targets = targets.map((t: UserTarget) => ({ ...t, isDerived: true }));
        }
        
        setUserTargets(targets);
        calculateProductTypeBreakdown(targets);
      }
    } catch (error: any) {
      console.error('Failed to fetch targets:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch targets');
    } finally {
      setLoading(false);
    }
  };

  const calculateProductTypeBreakdown = (targets: any[]) => {
    const breakdown: { [key: string]: ProductTypeBreakdown } = {};
    
    PRODUCT_TYPES.forEach(pt => {
      breakdown[pt] = { productType: pt, targetValue: 0, actualValue: 0, achievement: 0, count: 0 };
    });
    
    targets.forEach(target => {
      const pt = target.productType || 'Overall';
      if (!breakdown[pt]) {
        breakdown[pt] = { productType: pt, targetValue: 0, actualValue: 0, achievement: 0, count: 0 };
      }
      breakdown[pt].targetValue += target.targetValue || 0;
      breakdown[pt].actualValue += target.actualValue || 0;
      breakdown[pt].count += 1;
    });
    
    Object.values(breakdown).forEach(item => {
      item.achievement = item.targetValue > 0 ? (item.actualValue / item.targetValue) * 100 : 0;
    });
    
    setProductTypeData(Object.values(breakdown).filter(item => item.targetValue > 0 || item.actualValue > 0));
  };

  const getAchievementStyle = (achievement: number) => {
    if (achievement >= 100) return { bg: 'bg-gradient-to-r from-[#82A094] to-[#82A094]', text: 'text-white', icon: Trophy };
    if (achievement >= 75) return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-yellow-500', text: 'text-white', icon: Flame };
    if (achievement >= 50) return { bg: 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44]', text: 'text-white', icon: TrendingUp };
    return { bg: 'bg-gradient-to-r from-[#E17F70] to-[#9E3B47]', text: 'text-white', icon: ArrowDownRight };
  };

  const getAchievementBadge = (achievement: number) => {
    if (achievement >= 100) return 'bg-[#82A094]/20 text-[#4F6A64] border-[#A2B9AF]/40';
    if (achievement >= 75) return 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]/40';
    if (achievement >= 50) return 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]';
    return 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]';
  };

  // Summary calculations
  const currentTargets = activeTab === 'ZONE' ? zoneTargets : userTargets;
  const totalTargetValue = currentTargets.reduce((sum, t) => sum + t.targetValue, 0);
  const totalActualValue = currentTargets.reduce((sum, t) => sum + t.actualValue, 0);
  const overallAchievement = totalTargetValue > 0 ? (totalActualValue / totalTargetValue) * 100 : 0;
  const variance = totalActualValue - totalTargetValue;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[#96AEC2] rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-[#5D6E73] font-medium mt-4">Loading Target Management...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== UserRole.ADMIN) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/50">
      <div className="w-full p-2 sm:p-3 lg:p-4 space-y-6">
        
        {/* Premium Header with Inline Stats */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A] rounded-2xl shadow-2xl p-6 text-white">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#6F8A9D]/100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
          
          <div className="relative z-10">
            {/* Top row */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl ring-2 ring-white/30 shadow-xl">
                  <Target className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Target Management</h1>
                  <p className="text-[#96AEC2] mt-1">Track and manage {activeTab === 'ZONE' ? 'zone' : 'user'} performance targets</p>
                </div>
              </div>
              
              <Button 
                onClick={fetchTargets} 
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white border border-white/30 shadow-lg hover:shadow-xl transition-all px-6"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>

            {/* Stats Row */}
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  {activeTab === 'ZONE' ? <Building2 className="h-4 w-4 text-[#96AEC2]" /> : <Users className="h-4 w-4 text-[#96AEC2]" />}
                  <span className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">{activeTab === 'ZONE' ? 'Zones' : 'Users'}</span>
                </div>
                <p className="text-2xl font-bold">{currentTargets.length}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-amber-200" />
                  <span className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Target</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(totalTargetValue)}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-emerald-200" />
                  <span className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Actual</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(totalActualValue)}</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-3 border border-white/20 hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  {variance >= 0 ? <ArrowUpRight className="h-4 w-4 text-[#A2B9AF]" /> : <ArrowDownRight className="h-4 w-4 text-[#E17F70]" />}
                  <span className="text-[#96AEC2] text-xs font-medium uppercase tracking-wide">Variance</span>
                </div>
                <p className={`text-xl font-bold ${variance >= 0 ? 'text-[#A2B9AF]' : 'text-[#E17F70]'}`}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </p>
              </div>
              
              <div className={`rounded-xl px-4 py-3 border transition-colors ${
                overallAchievement >= 100 ? 'bg-[#82A094]/100/30 border-emerald-400/50' :
                overallAchievement >= 75 ? 'bg-[#CE9F6B]/100/30 border-amber-400/50' :
                overallAchievement >= 50 ? 'bg-[#CE9F6B]/100/30 border-[#CE9F6B]/50' :
                'bg-[#E17F70]/100/30 border-red-400/50'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {overallAchievement >= 100 ? <Trophy className="h-4 w-4" /> : 
                   overallAchievement >= 75 ? <Flame className="h-4 w-4" /> : 
                   <Percent className="h-4 w-4" />}
                  <span className="text-xs font-medium uppercase tracking-wide">Achievement</span>
                </div>
                <p className="text-2xl font-bold">{overallAchievement.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Controls Card */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-[#AEBFC3]/20 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#546A7A]/20 rounded-lg">
                  <Filter className="h-5 w-5 text-[#546A7A]" />
                </div>
                <CardTitle className="text-lg font-semibold">Filters & View</CardTitle>
              </div>
              {productTypeData.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowProductBreakdown(!showProductBreakdown)}
                  className="border-[#546A7A] text-[#546A7A] hover:bg-[#546A7A]/10"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Product Breakdown
                  {showProductBreakdown ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap items-center gap-4">
              {/* View Type Toggle */}
              <div className="flex items-center bg-[#AEBFC3]/20 p-1.5 rounded-xl">
                <button
                  onClick={() => setActiveTab('ZONE')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'ZONE'
                      ? 'bg-white text-[#546A7A] shadow-md'
                      : 'text-[#5D6E73] hover:text-[#546A7A]'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Zone Targets
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'ZONE' ? 'bg-[#96AEC2]/20 text-[#546A7A]' : 'bg-[#92A2A5]/30 text-[#5D6E73]'}`}>
                    {zoneTargets.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('USER')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'USER'
                      ? 'bg-white text-[#546A7A] shadow-md'
                      : 'text-[#5D6E73] hover:text-[#546A7A]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  User Targets
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'USER' ? 'bg-[#6F8A9D]/20 text-[#546A7A]' : 'bg-[#92A2A5]/30 text-[#5D6E73]'}`}>
                    {userTargets.length}
                  </span>
                </button>
              </div>

              {/* Period Selector */}
              <div className="flex items-center gap-2 bg-[#AEBFC3]/10 p-2 rounded-xl border border-[#92A2A5]">
                <Calendar className="w-4 h-4 text-[#546A7A] ml-2" />
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as 'MONTHLY' | 'YEARLY')}
                  className="px-3 py-2 border-0 bg-white rounded-lg focus:ring-2 focus:ring-[#6F8A9D] font-medium text-[#5D6E73] text-sm shadow-sm"
                >
                  <option value="MONTHLY">📅 Monthly</option>
                  <option value="YEARLY">📆 Yearly</option>
                </select>
                <input
                  type={periodType === 'MONTHLY' ? 'month' : 'number'}
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(e.target.value)}
                  className="px-3 py-2 border-0 bg-white rounded-lg focus:ring-2 focus:ring-[#6F8A9D] font-medium text-[#5D6E73] text-sm w-36 shadow-sm"
                  min={periodType === 'YEARLY' ? '2020' : undefined}
                  max={periodType === 'YEARLY' ? '2030' : undefined}
                />
              </div>

              {periodType === 'MONTHLY' && (
                <Badge className="bg-[#CE9F6B]/10 text-[#976E44] border border-[#CE9F6B]/40 font-medium">
                  📅 Monthly = Yearly ÷ 12
                </Badge>
              )}
            </div>

            {/* Product Breakdown - Collapsible */}
            {showProductBreakdown && productTypeData.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[#AEBFC3]/20">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {productTypeData.map((item) => (
                    <div 
                      key={item.productType}
                      className="bg-gradient-to-br from-[#AEBFC3]/10 to-white rounded-xl p-4 border border-[#92A2A5] hover:border-[#92A2A5] hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded-lg border ${PRODUCT_TYPE_COLORS[item.productType] || 'bg-[#AEBFC3]/20 text-[#5D6E73] border-[#92A2A5]'}`}>
                          {PRODUCT_TYPE_LABELS[item.productType] || item.productType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#757777]">Target</span>
                          <span className="font-bold text-[#546A7A]">{formatCurrency(item.targetValue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#757777]">Actual</span>
                          <span className="font-bold text-[#4F6A64]">{formatCurrency(item.actualValue)}</span>
                        </div>
                        <div className="relative pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${getAchievementBadge(item.achievement)}`}>
                              {item.achievement.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-[#92A2A5]/30 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                item.achievement >= 100 ? 'bg-gradient-to-r from-[#82A094] to-[#82A094]' : 
                                item.achievement >= 75 ? 'bg-gradient-to-r from-[#CE9F6B] to-yellow-500' : 
                                item.achievement >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-orange-400' : 
                                'bg-gradient-to-r from-[#E17F70] to-[#E17F70]'
                              }`}
                              style={{ width: `${Math.min(100, item.achievement)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Premium Data Table */}
        <Card className="border-0 shadow-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${activeTab === 'ZONE' ? 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800' : 'bg-gradient-to-r from-purple-800 via-purple-700 to-purple-800'} text-white`}>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      {activeTab === 'ZONE' ? <Building2 className="h-4 w-4 text-[#96AEC2]" /> : <Users className="h-4 w-4 text-[#6F8A9D]" />}
                      {activeTab === 'ZONE' ? 'Zone' : 'User'}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#EEC1BF]" />
                      Target Value
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#A2B9AF]" />
                      Actual Value
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-cyan-300" />
                      Achievement
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4 text-pink-300" />
                      Actions
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10/30">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D] flex items-center justify-center shadow-xl">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[#546A7A]">Loading targets...</p>
                          <p className="text-sm text-[#AEBFC3]0 mt-1">Fetching {activeTab === 'ZONE' ? 'zone' : 'user'} data</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : currentTargets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center bg-gradient-to-br from-[#AEBFC3]/10 to-[#96AEC2]/10/30">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shadow-lg">
                          <Target className="h-10 w-10 text-[#757777]" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-[#546A7A]">No Targets Found</p>
                          <p className="text-[#AEBFC3]0 mt-1 max-w-sm mx-auto">
                            {activeTab === 'ZONE' ? 'No zone targets configured for this period.' : 'No user targets configured for this period.'}
                          </p>
                        </div>
                        <p className="text-sm text-[#979796]">
                          Create targets by clicking the "Create" button for each {activeTab === 'ZONE' ? 'zone' : 'user'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {activeTab === 'ZONE' && zoneTargets.map((target: any, index: number) => {
                      const achievement = target.targetValue > 0 ? (target.actualValue / target.targetValue) * 100 : 0;
                      const style = getAchievementStyle(achievement);
                      const AchievementIcon = style.icon;
                      return (
                        <tr 
                          key={target.serviceZoneId} 
                          className={`
                            ${index % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/10/70'}
                            hover:bg-gradient-to-r hover:from-[#96AEC2]/10/80 hover:to-[#96AEC2]/10/50 
                            transition-all duration-200 group
                          `}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-xl ${target.id ? 'bg-gradient-to-br from-[#6F8A9D] to-[#6F8A9D]' : 'bg-gradient-to-br from-gray-300 to-gray-400'} flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-105 transition-transform`}>
                                {(target.serviceZone?.name || 'Z')?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#546A7A] text-lg">{target.serviceZone?.name}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {target.targetCount > 1 && (
                                    <span className="inline-flex text-xs bg-[#96AEC2]/10 text-[#546A7A] px-2 py-0.5 rounded-md font-medium border border-[#96AEC2]/30">
                                      📊 {target.targetCount} Combined
                                    </span>
                                  )}
                                  {!target.id && (
                                    <span className="inline-flex text-xs bg-[#CE9F6B]/10 text-[#976E44] px-2 py-0.5 rounded-md font-medium border border-[#EEC1BF]/20">
                                      ⚠️ No Target Set
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div>
                              <span className="font-bold text-[#546A7A] text-xl">{formatCurrency(target.targetValue || 0)}</span>
                              <p className="text-xs text-[#757777] mt-0.5">Target</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div>
                              <span className="font-bold text-[#4F6A64] text-xl">{formatCurrency(target.actualValue || 0)}</span>
                              <p className="text-xs text-[#757777] mt-0.5">Achieved</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl shadow-md ${style.bg} ${style.text}`}>
                                <AchievementIcon className="h-4 w-4" />
                                {achievement.toFixed(1)}%
                              </span>
                              <div className="hidden lg:block w-24">
                                <div className="w-full h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-700 ${
                                      achievement >= 100 ? 'bg-gradient-to-r from-[#82A094] to-[#82A094]' : 
                                      achievement >= 75 ? 'bg-gradient-to-r from-[#CE9F6B] to-yellow-500' : 
                                      achievement >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-orange-400' : 
                                      'bg-gradient-to-r from-[#E17F70] to-[#E17F70]'
                                    }`}
                                    style={{ width: `${Math.min(100, achievement)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                onClick={() => router.push(`/admin/targets/view?type=ZONE&id=${target.serviceZoneId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY`)}
                                size="sm"
                                variant="outline"
                                className="border-[#92A2A5] hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] hover:text-[#546A7A] transition-all"
                              >
                                <Eye className="w-4 h-4 mr-1.5" />
                                View
                              </Button>
                              {target.id ? (
                                <Button
                                  onClick={() => router.push(`/admin/targets/edit?type=ZONE&id=${target.serviceZoneId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY&targetId=${target.id}`)}
                                  size="sm"
                                  className="bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#82A094] hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <Edit2 className="w-4 h-4 mr-1.5" />
                                  Edit
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => router.push(`/admin/targets/edit?type=ZONE&id=${target.serviceZoneId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY`)}
                                  size="sm"
                                  className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#6F8A9D] hover:to-[#546A7A] text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <Plus className="w-4 h-4 mr-1.5" />
                                  Create
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {activeTab === 'USER' && userTargets.map((target: any, index: number) => {
                      const achievement = target.targetValue > 0 ? (target.actualValue / target.targetValue) * 100 : 0;
                      const style = getAchievementStyle(achievement);
                      const AchievementIcon = style.icon;
                      return (
                        <tr 
                          key={target.userId} 
                          className={`
                            ${index % 2 === 0 ? 'bg-white' : 'bg-[#AEBFC3]/10/70'}
                            hover:bg-gradient-to-r hover:from-[#96AEC2]/10/80 hover:to-[#EEC1BF]/10/50 
                            transition-all duration-200 group
                          `}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-xl ${target.id ? 'bg-gradient-to-br from-[#6F8A9D] to-[#9E3B47]' : 'bg-gradient-to-br from-gray-300 to-gray-400'} flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-105 transition-transform`}>
                                {(target.user?.name || 'U')?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#546A7A] text-lg">{target.user?.name || 'N/A'}</p>
                                <p className="text-sm text-[#757777]">{target.user?.email}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {target.targetCount > 1 && (
                                    <span className="inline-flex text-xs bg-[#6F8A9D]/10 text-[#546A7A] px-2 py-0.5 rounded-md font-medium border border-[#96AEC2]/20">
                                      📊 {target.targetCount} Combined
                                    </span>
                                  )}
                                  {!target.id && (
                                    <span className="inline-flex text-xs bg-[#CE9F6B]/10 text-[#976E44] px-2 py-0.5 rounded-md font-medium border border-[#EEC1BF]/20">
                                      ⚠️ No Target Set
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div>
                              <span className="font-bold text-[#546A7A] text-xl">{formatCurrency(target.targetValue || 0)}</span>
                              <p className="text-xs text-[#757777] mt-0.5">Target</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div>
                              <span className="font-bold text-[#4F6A64] text-xl">{formatCurrency(target.actualValue || 0)}</span>
                              <p className="text-xs text-[#757777] mt-0.5">Achieved</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl shadow-md ${style.bg} ${style.text}`}>
                                <AchievementIcon className="h-4 w-4" />
                                {achievement.toFixed(1)}%
                              </span>
                              <div className="hidden lg:block w-24">
                                <div className="w-full h-2.5 bg-[#92A2A5]/30 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-700 ${
                                      achievement >= 100 ? 'bg-gradient-to-r from-[#82A094] to-[#82A094]' : 
                                      achievement >= 75 ? 'bg-gradient-to-r from-[#CE9F6B] to-yellow-500' : 
                                      achievement >= 50 ? 'bg-gradient-to-r from-[#CE9F6B] to-orange-400' : 
                                      'bg-gradient-to-r from-[#E17F70] to-[#E17F70]'
                                    }`}
                                    style={{ width: `${Math.min(100, achievement)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                onClick={() => router.push(`/admin/targets/view?type=USER&id=${target.userId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY`)}
                                size="sm"
                                variant="outline"
                                className="border-[#92A2A5] hover:bg-[#96AEC2]/10 hover:border-[#96AEC2] hover:text-[#546A7A] transition-all"
                              >
                                <Eye className="w-4 h-4 mr-1.5" />
                                View
                              </Button>
                              {target.id ? (
                                <Button
                                  onClick={() => router.push(`/admin/targets/edit?type=USER&id=${target.userId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY&targetId=${target.id}`)}
                                  size="sm"
                                  className="bg-gradient-to-r from-[#82A094] to-[#82A094] hover:from-[#82A094] hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <Edit2 className="w-4 h-4 mr-1.5" />
                                  Edit
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => router.push(`/admin/targets/edit?type=USER&id=${target.userId}&period=${periodType === 'MONTHLY' ? targetPeriod.split('-')[0] : targetPeriod}&periodType=YEARLY`)}
                                  size="sm"
                                  className="bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#6F8A9D] hover:to-[#546A7A] text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <Plus className="w-4 h-4 mr-1.5" />
                                  Create
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
