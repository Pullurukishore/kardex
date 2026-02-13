'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/user.types';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, Target, TrendingUp, Package, Building2, Users, 
  Award, BarChart3, Sparkles, Zap, ArrowUpRight, ArrowDownRight,
  CheckCircle, AlertCircle, Crown, Activity, RefreshCw
} from 'lucide-react';
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from '@/types/reports';

// Custom hook for animated counter
function useAnimatedCounter(end: number, duration: number = 1000, enabled: boolean = true) {
  const [count, setCount] = useState(0);
  const prevEnd = useRef(end);
  
  useEffect(() => {
    if (!enabled) {
      setCount(end);
      return;
    }
    
    if (Math.abs(end - prevEnd.current) > end * 0.5) {
      setCount(0);
    }
    prevEnd.current = end;
    
    let startTime: number | null = null;
    let animationFrame: number;
    const startValue = count;
    
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(startValue + (end - startValue) * easeOutQuart));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      }
    };
    
    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, enabled]);
  
  return count;
}

interface TargetDetail {
  id: number;
  productType: string | null;
  targetValue: number;
  actualValue: number;
  achievement: number;
}

const PRODUCT_TYPE_CONFIG: { [key: string]: { label: string; icon: string; gradient: string; bg: string; border: string } } = {
  'RELOCATION': { label: PRODUCT_TYPE_LABELS.RELOCATION, icon: '🚚', gradient: 'from-[#6F8A9D] to-[#6F8A9D]', bg: 'bg-[#96AEC2]/10', border: 'border-[#96AEC2]' },
  'CONTRACT': { label: PRODUCT_TYPE_LABELS.CONTRACT, icon: '📋', gradient: 'from-[#82A094] to-[#82A094]', bg: 'bg-[#82A094]/10', border: 'border-[#A2B9AF]/40' },
  'SPARE_PARTS': { label: PRODUCT_TYPE_LABELS.SPARE_PARTS, icon: '🔧', gradient: 'from-[#6F8A9D] to-[#6F8A9D]', bg: 'bg-[#6F8A9D]/10', border: 'border-[#6F8A9D]' },
  'KARDEX_CONNECT': { label: PRODUCT_TYPE_LABELS.KARDEX_CONNECT, icon: '🔒', gradient: 'from-[#6F8A9D] to-cyan-600', bg: 'bg-[#96AEC2]/10', border: 'border-[#96AEC2]/40' },
  'UPGRADE_KIT': { label: PRODUCT_TYPE_LABELS.UPGRADE_KIT, icon: '⬆️', gradient: 'from-[#CE9F6B] to-[#976E44]', bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]/40' },
  'SOFTWARE': { label: PRODUCT_TYPE_LABELS.SOFTWARE, icon: '💻', gradient: 'from-[#6F8A9D] to-cyan-600', bg: 'bg-[#96AEC2]/10', border: 'border-[#96AEC2]/40' },
  'OTHERS': { label: PRODUCT_TYPE_LABELS.OTHERS, icon: '💰', gradient: 'from-[#E17F70] to-[#9E3B47]', bg: 'bg-[#EEC1BF]/10', border: 'border-[#EEC1BF]/40' },
  'BD_SPARE': { label: PRODUCT_TYPE_LABELS.BD_SPARE, icon: '🔩', gradient: 'from-[#6F8A9D] to-[#6F8A9D]', bg: 'bg-[#546A7A]/10', border: 'border-[#546A7A]' },
  'RETROFIT_KIT': { label: PRODUCT_TYPE_LABELS.RETROFIT_KIT, icon: '🛠️', gradient: 'from-[#CE9F6B] to-[#976E44]', bg: 'bg-[#CE9F6B]/10', border: 'border-[#CE9F6B]' },
  'Overall': { label: 'Overall', icon: '🎯', gradient: 'from-slate-600 to-slate-700', bg: 'bg-[#AEBFC3]/10', border: 'border-[#92A2A5]' },
};

export default function TargetViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const type = (searchParams.get('type') || 'ZONE') as 'ZONE' | 'USER';
  const entityId = searchParams.get('id') || '';
  const period = searchParams.get('period') || '';
  const periodType = searchParams.get('periodType') || 'YEARLY';

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetDetail[]>([]);
  const [entityName, setEntityName] = useState('');

  // Product types from backend enum

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

  useEffect(() => {
    if (entityId && period && !authLoading && isAuthenticated && user?.role === UserRole.ADMIN) {
      fetchTargets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, period, periodType, type, authLoading, isAuthenticated, user?.role]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const params = { targetPeriod: period, periodType };
      
      if (type === 'ZONE') {
        const response = await apiService.getZoneTargets(params);
        const zoneTargets = response.targets.filter((t: any) => t.serviceZoneId === parseInt(entityId));
        setTargets(zoneTargets.map((t: any) => ({
          id: t.id,
          productType: t.productType,
          targetValue: t.targetValue,
          actualValue: t.actualValue,
          achievement: t.achievement
        })));
        if (zoneTargets.length > 0) {
          setEntityName(zoneTargets[0].serviceZone.name);
        }
      } else {
        const response = await apiService.getUserTargets(params);
        const userTargets = response.targets.filter((t: any) => t.userId === parseInt(entityId));
        setTargets(userTargets.map((t: any) => ({
          id: t.id,
          productType: t.productType,
          targetValue: t.targetValue,
          actualValue: t.actualValue,
          achievement: t.achievement
        })));
        if (userTargets.length > 0) {
          setEntityName(userTargets[0].user.name || userTargets[0].user.email);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch targets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const getAchievementColor = (achievement: number) => {
    if (achievement >= 100) return 'from-[#82A094] to-[#82A094]';
    if (achievement >= 75) return 'from-[#CE9F6B] to-yellow-600';
    if (achievement >= 50) return 'from-[#CE9F6B] to-[#976E44]';
    return 'from-[#E17F70] to-[#9E3B47]';
  };

  const getAchievementBadge = (achievement: number) => {
    if (achievement >= 100) return { bg: 'bg-[#82A094]/20', text: 'text-[#4F6A64]', border: 'border-[#A2B9AF]/40', icon: '🏆' };
    if (achievement >= 75) return { bg: 'bg-[#CE9F6B]/20', text: 'text-[#976E44]', border: 'border-[#CE9F6B]/40', icon: '📈' };
    if (achievement >= 50) return { bg: 'bg-[#CE9F6B]/20', text: 'text-[#976E44]', border: 'border-[#CE9F6B]', icon: '📊' };
    return { bg: 'bg-[#E17F70]/20', text: 'text-[#75242D]', border: 'border-[#E17F70]', icon: '⚠️' };
  };

  const overallTarget = targets.find(t => !t.productType);
  const productTargets = targets.filter(t => t.productType);
  const totalTarget = targets.reduce((sum, t) => sum + t.targetValue, 0);
  const totalActual = targets.reduce((sum, t) => sum + t.actualValue, 0);
  const overallAchievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  const variance = totalActual - totalTarget;

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#5D6E73] via-[#546A7A] to-[#546A7A]">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-[#6F8A9D]/20 rounded-full"></div>
            <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-[#96AEC2] border-r-blue-400/50 rounded-full animate-spin"></div>
            <div className="absolute inset-2 w-20 h-20 border-4 border-transparent border-b-purple-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-[#96AEC2] font-medium mt-6 text-lg animate-pulse">Loading...</p>
          <div className="flex justify-center gap-1 mt-3">
            <div className="w-2 h-2 bg-[#6F8A9D] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#6F8A9D] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#6F8A9D] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated or not ADMIN
  if (!isAuthenticated || user?.role !== UserRole.ADMIN) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/50">
      <div className="w-full">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#5D6E73] hover:text-[#546A7A] mb-6 transition-all group"
        >
          <div className="p-2 rounded-lg bg-white shadow-sm group-hover:shadow-md group-hover:-translate-x-1 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="font-medium">Back to Targets</span>
        </button>
        
        {/* Hero Header */}
        <div className={`relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl mb-8 bg-gradient-to-r group ${
          type === 'ZONE' 
            ? 'from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A]' 
            : 'from-[#6F8A9D] via-pink-600 to-[#9E3B47]'
        }`}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#6F8A9D]/100/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" style={{ animation: 'pulse 3s ease-in-out infinite alternate' }}></div>
          <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-[#96AEC2]/10 rounded-full blur-2xl" style={{ animation: 'pulse 4s ease-in-out infinite alternate-reverse' }}></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-white/20 backdrop-blur-xl p-4 rounded-2xl border border-white/30">
                  {type === 'ZONE' ? <Building2 className="w-12 h-12" /> : <Users className="w-12 h-12" />}
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                  {entityName}
                  <Crown className="w-8 h-8 text-[#CE9F6B] animate-pulse" />
                </h1>
                <p className="text-white/80 mt-2 text-lg">
                  {type === 'ZONE' ? 'Zone' : 'User'} Target Breakdown • {period} ({periodType === 'YEARLY' ? 'Yearly' : 'Monthly'})
                </p>
              </div>
            </div>
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/15 backdrop-blur-xl rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-2 text-white/70 text-sm font-semibold mb-2">
                  <Target className="w-4 h-4" />
                  Total Target
                </div>
                <div className="text-3xl font-bold">{formatCurrency(totalTarget)}</div>
                <div className="text-white/60 text-sm mt-1">📅 Monthly: {formatCurrency(totalTarget / 12)}</div>
              </div>
              <div className="bg-white/15 backdrop-blur-xl rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-2 text-white/70 text-sm font-semibold mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Actual Value
                </div>
                <div className="text-3xl font-bold">{formatCurrency(totalActual)}</div>
                <div className="text-white/60 text-sm mt-1">Won Orders</div>
              </div>
              <div className="bg-white/15 backdrop-blur-xl rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-2 text-white/70 text-sm font-semibold mb-2">
                  <Award className="w-4 h-4" />
                  Achievement
                </div>
                <div className={`text-3xl font-bold ${
                  overallAchievement >= 100 ? 'text-[#A2B9AF]' :
                  overallAchievement >= 75 ? 'text-[#EEC1BF]' : 'text-[#E17F70]'
                }`}>
                  {overallAchievement.toFixed(1)}%
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mt-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-gradient-to-r ${getAchievementColor(overallAchievement)}`}
                    style={{ width: `${Math.min(100, overallAchievement)}%` }}
                  />
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-xl rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-2 text-white/70 text-sm font-semibold mb-2">
                  <BarChart3 className="w-4 h-4" />
                  Variance
                </div>
                <div className={`text-3xl font-bold flex items-center gap-2 ${
                  variance >= 0 ? 'text-[#A2B9AF]' : 'text-[#E17F70]'
                }`}>
                  {variance >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                  {formatCurrency(Math.abs(variance))}
                </div>
                <div className="text-white/60 text-sm mt-1">
                  {variance >= 0 ? '🎉 Above Target' : '📉 Below Target'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl shadow-xl border border-[#AEBFC3]/20 p-16 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 w-20 h-20 border-4 border-[#96AEC2]/30 rounded-full"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-[#5D6E73] font-bold text-xl">Loading target details...</p>
            <p className="text-[#757777] text-sm mt-2">Please wait</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Target */}
            {overallTarget && (
              <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden">
                <div className="bg-gradient-to-r from-[#82A094] via-[#82A094] to-[#82A094] px-6 py-5">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                        <TrendingUp className="w-7 h-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Overall Target (All Products)</h2>
                        <p className="text-emerald-100 text-sm mt-0.5">Combined performance across all product types</p>
                      </div>
                    </div>
                    <div className={`px-6 py-3 rounded-xl text-xl font-bold bg-white/20 backdrop-blur-xl border border-white/30`}>
                      {overallTarget.achievement.toFixed(1)}% Achievement
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-[#AEBFC3]/10 rounded-xl p-5 border border-[#AEBFC3]/20">
                      <div className="text-sm font-semibold text-[#757777] mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Yearly Target
                      </div>
                      <div className="text-3xl font-bold text-[#546A7A]">{formatCurrency(overallTarget.targetValue)}</div>
                    </div>
                    <div className="bg-[#AEBFC3]/10 rounded-xl p-5 border border-[#AEBFC3]/20">
                      <div className="text-sm font-semibold text-[#757777] mb-2 flex items-center gap-2">
                        📅 Monthly Target
                      </div>
                      <div className="text-3xl font-bold text-[#546A7A]">{formatCurrency(overallTarget.targetValue / 12)}</div>
                    </div>
                    <div className="bg-[#82A094]/10 rounded-xl p-5 border border-[#A2B9AF]/20">
                      <div className="text-sm font-semibold text-[#4F6A64] mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Actual Value
                      </div>
                      <div className="text-3xl font-bold text-[#4F6A64]">{formatCurrency(overallTarget.actualValue)}</div>
                    </div>
                    <div className={`rounded-xl p-5 border ${
                      overallTarget.actualValue >= overallTarget.targetValue 
                        ? 'bg-[#82A094]/10 border-[#A2B9AF]/20' 
                        : 'bg-[#E17F70]/10 border-red-100'
                    }`}>
                      <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
                        overallTarget.actualValue >= overallTarget.targetValue ? 'text-[#4F6A64]' : 'text-[#9E3B47]'
                      }`}>
                        {overallTarget.actualValue >= overallTarget.targetValue ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        Gap / Surplus
                      </div>
                      <div className={`text-3xl font-bold ${
                        overallTarget.actualValue >= overallTarget.targetValue ? 'text-[#4F6A64]' : 'text-[#75242D]'
                      }`}>
                        {formatCurrency(Math.abs(overallTarget.actualValue - overallTarget.targetValue))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-semibold text-[#5D6E73]">Progress to Target</span>
                      <span className={`font-bold ${
                        overallTarget.achievement >= 100 ? 'text-[#4F6A64]' :
                        overallTarget.achievement >= 75 ? 'text-[#976E44]' : 'text-[#9E3B47]'
                      }`}>{overallTarget.achievement.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[#AEBFC3]/20 rounded-full h-4 overflow-hidden">
                      <div 
                        className={`h-full rounded-full bg-gradient-to-r ${getAchievementColor(overallTarget.achievement)} transition-all duration-1000`}
                        style={{ width: `${Math.min(100, overallTarget.achievement)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Product-Specific Targets */}
            <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden">
              <div className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] px-6 py-5">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Product-Specific Targets</h2>
                      <p className="text-violet-100 text-sm mt-0.5">Performance breakdown by product category</p>
                    </div>
                  </div>
                  <div className="px-5 py-2 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30 font-bold">
                    {productTargets.length} / {PRODUCT_TYPES.length} Products Have Targets
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {PRODUCT_TYPES.map((productType) => {
                    const target = productTargets.find(t => t.productType === productType);
                    const hasTarget = !!target;
                    const targetValue = target?.targetValue || 0;
                    const actualValue = target?.actualValue || 0;
                    const achievement = target?.achievement || 0;
                    const config = PRODUCT_TYPE_CONFIG[productType];
                    const badge = getAchievementBadge(achievement);
                    
                    return (
                      <div 
                        key={productType} 
                        className={`relative rounded-2xl p-6 transition-all duration-300 ${
                          hasTarget 
                            ? `${config.bg} border-2 ${config.border} hover:shadow-xl` 
                            : 'border-2 border-dashed border-[#92A2A5] bg-[#AEBFC3]/10/50 hover:bg-[#AEBFC3]/20/50'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${hasTarget ? config.gradient : 'from-slate-400 to-[#AEBFC3]/100'}`}>
                              <Package className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-[#546A7A]">{config.label}</h3>
                              <p className="text-xs text-[#757777]">{config.icon} Product Type</p>
                            </div>
                          </div>
                          {hasTarget ? (
                            <div className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.icon} {achievement.toFixed(0)}%
                            </div>
                          ) : (
                            <div className="px-3 py-1.5 rounded-xl text-sm font-medium bg-[#CE9F6B]/10 text-[#976E44] border border-[#CE9F6B]">
                              ⚠️ No Target
                            </div>
                          )}
                        </div>
                        
                        {hasTarget ? (
                          <>
                            {/* Stats */}
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-[#757777] mb-1">Yearly Target</div>
                                  <div className="text-lg font-bold text-[#546A7A]">{formatCurrency(targetValue)}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-[#757777] mb-1">Monthly Target</div>
                                  <div className="text-lg font-bold text-[#546A7A]">{formatCurrency(targetValue / 12)}</div>
                                </div>
                              </div>
                              
                              <div className="bg-white/60 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-semibold text-[#757777]">Actual Value</span>
                                  <span className="text-lg font-bold text-[#4F6A64]">{formatCurrency(actualValue)}</span>
                                </div>
                                <div className="w-full bg-white rounded-full h-2.5 overflow-hidden shadow-inner">
                                  <div 
                                    className={`h-full rounded-full bg-gradient-to-r ${getAchievementColor(achievement)} transition-all duration-700`}
                                    style={{ width: `${Math.min(100, achievement)}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className={`rounded-lg p-3 ${
                                actualValue >= targetValue ? 'bg-[#82A094]/20/60' : 'bg-[#E17F70]/20/60'
                              }`}>
                                <div className="flex justify-between items-center">
                                  <span className={`text-xs font-semibold ${
                                    actualValue >= targetValue ? 'text-[#4F6A64]' : 'text-[#9E3B47]'
                                  }`}>
                                    {actualValue >= targetValue ? '🎉 Surplus' : '📉 Gap'}
                                  </span>
                                  <span className={`text-lg font-bold ${
                                    actualValue >= targetValue ? 'text-[#4F6A64]' : 'text-[#75242D]'
                                  }`}>
                                    {formatCurrency(Math.abs(actualValue - targetValue))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-[#92A2A5]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                              <AlertCircle className="w-8 h-8 text-[#979796]" />
                            </div>
                            <p className="text-[#757777] font-medium">No target set for this product</p>
                            <p className="text-[#979796] text-sm mt-1">Set a target in edit mode to track performance</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* No Targets */}
            {targets.length === 0 && (
              <div className="bg-white rounded-3xl shadow-xl border border-[#AEBFC3]/20 p-16 text-center">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#96AEC2]/20 to-[#96AEC2]/20 rounded-full flex items-center justify-center shadow-lg">
                    <Target className="w-12 h-12 text-[#6F8A9D]" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#CE9F6B] rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-lg">⚠️</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#546A7A] mt-6 mb-2">No Targets Found</p>
                <p className="text-[#757777] text-lg max-w-md mx-auto">
                  No targets have been set for this {type.toLowerCase()} in the selected period.
                </p>
                <button
                  onClick={() => router.push(`/admin/targets/edit?type=${type}&id=${entityId}&period=${period}&periodType=${periodType}`)}
                  className={`mt-6 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl bg-gradient-to-r ${
                    type === 'ZONE' ? 'from-[#6F8A9D] to-[#6F8A9D]' : 'from-[#6F8A9D] to-[#9E3B47]'
                  }`}
                >
                  ✨ Create Target Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
