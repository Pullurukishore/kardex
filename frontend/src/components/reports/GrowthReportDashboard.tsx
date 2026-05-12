import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Award, DollarSign, Calendar, 
  Filter, RefreshCw, Download, FileText, ChevronRight, ChevronDown, 
  ArrowUpRight, ArrowDownRight, Minus, AlertCircle, 
  Info, CheckCircle2, ShieldCheck, Activity, Package, MapPin, Zap, Rocket, 
  BarChart3, PieChart as PieChartIcon, Percent, Lightbulb
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie 
} from 'recharts';
import { apiService } from '@/services/api';
import { formatCurrency, formatLargeNumber } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { exportGrowthPillarToExcel } from '@/lib/growth-report-excel';
import { generateGrowthPillarPdf } from '@/lib/growth-report-pdf';
import { kardexBlue, kardexGreen, kardexSand, kardexGrey, kardexRed, chartColors } from '@/lib/kardex-colors';

// ─── CONSTANTS & TYPES ──────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PRODUCT_COLORS = chartColors;

const CHART_COLORS = {
  target: kardexBlue[2],
  offerValue: kardexSand[2],
  wonValue: kardexGreen[2],
  achievement: kardexBlue[1],
  growth: kardexGrey[3]
};

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
  // Performance metrics (matching forecast)
  openValue?: number;
  buMonthly?: number;
  percentDev?: number | null;
  offerBUMonth?: number;
  offerBUMonthDev?: number | null;
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
  // Summary totals for performance
  openValue?: number;
  buMonthly?: number;
  offerBUMonth?: number;
}

interface InsightItem {
  text: string;
  type: 'success' | 'warning' | 'danger' | 'info';
}

interface GrowthPillarData {
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
  insights: {
    performance: {
      status: string;
      points: InsightItem[];
    };
    trends: InsightItem[];
    products: InsightItem[];
    conversion: InsightItem[];
    recommendations: { text: string }[];
  };
  filters: {
    zones: { id: number; name: string }[];
    users: { id: number; name: string }[];
  };
}

const INSIGHT_CONFIG = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30', text: 'text-emerald-800 dark:text-emerald-300', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30', text: 'text-amber-800 dark:text-amber-300', icon: AlertCircle, iconColor: 'text-amber-500' },
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800/30', text: 'text-red-800 dark:text-red-300', icon: TrendingDown, iconColor: 'text-red-500' },
  info: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/30', text: 'text-indigo-800 dark:text-indigo-300', icon: Info, iconColor: 'text-indigo-500' },
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 shadow-xl rounded-lg backdrop-blur-md bg-opacity-90">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-xs text-gray-600 dark:text-gray-300">{entry.name}:</span>
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                {typeof entry.value === 'number' && entry.name.includes('%') ? `${entry.value}%` : 
                 typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const KPICard = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon className="w-12 h-12" style={{ color }} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{value}</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</span>
    </div>
    <div className="absolute bottom-0 left-0 w-full h-1" style={{ backgroundColor: `${color}40` }}>
      <div className="h-full" style={{ backgroundColor: color, width: '40%' }} />
    </div>
  </div>
);

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

// ─── PERFORMANCE HELPERS ────────────────────────────────────────────────
const getDeviationColor = (value: number | null) => {
  if (value === null) return 'text-gray-400';
  if (value >= 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= -25) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const getDeviationBg = (value: number | null) => {
  if (value === null) return 'bg-gray-100 dark:bg-gray-800/50';
  if (value >= 0) return 'bg-emerald-100/50 dark:bg-emerald-900/20';
  if (value >= -25) return 'bg-amber-100/50 dark:bg-amber-900/20';
  return 'bg-red-100/50 dark:bg-red-900/20';
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────
export default function GrowthReportDashboard() {
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GrowthPillarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromMonth, setFromMonth] = useState(1);
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [probability, setProbability] = useState<number | 'all'>('all');

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState<any>(null);
  const [expandedForecastZones, setExpandedForecastZones] = useState<Set<number>>(new Set());
  const [expandedForecastPuzZones, setExpandedForecastPuzZones] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { year, fromMonth, toMonth, zoneId, userId };
      const result = await apiService.getGrowthPillar(params);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load growth pillar:', err);
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  }, [year, fromMonth, toMonth, zoneId, userId]);

  const fetchForecastData = useCallback(async () => {
    try {
      setForecastLoading(true);
      const params: any = { year, fromMonth, toMonth };
      if (probability !== 'all') params.minProbability = probability;
      if (zoneId) params.zoneId = zoneId;
      if (userId) params.userId = userId;

      const [poData, puzData, pwfData, monthlyForecast] = await Promise.all([
        apiService.getPOExpectedMonthBreakdown(params),
        apiService.getProductUserZoneBreakdown(params),
        apiService.getProductWiseForecast(params).catch(() => null),
        userId 
          ? apiService.getUserMonthlyBreakdown({ year, zoneId, userId, minProbability: probability === 'all' ? undefined : probability }).catch(() => null)
          : apiService.getForecastMonthly({ year, zoneId }).catch(() => null)
      ]);
      
      setForecastData({ po: poData, puz: puzData, pwf: pwfData, monthly: monthlyForecast });
      if (poData?.zones) {
        setExpandedForecastZones(new Set(poData.zones.map((z: any) => z.zoneId)));
      }
    } catch (err) {
      console.error('Failed to load forecast data:', err);
    } finally {
      setForecastLoading(false);
    }
  }, [year, fromMonth, toMonth, probability, zoneId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchForecastData(); }, [fetchForecastData]);

  // Merge performance metrics from forecast into growth data
  const enrichedData = useMemo(() => {
    if (!data) return null;
    const enriched = JSON.parse(JSON.stringify(data));

    if (forecastData?.monthly) {
      // Get forecast monthly list based on active filters
      let forecastMonthly: any[] = [];
      if (userId) {
        forecastMonthly = forecastData.monthly.users?.find((u: any) => u.userId === userId)?.monthlyData || [];
      } else if (zoneId) {
        forecastMonthly = forecastData.monthly.zones?.find((z: any) => z.zoneId === zoneId)?.monthlyData || [];
      } else if (forecastData.monthly.zones) {
        // Aggregate zones if no specific filter
        const agg: Record<string, any> = {};
        forecastData.monthly.zones.forEach((z: any) => {
          z.monthlyData.forEach((m: any) => {
            if (!agg[m.monthLabel]) {
              agg[m.monthLabel] = { ...m };
            } else {
              agg[m.monthLabel].noOfOffers += m.noOfOffers;
              agg[m.monthLabel].offersValue += m.offersValue;
              agg[m.monthLabel].orderReceived += m.orderReceived;
              agg[m.monthLabel].ordersInHand += m.ordersInHand;
              agg[m.monthLabel].buMonthly += m.buMonthly;
              agg[m.monthLabel].offerBUMonth += m.offerBUMonth;
            }
          });
        });
        forecastMonthly = Object.values(agg).map(m => ({
          ...m,
          percentDev: m.buMonthly > 0 ? Math.round(((m.orderReceived - m.buMonthly) / m.buMonthly) * 100) : 0,
          offerBUMonthDev: m.offerBUMonth > 0 ? Math.round(((m.offersValue - m.offerBUMonth) / m.offerBUMonth) * 100) : 0
        }));
      }

      // Merge into monthlyData
      enriched.monthlyData = enriched.monthlyData.map((m: any) => {
        const fm = forecastMonthly.find(f => f.monthLabel === m.monthLabel || f.monthLabel?.startsWith(m.monthLabel?.slice(0, 3)));
        return fm ? { 
          ...m, 
          openValue: fm.ordersInHand, 
          buMonthly: fm.buMonthly, 
          percentDev: fm.percentDev, 
          offerBUMonth: fm.offerBUMonth, 
          offerBUMonthDev: fm.offerBUMonthDev 
        } : m;
      });

      // Enrich productData if available in forecast monthly breakdown
      let forecastProductMonthly: any[] | null = null;
      
      if (userId) {
        forecastProductMonthly = forecastData.monthly.users?.find((u: any) => u.userId === userId)?.productBreakdown || null;
      } else if (zoneId) {
        forecastProductMonthly = forecastData.monthly.zones?.find((z: any) => z.zoneId === zoneId)?.productBreakdown || null;
      } else if (forecastData.monthly.zones) {
        // Aggregate product breakdown across all zones
        const prodAgg: Record<string, any> = {};
        forecastData.monthly.zones.forEach((z: any) => {
          if (!z.productBreakdown) return;
          z.productBreakdown.forEach((pb: any) => {
            if (!prodAgg[pb.productType]) {
              prodAgg[pb.productType] = JSON.parse(JSON.stringify(pb));
            } else {
              // Aggregate totals
              prodAgg[pb.productType].totals.offersValue += pb.totals?.offersValue || 0;
              prodAgg[pb.productType].totals.orderReceived += pb.totals?.orderReceived || 0;
              prodAgg[pb.productType].totals.ordersInHand += pb.totals?.ordersInHand || 0;
              prodAgg[pb.productType].totals.buMonthly += pb.totals?.buMonthly || 0;
              prodAgg[pb.productType].totals.offerBUMonth += pb.totals?.offerBUMonth || 0;

              // Aggregate monthly data
              pb.monthlyData?.forEach((m: any) => {
                const existingMonth = prodAgg[pb.productType].monthlyData.find((em: any) => em.monthLabel === m.monthLabel);
                if (existingMonth) {
                  existingMonth.noOfOffers += m.noOfOffers || 0;
                  existingMonth.offersValue += m.offersValue || 0;
                  existingMonth.orderReceived += m.orderReceived || 0;
                  existingMonth.ordersInHand += m.ordersInHand || 0;
                  existingMonth.buMonthly += m.buMonthly || 0;
                  existingMonth.offerBUMonth += m.offerBUMonth || 0;
                }
              });
            }
          });
        });
        
        // Recalculate deviations for aggregated products
        forecastProductMonthly = Object.values(prodAgg).map((p: any) => ({
          ...p,
          monthlyData: p.monthlyData.map((m: any) => ({
            ...m,
            percentDev: m.buMonthly > 0 ? Math.round(((m.orderReceived - m.buMonthly) / m.buMonthly) * 100) : 0,
            offerBUMonthDev: m.offerBUMonth > 0 ? Math.round(((m.offersValue - m.offerBUMonth) / m.offerBUMonth) * 100) : 0
          }))
        }));
      }

      if (forecastProductMonthly) {
        enriched.productData = enriched.productData.map((p: any) => {
          const fp = forecastProductMonthly?.find((f: any) => f.productType === p.productType);
          if (fp) {
            return {
              ...p,
              openValue: fp.totals?.ordersInHand,
              buMonthly: fp.totals?.buMonthly,
              offerBUMonth: fp.totals?.offerBUMonth,
              monthlyData: p.monthlyData.map((pm: any) => {
                const fpm = fp.monthlyData?.find((f: any) => f.monthLabel === pm.monthLabel || f.monthLabel?.startsWith(pm.monthLabel?.slice(0, 3)));
                return fpm ? {
                  ...pm,
                  openValue: fpm.ordersInHand,
                  buMonthly: fpm.buMonthly,
                  percentDev: fpm.percentDev,
                  offerBUMonth: fpm.offerBUMonth,
                  offerBUMonthDev: fpm.offerBUMonthDev
                } : pm;
              })
            };
          }
          return p;
        });
      }
    }
    return enriched;
  }, [data, forecastData, zoneId, userId]);

  const toggleForecastZone = (id: number) => {
    setExpandedForecastZones((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleForecastPuzZone = (productKey: string, zoneId: number) => {
    const key = `${productKey}_${zoneId}`;
    setExpandedForecastPuzZones((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleProduct = (productType: string) => {
    setExpandedProducts((prev: Set<string>) => {
      const next = new Set(prev);
      next.has(productType) ? next.delete(productType) : next.add(productType);
      return next;
    });
  };

  const handleExportPdf = async () => {
    if (!enrichedData) return;
    try {
      setPdfLoading(true);
      await generateGrowthPillarPdf(enrichedData as any);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!enrichedData) return;
    try {
      setExcelLoading(true);
      const exportData = {
        ...enrichedData,
        filters: {
          ...enrichedData.filters,
          probability: probability // Pass current probability filter
        },
        forecastData: forecastData // Include forecast pipeline and product breakdown for extra sheets
      };
      await exportGrowthPillarToExcel(exportData as any);
    } catch (err) {
      console.error('Excel generation failed:', err);
    } finally {
      setExcelLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    </div>
  );
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

  if (!enrichedData) return null;

  const { totals, monthlyData, productData, insights, filters } = enrichedData;

  // Prepare chart data
  const barChartData = monthlyData.map((d: MonthData) => ({
    name: d.monthLabel.slice(0, 3),
    Target: d.target,
    'Offer Value': d.offerValue,
    'Won Value': d.wonValue,
  }));

  const achievementChartData = monthlyData.map((d: MonthData) => ({
    name: d.monthLabel.slice(0, 3),
    'Achieved %': d.achievementPercent,
    'Hit Rate %': d.hitRatePercent,
  }));

  const growthChartData = monthlyData.filter((d: MonthData) => d.growthPercent !== null).map((d: MonthData) => ({
    name: d.monthLabel.slice(0, 3),
    'Growth %': d.growthPercent,
  }));

  const productPieData = productData.map((p: ProductData, i: number) => ({
    name: p.productLabel,
    value: p.wonValue,
    color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
  })).filter((p: any) => p.value > 0);

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
            {zoneId && filters.zones.length > 0 ? ` • ${filters.zones.find((z: any) => z.id === zoneId)?.name || 'Zone'}` : ' • All Zones'}
            {userId && filters.users.length > 0 ? ` • ${filters.users.find((u: any) => u.id === userId)?.name || 'User'}` : ''}
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
                {filters.zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            {/* User (only when zone selected) */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">User</label>
              <select value={userId || ''} onChange={e => setUserId(e.target.value ? Number(e.target.value) : null)} disabled={!zoneId} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">All Users</option>
                {filters.users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Target" value={formatCurrency(totals.target)} subtitle={`${totals.offerCount} offers`} icon={Target} color={kardexBlue[2]} />
        <KPICard title="Offer Value" value={formatCurrency(totals.offerValue)} subtitle={`${totals.offerCount} offers created`} icon={DollarSign} color={kardexSand[2]} />
        <KPICard title="Won Value" value={formatCurrency(totals.wonValue)} subtitle={`${totals.wonCount} orders won`} icon={Award} color={kardexGreen[2]} />
        <KPICard 
          title="Achieved" 
          value={`${totals.achievementPercent.toFixed(1)}%`} 
          subtitle="Won / Target" 
          icon={TrendingUp} 
          color={kardexBlue[1]} 
          trend={totals.achievementPercent >= 100 ? 'up' : totals.achievementPercent >= 70 ? 'neutral' : 'down'} 
        />
        <KPICard title="Hit Rate" value={`${totals.hitRatePercent.toFixed(0)}%`} subtitle="Won / Offer Value" icon={Percent} color={kardexGrey[3]} />
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
            <TrendingUp className="w-4 h-4 text-cyan-500" /> Achieved & Hit Rate Trend
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
              <Area type="monotone" dataKey="Achieved %" stroke={CHART_COLORS.achievement} fill="url(#gradAchievement)" strokeWidth={2} dot={{ r: 3 }} />
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
                  {productPieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
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
            <Calendar className="w-4 h-4 text-[#96AEC2]" /> Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                <th className="text-left px-3 py-3 font-semibold sticky left-0 bg-inherit z-10">Month</th>
                <th className="text-right px-2 py-3 font-semibold">Offer Value</th>
                <th className="text-right px-2 py-3 font-semibold">Won Value</th>
                <th className="text-right px-2 py-3 font-semibold">Open Offer Funnel</th>
                <th className="text-right px-2 py-3 font-semibold bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">BU/Mo</th>
                <th className="text-center px-2 py-3 font-semibold">%Dev</th>
                <th className="text-right px-2 py-3 font-semibold bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">OfferBU</th>
                <th className="text-center px-2 py-3 font-semibold">%Dev</th>
                <th className="text-right px-2 py-3 font-semibold">Achieved</th>
                <th className="text-right px-2 py-3 font-semibold">Hit Rate</th>
                <th className="text-right px-2 py-3 font-semibold">Growth</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d: MonthData, i: number) => (
                <tr key={d.month} className={`border-t border-gray-100 dark:border-gray-700/30 ${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750/30'} hover:bg-[#96AEC2]/5 dark:hover:bg-[#96AEC2]/5 transition-colors`}>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-inherit z-10">{d.monthLabel}</td>
                  <td className="px-2 py-2 text-right text-[#CE9F6B] font-medium">{formatCurrency(d.offerValue)}</td>
                  <td className="px-2 py-2 text-right text-[#82A094] font-medium">{formatCurrency(d.wonValue)}</td>
                  <td className="px-2 py-2 text-right text-[#6F8A9D] font-medium">{d.openValue ? formatCurrency(d.openValue) : '—'}</td>
                  <td className="px-2 py-2 text-right bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5 text-gray-700 dark:text-gray-300">{d.buMonthly ? formatCurrency(d.buMonthly) : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    {d.percentDev !== undefined && d.percentDev !== null ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(d.percentDev)} ${getDeviationColor(d.percentDev)}`}>
                        {d.percentDev > 0 ? '+' : ''}{d.percentDev}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5 text-gray-700 dark:text-gray-300">{d.offerBUMonth ? formatCurrency(d.offerBUMonth) : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    {d.offerBUMonthDev !== undefined && d.offerBUMonthDev !== null ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getDeviationBg(d.offerBUMonthDev)} ${getDeviationColor(d.offerBUMonthDev)}`}>
                        {d.offerBUMonthDev > 0 ? '+' : ''}{d.offerBUMonthDev}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${d.achievementPercent >= 100 ? 'bg-[#82A094]/20 text-[#4F6A64]' : d.achievementPercent >= 50 ? 'bg-[#CE9F6B]/20 text-[#976E44]' : 'bg-[#E17F70]/20 text-[#75242D]'}`}>
                      {d.achievementPercent}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 dark:text-gray-300">{d.hitRatePercent}%</td>
                  <td className="px-2 py-2 text-right">
                    {d.growthPercent !== null ? (
                      <span className={`inline-flex items-center gap-0.5 ${d.growthPercent >= 0 ? 'text-[#82A094]' : 'text-[#E17F70]'}`}>
                        {d.growthPercent >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {Math.abs(d.growthPercent)}%
                      </span>
                    ) : (
                      <span className="text-gray-400"><Minus className="w-2.5 h-2.5 inline" /></span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/70 font-semibold">
                <td className="px-3 py-3 text-gray-900 dark:text-white sticky left-0 bg-inherit z-10">Total</td>
                <td className="px-2 py-3 text-right text-[#976E44]">{formatCurrency(totals.offerValue)}</td>
                <td className="px-2 py-3 text-right text-[#4F6A64]">{formatCurrency(totals.wonValue)}</td>
                <td className="px-2 py-3 text-right text-[#546A7A]">
                  {formatCurrency(monthlyData.reduce((s: number, m: MonthData) => s + (m.openValue || 0), 0))}
                </td>
                <td className="px-2 py-3 text-right text-gray-900 dark:text-white bg-[#96AEC2]/15">
                  {formatCurrency(monthlyData.reduce((s: number, m: MonthData) => s + (m.buMonthly || 0), 0))}
                </td>
                <td className="px-2 py-3 text-center">—</td>
                <td className="px-2 py-3 text-right text-gray-900 dark:text-white bg-[#96AEC2]/15">
                  {formatCurrency(monthlyData.reduce((s: number, m: MonthData) => s + (m.offerBUMonth || 0), 0))}
                </td>
                <td className="px-2 py-3 text-center">—</td>
                <td className="px-2 py-3 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${totals.achievementPercent >= 100 ? 'bg-[#82A094]/30 text-[#4F6A64]' : 'bg-[#96AEC2]/30 text-[#546A7A]'}`}>
                    {totals.achievementPercent}%
                  </span>
                </td>
                <td className="px-2 py-3 text-right text-gray-900 dark:text-white">{totals.hitRatePercent}%</td>
                <td className="px-2 py-3 text-right text-gray-400">—</td>
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

          <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
            {productData.map((p: ProductData, idx: number) => (
              <div key={p.productType}>
                <button
                  onClick={() => toggleProduct(p.productType)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.productLabel}</span>
                    <span className="text-xs text-gray-500">({p.offerCount} offers)</span>
                  </div>
                  <div className="flex items-center gap-6 text-[11px]">
                    <span className="text-gray-500">Target: <span className="text-gray-800 dark:text-gray-200 font-medium">{formatCurrency(p.target)}</span></span>
                    <span className="text-gray-500">Won: <span className="text-emerald-600 font-medium">{formatCurrency(p.wonValue)}</span></span>
                    <span className="text-gray-500">Open: <span className="text-indigo-600 font-medium">{p.openValue ? formatCurrency(p.openValue) : '—'}</span></span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${p.achievementPercent >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : p.achievementPercent >= 50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {p.achievementPercent}%
                    </span>
                    {expandedProducts.has(p.productType) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {expandedProducts.has(p.productType) && (
                  <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                    <div className="overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                      <table className="w-full text-[10px] mt-1">
                        <thead>
                          <tr className="bg-white/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                            <th className="text-left py-2 px-3 font-semibold">Month</th>
                            <th className="text-right py-2 px-2 font-semibold">Offer Value</th>
                            <th className="text-right py-2 px-2 font-semibold">Won Value</th>
                            <th className="text-right py-2 px-2 font-semibold">Open Offer Funnel</th>
                            <th className="text-right py-2 px-2 font-semibold bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">BU/Mo</th>
                            <th className="text-center py-2 px-2 font-semibold">%Dev</th>
                            <th className="text-right py-2 px-2 font-semibold bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">OfferBU</th>
                            <th className="text-center py-2 px-2 font-semibold">%Dev</th>
                            <th className="text-right py-2 px-2 font-semibold">Achieved</th>
                            <th className="text-right py-2 px-2 font-semibold">Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.monthlyData.map((md: MonthData) => (
                            <tr key={md.month} className="border-t border-gray-100 dark:border-gray-700/20 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
                              <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">{md.monthLabel.slice(0, 3)}</td>
                              <td className="py-2 px-2 text-right text-amber-600/80">{formatCurrency(md.offerValue)}</td>
                              <td className="py-2 px-2 text-right text-emerald-600/80 font-medium">{formatCurrency(md.wonValue)}</td>
                              <td className="py-2 px-2 text-right text-indigo-600/80">{md.openValue ? formatCurrency(md.openValue) : '—'}</td>
                              <td className="py-2 px-2 text-right bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">{md.buMonthly ? formatCurrency(md.buMonthly) : '—'}</td>
                              <td className="py-2 px-2 text-center">
                                {md.percentDev !== undefined && md.percentDev !== null ? (
                                  <span className={`px-1 rounded-sm font-bold ${getDeviationColor(md.percentDev)}`}>
                                    {md.percentDev > 0 ? '+' : ''}{md.percentDev}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right bg-[#96AEC2]/10 dark:bg-[#96AEC2]/5">{md.offerBUMonth ? formatCurrency(md.offerBUMonth) : '—'}</td>
                              <td className="py-2 px-2 text-center">
                                {md.offerBUMonthDev !== undefined && md.offerBUMonthDev !== null ? (
                                  <span className={`px-1 rounded-sm font-bold ${getDeviationColor(md.offerBUMonthDev)}`}>
                                    {md.offerBUMonthDev > 0 ? '+' : ''}{md.offerBUMonthDev}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={`${md.achievementPercent >= 100 ? 'text-[#82A094]' : md.achievementPercent >= 50 ? 'text-[#CE9F6B]' : 'text-[#E17F70]'} font-medium`}>
                                  {md.achievementPercent}%
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right">
                                {md.growthPercent !== null ? (
                                  <span className={`inline-flex items-center gap-0.5 ${md.growthPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {md.growthPercent >= 0 ? '+' : ''}{md.growthPercent}%
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
            <BarChart data={productData.map((p: ProductData) => ({
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
              {insights.performance.points.map((item: InsightItem, i: number) => (
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
                {insights.trends.map((item: InsightItem, i: number) => (
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
                {insights.products.map((item: InsightItem, i: number) => (
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
                {insights.conversion.map((item: InsightItem, i: number) => (
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
                {insights.recommendations.map((item: { text: string }, i: number) => (
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
        
        return (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" /> Forecast Pipeline
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

            <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
              {poZones.map((zone: any, zIdx: number) => {
                const zoneShare = poGrandTotal > 0 ? (zone.grandTotal / poGrandTotal) * 100 : 0;
                const isExpanded = expandedForecastZones.has(zone.zoneId);
                const zColor = PRODUCT_COLORS[zIdx % PRODUCT_COLORS.length];

                return (
                  <div key={zone.zoneId}>
                    <button
                      onClick={() => toggleForecastZone(zone.zoneId)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${isExpanded ? 'text-white' : ''}`} style={{ background: isExpanded ? zColor : `${zColor}15`, color: isExpanded ? 'white' : zColor }}>
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{zone.zoneName}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Pipeline: <span className="font-medium" style={{ color: zColor }}>{formatCurrency(zone.grandTotal)}</span></span>
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(zoneShare, 100)}%`, background: zColor }} />
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${zoneShare >= 30 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                          {zoneShare.toFixed(1)}%
                        </span>
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                        <div className="overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-white/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase">
                                <th className="text-left py-2 px-3 font-semibold sticky left-0 bg-inherit z-10 border-r border-gray-200/50">Executive</th>
                                {poMonths.map((m: string) => (
                                  <th key={m} className="text-right py-2 px-2 font-semibold">{m}</th>
                                ))}
                                <th className="text-right py-2 px-3 font-bold bg-gray-50/50" style={{ color: zColor }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {zone.users?.map((user: any) => (
                                <tr key={user.userId} className="border-t border-gray-100 dark:border-gray-700/20 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                  <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-inherit z-10 border-r border-gray-200/50">{user.userName}</td>
                                  {poMonths.map((m: string) => (
                                    <td key={m} className="py-2 px-2 text-right">{user.monthlyValues?.[m] ? formatCurrency(user.monthlyValues[m]) : '—'}</td>
                                  ))}
                                  <td className="py-2 px-3 text-right font-bold" style={{ color: zColor }}>{formatCurrency(user.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── FORECAST BY PRODUCT × ZONE ────────────────────── */}
      {!forecastLoading && forecastData?.puz && forecastData.puz.zones?.length > 0 && (() => {
        const puzZones = forecastData.puz.zones || [];
        const puzProducts = forecastData.puz.productTypes || [];
        const puzGrandTotal = puzZones.reduce((s: number, z: any) => s + z.zoneTotalValue, 0);

        return (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-500" /> Forecast by Product × Zone
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total: <span className="text-teal-700 dark:text-teal-300 font-bold">{formatCurrency(puzGrandTotal)}</span>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700/30">
              {puzProducts.map((product: any, idx: number) => {
                const productTotal = puzZones.reduce((sum: number, zone: any) => {
                  const row = zone.productMatrix?.find((p: any) => p.productType === product.key);
                  return sum + (row?.total || 0);
                }, 0);
                const sharePercent = puzGrandTotal > 0 ? (productTotal / puzGrandTotal) * 100 : 0;
                const isProductExpanded = expandedProducts.has(`forecast_${product.key}`);

                return (
                  <div key={product.key}>
                    <button
                      onClick={() => toggleProduct(`forecast_${product.key}`)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }} />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.label}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Value: <span className="text-teal-700 dark:text-teal-300 font-medium">{formatCurrency(productTotal)}</span></span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{sharePercent.toFixed(1)}%</span>
                        {isProductExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {isProductExpanded && (
                      <div className="bg-gray-50/50 dark:bg-gray-900/20 px-5 pb-3">
                        <div className="overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-700/30">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-white/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase">
                                <th className="text-left py-2 px-3 font-semibold border-r border-gray-200/50">Zone</th>
                                <th className="text-right py-2 px-3 font-bold" style={{ color: PRODUCT_COLORS[idx % PRODUCT_COLORS.length] }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {puzZones.map((zone: any) => {
                                const row = zone.productMatrix?.find((p: any) => p.productType === product.key);
                                if (!row || row.total === 0) return null;
                                return (
                                  <tr key={zone.zoneId} className="border-t border-gray-100 dark:border-gray-700/20 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                    <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200 border-r border-gray-200/50">{zone.zoneName}</td>
                                    <td className="py-2 px-3 text-right font-semibold">{formatCurrency(row.total)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
