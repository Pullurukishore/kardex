'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, DollarSign, Award, Percent,
  Download, RefreshCw, Filter, ChevronDown, ChevronRight, Lightbulb,
  Calendar, MapPin, User, Users, BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  FileText, Printer, Activity, Package, Zap, CheckCircle2, AlertTriangle,
  XCircle, Info, Rocket, ShieldCheck,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { generateGrowthPillarPdf } from '@/lib/growth-report-pdf';
import { exportGrowthPillarToExcel } from '@/lib/growth-report-excel';


// ─── TYPES ──────────────────────────────────────────────────────────────
interface MonthData {
  month: number;
  monthLabel: string;
  monthStr: string;
  target: number;
  offerValue: number;
  wonValue: number;
  offerCount: number;
  wonCount: number;
  achievementPercent: number;
  hitRatePercent: number;
  growthPercent: number | null;
}

interface ProductData {
  productType: string;
  productLabel: string;
  target: number;
  offerValue: number;
  wonValue: number;
  offerCount: number;
  wonCount: number;
  achievementPercent: number;
  hitRatePercent: number;
  monthlyData: MonthData[];
}

interface InsightItem {
  text: string;
  type: string; // success | info | warning | error | action
}

interface GrowthInsights {
  performance: {
    status: string;
    statusColor: string;
    points: InsightItem[];
  };
  trends: InsightItem[];
  products: InsightItem[];
  conversion: InsightItem[];
  recommendations: InsightItem[];
}

interface GrowthPillarData {
  year: number;
  fromMonth: number;
  toMonth: number;
  filters: {
    zoneId: number | null;
    userId: number | null;
    zones: { id: number; name: string }[];
    users: { id: number; name: string }[];
  };
  totals: {
    target: number;
    offerValue: number;
    wonValue: number;
    offerCount: number;
    wonCount: number;
    achievementPercent: number;
    hitRatePercent: number;
  };
  monthlyData: MonthData[];
  productData: ProductData[];
  insights: GrowthInsights;
}

// ─── HELPERS ────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
};

const formatLargeNumber = (value: number) => {
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} K`;
  return value.toFixed(0);
};

const CHART_COLORS = {
  target: '#6366f1',
  offerValue: '#f59e0b',
  wonValue: '#10b981',
  growth: '#8b5cf6',
  achievement: '#06b6d4',
};

const PRODUCT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];

// ─── SKELETON ───────────────────────────────────────────────────────────
const SkeletonLoader = () => (
  <div className="animate-pulse space-y-6 p-6">
    <div className="flex gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex-1 h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-6">
      <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
    </div>
    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
  </div>
);

// ─── KPI CARD ───────────────────────────────────────────────────────────
const KPICard = ({ title, value, subtitle, icon: Icon, color, trend }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color: string; trend?: number | null;
}) => (
  <div className="relative overflow-hidden rounded-xl border border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[60px] opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: color }} />
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      <div className="p-2.5 rounded-lg" style={{ background: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
    </div>
    {trend !== undefined && trend !== null && (
      <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {Math.abs(trend).toFixed(1)}% vs prev period
      </div>
    )}
  </div>
);

// ─── CUSTOM TOOLTIP ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 text-xs">
      <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1.5">{label}</p>
      {payload.map((item: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
          <span className="text-gray-600 dark:text-gray-400">{item.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {typeof item.value === 'number' && item.name?.includes('%')
              ? `${item.value}%`
              : formatCurrency(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
};
// ─── INSIGHT ROW ────────────────────────────────────────────────────────
const INSIGHT_CONFIG: Record<string, { icon: React.ElementType; bg: string; border: string; iconColor: string; text: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200/50 dark:border-emerald-800/30', iconColor: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-800 dark:text-emerald-300' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200/50 dark:border-blue-800/30', iconColor: 'text-blue-600 dark:text-blue-400', text: 'text-blue-800 dark:text-blue-300' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200/50 dark:border-amber-800/30', iconColor: 'text-amber-600 dark:text-amber-400', text: 'text-amber-800 dark:text-amber-300' },
  error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200/50 dark:border-red-800/30', iconColor: 'text-red-600 dark:text-red-400', text: 'text-red-800 dark:text-red-300' },
  action: { icon: Rocket, bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200/50 dark:border-indigo-800/30', iconColor: 'text-indigo-600 dark:text-indigo-400', text: 'text-indigo-800 dark:text-indigo-300' },
};

const InsightRow = ({ item }: { item: InsightItem }) => {
  const config = INSIGHT_CONFIG[item.type] || INSIGHT_CONFIG.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2 rounded-lg ${config.bg} border ${config.border} transition-all hover:shadow-sm`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
      <p className={`text-sm leading-relaxed ${config.text}`}>{item.text}</p>
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────
export default function GrowthPillarDashboard() {
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GrowthPillarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  // Filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(1);
  const [toMonth, setToMonth] = useState(12);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const [probability, setProbability] = useState<number | 'all'>('all');
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [expandedForecastZones, setExpandedForecastZones] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { year, fromMonth, toMonth };
      if (zoneId) params.zoneId = zoneId;
      if (userId) params.userId = userId;
      const result = await apiService.getGrowthPillar(params);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load growth pillar');
    } finally {
      setLoading(false);
    }
  }, [year, fromMonth, toMonth, zoneId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset userId when zone changes
  useEffect(() => { setUserId(null); }, [zoneId]);

  // Fetch forecast data (filtered by probability + zone + user)
  const fetchForecastData = useCallback(async () => {
    try {
      setForecastLoading(true);
      const params: any = { year };
      if (probability !== 'all') params.minProbability = probability;
      if (zoneId) params.zoneId = zoneId;
      if (userId) params.userId = userId;
      const [poData, puzData, pwfData] = await Promise.all([
        apiService.getPOExpectedMonthBreakdown(params),
        apiService.getProductUserZoneBreakdown(params),
        apiService.getProductWiseForecast(params).catch(() => null),
      ]);
      setForecastData({ po: poData, puz: puzData, pwf: pwfData });
      if (poData?.zones) {
        setExpandedForecastZones(new Set(poData.zones.map((z: any) => z.zoneId)));
      }
    } catch (err) {
      console.error('Failed to load forecast data:', err);
    } finally {
      setForecastLoading(false);
    }
  }, [year, probability, zoneId, userId]);

  useEffect(() => { fetchForecastData(); }, [fetchForecastData]);

  const toggleForecastZone = (id: number) => {
    setExpandedForecastZones(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProduct = (productType: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      next.has(productType) ? next.delete(productType) : next.add(productType);
      return next;
    });
  };

  const handleExportPdf = async () => {
    if (!data) return;
    try {
      setPdfLoading(true);
      await generateGrowthPillarPdf(data as any);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;
    try {
      setExcelLoading(true);
      await exportGrowthPillarToExcel(data as any);
    } catch (err) {
      console.error('Excel generation failed:', err);
    } finally {
      setExcelLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) return <SkeletonLoader />;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
      <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
        <TrendingDown className="w-8 h-8 text-red-500" />
      </div>
      <p className="text-lg font-medium text-gray-800 dark:text-gray-200">Failed to load growth pillar</p>
      <p className="text-sm text-gray-500">{error}</p>
      <button onClick={fetchData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
        Retry
      </button>
    </div>
  );

  if (!data) return null;

  const { totals, monthlyData, productData, insights, filters } = data;

  // Prepare chart data
  const barChartData = monthlyData.map(d => ({
    name: d.monthLabel.slice(0, 3),
    Target: d.target,
    'Offer Value': d.offerValue,
    'Won Value': d.wonValue,
  }));

  const achievementChartData = monthlyData.map(d => ({
    name: d.monthLabel.slice(0, 3),
    'Achievement %': d.achievementPercent,
    'Hit Rate %': d.hitRatePercent,
  }));

  const growthChartData = monthlyData.filter(d => d.growthPercent !== null).map(d => ({
    name: d.monthLabel.slice(0, 3),
    'Growth %': d.growthPercent,
  }));

  const productPieData = productData.map((p, i) => ({
    name: p.productLabel,
    value: p.wonValue,
    color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
  })).filter(p => p.value > 0);

  // Average growth
  const avgGrowth = monthlyData.filter(d => d.growthPercent !== null).reduce((s, d) => s + (d.growthPercent || 0), 0) /
    (monthlyData.filter(d => d.growthPercent !== null).length || 1);

  return (
    <div ref={printRef} className="space-y-6 print:space-y-4">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Growth Pillar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {FULL_MONTHS[fromMonth - 1]} – {FULL_MONTHS[toMonth - 1]} {year}
            {zoneId && filters.zones.length > 0 ? ` • ${filters.zones.find(z => z.id === zoneId)?.name || 'Zone'}` : ' • All Zones'}
            {userId && filters.users.length > 0 ? ` • ${filters.users.find(u => u.id === userId)?.name || 'User'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleExportExcel} disabled={excelLoading} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
            {excelLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="w-4 h-4" /> Excel</>
            )}
          </button>
          <button onClick={handleExportPdf} disabled={pdfLoading} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
            {pdfLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="w-4 h-4" /> PDF</>
            )}
          </button>
        </div>
      </div>

      {/* ── FILTER BAR ─────────────────────────────────────── */}
      {showFilters && (
        <div className="print:hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {/* Year */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* From Month */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">From Month</label>
              <select value={fromMonth} onChange={e => { const v = Number(e.target.value); setFromMonth(v); if (v > toMonth) setToMonth(v); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {/* To Month */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">To Month</label>
              <select value={toMonth} onChange={e => setToMonth(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                {MONTHS.map((m, i) => <option key={i} value={i + 1} disabled={i + 1 < fromMonth}>{m}</option>)}
              </select>
            </div>
            {/* Zone */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Zone</label>
              <select value={zoneId || ''} onChange={e => setZoneId(e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">All Zones</option>
                {filters.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            {/* User (only when zone selected) */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">User</label>
              <select value={userId || ''} onChange={e => setUserId(e.target.value ? Number(e.target.value) : null)} disabled={!zoneId} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">All Users</option>
                {filters.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {/* Probability */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Probability</label>
              <select value={String(probability)} onChange={e => setProbability(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="all">All Probability</option>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => <option key={p} value={p}>≥ {p}%</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI CARDS ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Total Target" value={formatCurrency(totals.target)} subtitle={`${totals.offerCount} offers`} icon={Target} color="#6366f1" />
        <KPICard title="Offer Value" value={formatCurrency(totals.offerValue)} subtitle={`${totals.offerCount} offers created`} icon={DollarSign} color="#f59e0b" />
        <KPICard title="Won Value" value={formatCurrency(totals.wonValue)} subtitle={`${totals.wonCount} orders won`} icon={Award} color="#10b981" />
        <KPICard title="Achievement" value={`${totals.achievementPercent}%`} subtitle="Won / Target" icon={TrendingUp} color="#06b6d4" />
        <KPICard title="Hit Rate" value={`${totals.hitRatePercent}%`} subtitle="Won / Offer Value" icon={Percent} color="#8b5cf6" />
      </div>

      {/* ── CHARTS GRID ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Target vs Offer Value vs Won */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Target vs Offer Value vs Won
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatLargeNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Target" fill={CHART_COLORS.target} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Offer Value" fill={CHART_COLORS.offerValue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Won Value" fill={CHART_COLORS.wonValue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Achievement Trend */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" /> Achievement & Hit Rate Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={achievementChartData}>
              <defs>
                <linearGradient id="gradAchievement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.achievement} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.achievement} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradHitRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.growth} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.growth} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="Achievement %" stroke={CHART_COLORS.achievement} fill="url(#gradAchievement)" strokeWidth={2} dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Hit Rate %" stroke={CHART_COLORS.growth} fill="url(#gradHitRate)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Growth Rate MoM */}
        {growthChartData.length > 0 && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" /> Month-over-Month Growth Rate
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Growth %" stroke={CHART_COLORS.growth} strokeWidth={2.5} dot={{ fill: CHART_COLORS.growth, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Product-wise Won Pie */}
        {productPieData.length > 0 && (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-pink-500" /> Product-wise Won Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={productPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#9ca3af' }} style={{ fontSize: '11px' }}>
                  {productPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── MONTHLY DATA TABLE ─────────────────────────────── */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" /> Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Month</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Target</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Offer Value</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Won Value</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Offers</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Won</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Achievement</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Hit Rate</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">MoM Growth</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d, i) => (
                <tr key={d.month} className={`border-t border-gray-100 dark:border-gray-700/30 ${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/30'} hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors`}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{d.monthLabel}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(d.target)}</td>
                  <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">{formatCurrency(d.offerValue)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(d.wonValue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{d.offerCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{d.wonCount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${d.achievementPercent >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : d.achievementPercent >= 50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {d.achievementPercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{d.hitRatePercent}%</td>
                  <td className="px-4 py-3 text-right">
                    {d.growthPercent !== null ? (
                      <span className={`inline-flex items-center gap-0.5 ${d.growthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {d.growthPercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(d.growthPercent)}%
                      </span>
                    ) : (
                      <span className="text-gray-400"><Minus className="w-3 h-3 inline" /></span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/70 font-semibold">
                <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(totals.target)}</td>
                <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-300">{formatCurrency(totals.offerValue)}</td>
                <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300">{formatCurrency(totals.wonValue)}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{totals.offerCount}</td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{totals.wonCount}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${totals.achievementPercent >= 100 ? 'bg-emerald-200 text-emerald-900' : 'bg-indigo-200 text-indigo-900'}`}>
                    {totals.achievementPercent}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{totals.hitRatePercent}%</td>
                <td className="px-4 py-3 text-right text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PRODUCT-WISE BREAKDOWN ─────────────────────────── */}
      {productData.length > 0 && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-pink-500" /> Product-wise Growth
            </h3>
          </div>

          {/* Product summaries */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
            {productData.map((p, idx) => (
              <div key={p.productType}>
                {/* Product header row */}
                <button
                  onClick={() => toggleProduct(p.productType)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.productLabel}</span>
                    <span className="text-xs text-gray-500">({p.offerCount} offers)</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <span className="text-gray-500">Target: <span className="text-gray-800 dark:text-gray-200 font-medium">{formatCurrency(p.target)}</span></span>
                    <span className="text-gray-500">Offer: <span className="text-amber-600 font-medium">{formatCurrency(p.offerValue)}</span></span>
                    <span className="text-gray-500">Won: <span className="text-emerald-600 font-medium">{formatCurrency(p.wonValue)}</span></span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${p.achievementPercent >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : p.achievementPercent >= 50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {p.achievementPercent}%
                    </span>
                    {expandedProducts.has(p.productType) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded monthly data */}
                {expandedProducts.has(p.productType) && (
                  <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                    <table className="w-full text-xs mt-1">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400">
                          <th className="text-left py-2 px-2 font-medium">Month</th>
                          <th className="text-right py-2 px-2 font-medium">Target</th>
                          <th className="text-right py-2 px-2 font-medium">Offer Value</th>
                          <th className="text-right py-2 px-2 font-medium">Won Value</th>
                          <th className="text-right py-2 px-2 font-medium">Offers</th>
                          <th className="text-right py-2 px-2 font-medium">Won</th>
                          <th className="text-right py-2 px-2 font-medium">Achievement</th>
                          <th className="text-right py-2 px-2 font-medium">Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.monthlyData.map(md => (
                          <tr key={md.month} className="border-t border-gray-200/50 dark:border-gray-700/20">
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{md.monthLabel.slice(0, 3)}</td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(md.target)}</td>
                            <td className="py-2 px-2 text-right text-amber-600">{formatCurrency(md.offerValue)}</td>
                            <td className="py-2 px-2 text-right text-emerald-600">{formatCurrency(md.wonValue)}</td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{md.offerCount}</td>
                            <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-400">{md.wonCount}</td>
                            <td className="py-2 px-2 text-right">
                              <span className={`${md.achievementPercent >= 100 ? 'text-emerald-600' : md.achievementPercent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                {md.achievementPercent}%
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right">
                              {md.growthPercent !== null ? (
                                <span className={md.growthPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                  {md.growthPercent >= 0 ? '+' : ''}{md.growthPercent}%
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PRODUCT TARGET vs WON BAR ──────────────────────── */}
      {productData.length > 0 && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" /> Product-wise: Target vs Offer vs Won
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={productData.map(p => ({
              name: p.productLabel.length > 12 ? p.productLabel.slice(0, 12) + '..' : p.productLabel,
              Target: p.target,
              'Offer Value': p.offerValue,
              'Won Value': p.wonValue,
            }))} barGap={2} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb40" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatLargeNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Target" fill={CHART_COLORS.target} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Offer Value" fill={CHART_COLORS.offerValue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Won Value" fill={CHART_COLORS.wonValue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── GROWTH INSIGHTS ─────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Growth Insights & Analysis
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ─ PERFORMANCE SUMMARY ─ */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-750">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Performance Summary</h3>
              </div>
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-full ${
                insights.performance.status === 'AHEAD' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
                insights.performance.status === 'ON_TRACK' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' :
                insights.performance.status === 'NEEDS_ATTENTION' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400' :
                'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
              }`}>
                {insights.performance.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {insights.performance.points.map((item, i) => (
                <InsightRow key={i} item={item} />
              ))}
            </div>
          </div>

          {/* ─ MONTHLY TRENDS ─ */}
          {insights.trends.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-cyan-50/50 to-blue-50/30 dark:from-cyan-900/10 dark:to-blue-900/10">
                <Activity className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Monthly Trends</h3>
                <span className="ml-auto text-xs text-gray-400">{insights.trends.length} insights</span>
              </div>
              <div className="p-4 space-y-2">
                {insights.trends.map((item, i) => (
                  <InsightRow key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ─ PRODUCT ANALYSIS ─ */}
          {insights.products.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-pink-50/50 to-purple-50/30 dark:from-pink-900/10 dark:to-purple-900/10">
                <Package className="w-4 h-4 text-pink-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Product Analysis</h3>
                <span className="ml-auto text-xs text-gray-400">{insights.products.length} insights</span>
              </div>
              <div className="p-4 space-y-2">
                {insights.products.map((item, i) => (
                  <InsightRow key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ─ PIPELINE & CONVERSION ─ */}
          {insights.conversion.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-amber-50/50 to-orange-50/30 dark:from-amber-900/10 dark:to-orange-900/10">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Pipeline & Conversion</h3>
                <span className="ml-auto text-xs text-gray-400">{insights.conversion.length} insights</span>
              </div>
              <div className="p-4 space-y-2">
                {insights.conversion.map((item, i) => (
                  <InsightRow key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ─ RECOMMENDATIONS ─ */}
          {insights.recommendations.length > 0 && (
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200/50 dark:border-indigo-700/30 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-indigo-200/30 dark:border-indigo-700/20">
                <Rocket className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Recommendations & Action Items</h3>
              </div>
              <div className="p-4 space-y-2.5">
                {insights.recommendations.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/40 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                    <div className="mt-0.5 p-1 rounded-md bg-indigo-100 dark:bg-indigo-900/40">
                      <Rocket className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FORECAST PIPELINE (PO Expected Month) ─────────────── */}
      {forecastLoading && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading forecast data...</span>
        </div>
      )}

      {!forecastLoading && forecastData?.po && (() => {
        const poGrandTotal = forecastData.po.overallTotals.grandTotal;
        const poZones = forecastData.po.zones || [];
        const poMonths = forecastData.po.months || [];
        // Find max month total for bar sizing
        const monthTotals = FULL_MONTHS.map((_, idx) => {
          const mk = poMonths[idx];
          if (!mk) return 0;
          return poZones.reduce((s: number, z: any) => s + (z.monthlyTotals[mk] || 0), 0);
        });
        const maxMonthTotal = Math.max(...monthTotals, 1);

        return (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
            {/* Section header — matches Product-wise Growth style */}
            <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                Forecast Pipeline
                {probability !== 'all' && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                    ≥{probability}%
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Pipeline: <span className="text-purple-700 dark:text-purple-300 font-bold">{formatCurrency(poGrandTotal)}</span></span>
                <span className="text-gray-500 dark:text-gray-400">{poZones.length} zones</span>
              </div>
            </div>

            {/* Expandable zone rows — like Product-wise Growth cards */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
              {poZones.map((zone: any, zIdx: number) => {
                const zoneShare = poGrandTotal > 0 ? (zone.grandTotal / poGrandTotal) * 100 : 0;
                const isExpanded = expandedForecastZones.has(zone.zoneId);
                // Per-zone month totals
                const zoneMonthTotals = FULL_MONTHS.map((_, idx) => {
                  const mk = poMonths[idx];
                  if (!mk) return 0;
                  return zone.monthlyTotals[mk] || 0;
                });
                const zoneMaxMonth = Math.max(...zoneMonthTotals, 1);
                // Top month for this zone
                const topMonthIdx = zoneMonthTotals.indexOf(Math.max(...zoneMonthTotals));

                return (
                  <div key={zone.zoneId}>
                    <button
                      onClick={() => toggleForecastZone(zone.zoneId)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-purple-600 text-white shadow-md' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'}`}>
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{zone.zoneName}</span>
                        <span className="text-xs text-gray-500">({zone.users?.length || 0} users)</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Pipeline: <span className="text-purple-700 dark:text-purple-300 font-medium">{formatCurrency(zone.grandTotal)}</span></span>
                        <span className="text-gray-500">Share: <span className="text-purple-700 dark:text-purple-300 font-medium">{zoneShare.toFixed(1)}%</span></span>
                        <span className="text-gray-500">Top Month: <span className="text-gray-800 dark:text-gray-200 font-medium">{MONTHS[topMonthIdx]}</span></span>
                        {/* Share bar */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(zoneShare, 100)}%` }} />
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${zoneShare >= 30 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : zoneShare >= 15 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {zoneShare.toFixed(1)}%
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded: Users with monthly columns — matching Product × Zone style */}
                    {isExpanded && (
                      <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                        <div className="overflow-x-auto overflow-hidden rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50">
                                <th className="text-left py-2.5 px-3 font-medium sticky left-0 bg-white/90 dark:bg-gray-800/90 z-10 min-w-[120px] border-r border-gray-200/50 dark:border-gray-700/30">Executive</th>
                                {poMonths.map((m: string) => (
                                  <th key={m} className="text-right py-2.5 px-2 font-medium min-w-[55px]">{m}</th>
                                ))}
                                <th className="text-right py-2.5 px-3 font-bold text-purple-700 dark:text-purple-400 min-w-[70px] bg-purple-50/30 dark:bg-purple-900/10">Total</th>
                                <th className="text-right py-2.5 px-3 font-medium min-w-[50px]">Share</th>
                              </tr>
                            </thead>
                            <tbody>
                              {zone.users?.map((user: any, uIdx: number) => {
                                const userShare = zone.grandTotal > 0 ? (user.total / zone.grandTotal) * 100 : 0;
                                return (
                                  <tr key={user.userId} className={`border-t border-gray-200/30 dark:border-gray-700/20 hover:bg-purple-50/30 dark:hover:bg-purple-900/5 transition-colors ${uIdx % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''}`}>
                                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium flex items-center gap-2 sticky left-0 bg-inherit z-10 border-r border-gray-200/50 dark:border-gray-700/30">
                                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">{user.userName?.[0] || 'U'}</div>
                                      {user.userName}
                                    </td>
                                    {poMonths.map((m: string) => {
                                      const mv = user.monthlyValues?.[m] || 0;
                                      return (
                                        <td key={m} className={`py-2.5 px-2 text-right font-medium ${mv > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                                          {mv > 0 ? formatCurrency(mv) : '—'}
                                        </td>
                                      );
                                    })}
                                    <td className="py-2.5 px-3 text-right font-bold text-purple-700 dark:text-purple-400 bg-purple-50/20 dark:bg-purple-900/5">{formatCurrency(user.total)}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <span className="text-gray-600 dark:text-gray-400">{userShare.toFixed(1)}%</span>
                                        <div className="w-10 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                          <div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(userShare, 100)}%` }} />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Zone total row */}
                              <tr className="border-t-2 border-purple-200 dark:border-purple-700/50 bg-purple-50/50 dark:bg-purple-900/10 font-semibold">
                                <td className="py-2.5 px-3 text-purple-900 dark:text-purple-100 sticky left-0 bg-purple-50/80 dark:bg-purple-900/20 z-10 border-r border-gray-200/50 dark:border-gray-700/30">Total</td>
                                {poMonths.map((m: string) => {
                                  const monthTotal = zone.monthlyTotals?.[m] || 0;
                                  return (
                                    <td key={m} className="py-2.5 px-2 text-right font-bold text-purple-800 dark:text-purple-200">
                                      {monthTotal > 0 ? formatCurrency(monthTotal) : '—'}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 px-3 text-right font-black text-purple-700 dark:text-purple-300 bg-purple-50/30 dark:bg-purple-900/10">{formatCurrency(zone.grandTotal)}</td>
                                <td className="py-2.5 px-3 text-right text-purple-800 dark:text-purple-200 font-bold">100%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Grand totals summary row */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 px-5 py-3.5 flex items-center justify-between border-t border-purple-200/50 dark:border-purple-700/30">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-purple-600" /> Total Pipeline
                </span>
                <div className="flex items-center gap-6 text-xs">
                  {poZones.map((z: any) => (
                    <span key={z.zoneId} className="text-gray-500">{z.zoneName}: <span className="text-purple-700 dark:text-purple-300 font-bold">{formatCurrency(z.grandTotal)}</span></span>
                  ))}
                  <span className="text-sm font-black text-purple-800 dark:text-purple-200 pl-2 border-l border-purple-300 dark:border-purple-600">{formatCurrency(poGrandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── FORECAST BY PRODUCT × ZONE ────────────────────── */}
      {!forecastLoading && forecastData?.puz && forecastData.puz.zones?.length > 0 && (() => {
        const puzZones = forecastData.puz.zones || [];
        const puzProducts = forecastData.puz.productTypes || [];
        const puzGrandTotal = puzZones.reduce((s: number, z: any) => s + z.zoneTotalValue, 0);
        // Compute per-product totals once
        const productTotalsMap = puzProducts.reduce((acc: Record<string, number>, product: any) => {
          acc[product.key] = puzZones.reduce((sum: number, zone: any) => {
            const row = zone.productMatrix?.find((p: any) => p.productType === product.key);
            return sum + (row?.total || 0);
          }, 0);
          return acc;
        }, {} as Record<string, number>);
        // Find top product
        const topProductKey = Object.keys(productTotalsMap).reduce((a, b) => (productTotalsMap[a] || 0) > (productTotalsMap[b] || 0) ? a : b, '');
        const topProduct = puzProducts.find((p: any) => p.key === topProductKey);

        return (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
            {/* Section header — matches Product-wise Growth style */}
            <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-500" />
                Forecast by Product × Zone
                {probability !== 'all' && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-[10px] font-bold">
                    ≥{probability}%
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Forecast: <span className="text-teal-700 dark:text-teal-300 font-bold">{formatCurrency(puzGrandTotal)}</span></span>
                <span className="text-gray-500 dark:text-gray-400">{puzProducts.length} products</span>
                <span className="text-gray-500 dark:text-gray-400">{puzZones.length} zones</span>
                {topProduct && <span className="text-gray-500 dark:text-gray-400">Top: <span className="text-teal-700 dark:text-teal-300 font-bold">{topProduct.label}</span></span>}
              </div>
            </div>

            {/* Expandable product rows — like Product-wise Growth */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
              {puzProducts.map((product: any, idx: number) => {
                const productTotal = productTotalsMap[product.key] || 0;
                const sharePercent = puzGrandTotal > 0 ? (productTotal / puzGrandTotal) * 100 : 0;
                const isProductExpanded = expandedProducts.has(`forecast_${product.key}`);

                return (
                  <div key={product.key}>
                    {/* Product header row */}
                    <button
                      onClick={() => toggleProduct(`forecast_${product.key}`)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.label}</span>
                        <span className="text-xs text-gray-500">({puzZones.filter((z: any) => {
                          const row = z.productMatrix?.find((p: any) => p.productType === product.key);
                          return row && row.total > 0;
                        }).length} zones)</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Forecast: <span className="text-teal-700 dark:text-teal-300 font-medium">{formatCurrency(productTotal)}</span></span>
                        <span className="text-gray-500">Share: <span className="text-gray-800 dark:text-gray-200 font-medium">{sharePercent.toFixed(1)}%</span></span>
                        {/* Share bar */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(sharePercent, 100)}%`, background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${sharePercent >= 25 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : sharePercent >= 10 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {sharePercent.toFixed(1)}%
                        </span>
                        {isProductExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded zone breakdown per product — with monthly columns */}
                    {isProductExpanded && (() => {
                      // Get monthly column headers from pwf data
                      const pwfMonths = forecastData?.pwf?.months || MONTHS;
                      // Build per-zone monthly data for this product from pwf
                      const zoneMonthlyForProduct: Record<number, Record<string, number>> = {};
                      if (forecastData?.pwf?.zones) {
                        forecastData.pwf.zones.forEach((pwfZone: any) => {
                          const monthlyVals: Record<string, number> = {};
                          pwfMonths.forEach((m: string) => { monthlyVals[m] = 0; });
                          pwfZone.users?.forEach((user: any) => {
                            const pd = user.products?.find((p: any) => p.productType === product.key);
                            if (pd) {
                              pwfMonths.forEach((m: string) => {
                                monthlyVals[m] += pd.monthlyValues?.[m] || 0;
                              });
                            }
                          });
                          zoneMonthlyForProduct[pwfZone.zoneId] = monthlyVals;
                        });
                      }
                      // Compute per-month totals across all zones for this product
                      const productMonthTotals: Record<string, number> = {};
                      pwfMonths.forEach((m: string) => {
                        productMonthTotals[m] = Object.values(zoneMonthlyForProduct).reduce((s, zv) => s + (zv[m] || 0), 0);
                      });

                      return (
                        <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                          <div className="overflow-x-auto overflow-hidden rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50">
                                  <th className="text-left py-2.5 px-3 font-medium sticky left-0 bg-white/90 dark:bg-gray-800/90 z-10 min-w-[100px] border-r border-gray-200/50 dark:border-gray-700/30">Zone</th>
                                  {pwfMonths.map((m: string) => (
                                    <th key={m} className="text-right py-2.5 px-2 font-medium min-w-[55px]">{m}</th>
                                  ))}
                                  <th className="text-right py-2.5 px-3 font-bold min-w-[70px] bg-teal-50/30 dark:bg-teal-900/10" style={{ color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }}>Total</th>
                                  <th className="text-right py-2.5 px-3 font-medium min-w-[50px]">Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {puzZones.map((zone: any, zIdx: number) => {
                                  const row = zone.productMatrix?.find((p: any) => p.productType === product.key);
                                  const value = row?.total || 0;
                                  const pctOfProduct = productTotal > 0 ? (value / productTotal) * 100 : 0;
                                  const zoneMonthVals = zoneMonthlyForProduct[zone.zoneId] || {};
                                  return (
                                    <tr key={zone.zoneId} className={`border-t border-gray-200/50 dark:border-gray-700/20 hover:bg-teal-50/30 dark:hover:bg-teal-900/5 transition-colors ${zIdx % 2 !== 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''}`}>
                                      <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-medium flex items-center gap-2 sticky left-0 bg-inherit z-10 border-r border-gray-200/50 dark:border-gray-700/30">
                                        <MapPin className="w-3 h-3 text-teal-500" />
                                        {zone.zoneName}
                                      </td>
                                      {pwfMonths.map((m: string) => {
                                        const mv = zoneMonthVals[m] || 0;
                                        return (
                                          <td key={m} className={`py-2.5 px-2 text-right font-medium ${mv > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                                            {mv > 0 ? formatCurrency(mv) : '—'}
                                          </td>
                                        );
                                      })}
                                      <td className="py-2.5 px-3 text-right font-bold bg-teal-50/20 dark:bg-teal-900/5" style={{ color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }}>
                                        {value > 0 ? formatCurrency(value) : '—'}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <span className="text-gray-600 dark:text-gray-400">{pctOfProduct > 0 ? `${pctOfProduct.toFixed(1)}%` : '—'}</span>
                                          <div className="w-10 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(pctOfProduct, 100)}%`, background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Product total row */}
                                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100/50 dark:bg-gray-700/30 font-semibold">
                                  <td className="py-2.5 px-3 text-gray-900 dark:text-white sticky left-0 bg-gray-100/80 dark:bg-gray-700/50 z-10 border-r border-gray-200/50 dark:border-gray-700/30">Total</td>
                                  {pwfMonths.map((m: string) => (
                                    <td key={m} className="py-2.5 px-2 text-right font-bold text-gray-800 dark:text-gray-200">
                                      {productMonthTotals[m] > 0 ? formatCurrency(productMonthTotals[m]) : '—'}
                                    </td>
                                  ))}
                                  <td className="py-2.5 px-3 text-right font-black bg-teal-50/30 dark:bg-teal-900/10" style={{ color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }}>{formatCurrency(productTotal)}</td>
                                  <td className="py-2.5 px-3 text-right text-gray-900 dark:text-white font-bold">{sharePercent.toFixed(1)}%</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {/* Grand totals summary row */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 px-5 py-3.5 flex items-center justify-between border-t border-teal-200/50 dark:border-teal-700/30">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-100 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-teal-600" /> Total Forecast
                </span>
                <div className="flex items-center gap-6 text-xs">
                  {puzZones.map((z: any) => (
                    <span key={z.zoneId} className="text-gray-500">{z.zoneName}: <span className="text-teal-700 dark:text-teal-300 font-bold">{formatCurrency(z.zoneTotalValue)}</span></span>
                  ))}
                  <span className="text-sm font-black text-teal-800 dark:text-teal-200 pl-2 border-l border-teal-300 dark:border-teal-600">{formatCurrency(puzGrandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
