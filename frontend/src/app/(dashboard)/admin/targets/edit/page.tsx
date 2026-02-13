'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/user.types';
import { apiService } from '@/services/api';
import { 
  ArrowLeft, Target, Save, Package, TrendingUp, AlertCircle, BarChart3,
  Building2, Users, CheckCircle, Sparkles, Zap, Crown, DollarSign, Activity, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { PRODUCT_TYPES, PRODUCT_TYPE_LABELS as CENTRAL_PRODUCT_TYPE_LABELS } from '@/types/reports';
import { Label } from '@/components/ui/label';

interface Target {
  id: number;
  serviceZoneId?: number;
  userId?: number;
  targetPeriod: string;
  periodType: 'MONTHLY' | 'YEARLY';
  productType?: string;
  targetValue: number;
  targetOfferCount?: number;
  actualValue?: number;
  achievement?: number;
  serviceZone?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

const PRODUCT_TYPE_CONFIG: { [key: string]: { label: string; icon: string; color: string; gradient: string } } = {
  'RELOCATION': { label: CENTRAL_PRODUCT_TYPE_LABELS.RELOCATION, icon: '🚚', color: 'blue', gradient: 'from-[#6F8A9D] to-[#6F8A9D]' },
  'CONTRACT': { label: CENTRAL_PRODUCT_TYPE_LABELS.CONTRACT, icon: '📋', color: 'emerald', gradient: 'from-[#82A094] to-[#82A094]' },
  'SPARE_PARTS': { label: CENTRAL_PRODUCT_TYPE_LABELS.SPARE_PARTS, icon: '🔧', color: 'purple', gradient: 'from-[#6F8A9D] to-[#6F8A9D]' },
  'KARDEX_CONNECT': { label: CENTRAL_PRODUCT_TYPE_LABELS.KARDEX_CONNECT, icon: '🔒', color: 'cyan', gradient: 'from-[#6F8A9D] to-cyan-600' },
  'UPGRADE_KIT': { label: CENTRAL_PRODUCT_TYPE_LABELS.UPGRADE_KIT, icon: '⬆️', color: 'amber', gradient: 'from-[#CE9F6B] to-[#976E44]' },
  'SOFTWARE': { label: CENTRAL_PRODUCT_TYPE_LABELS.SOFTWARE, icon: '💻', color: 'cyan', gradient: 'from-[#6F8A9D] to-cyan-600' },
  'OTHERS': { label: CENTRAL_PRODUCT_TYPE_LABELS.OTHERS, icon: '💰', color: 'rose', gradient: 'from-[#E17F70] to-[#9E3B47]' },
  'BD_SPARE': { label: CENTRAL_PRODUCT_TYPE_LABELS.BD_SPARE, icon: '🔩', color: 'indigo', gradient: 'from-[#6F8A9D] to-[#6F8A9D]' },
  'RETROFIT_KIT': { label: CENTRAL_PRODUCT_TYPE_LABELS.RETROFIT_KIT, icon: '🛠️', color: 'orange', gradient: 'from-[#CE9F6B] to-[#976E44]' },
};

export default function EditTargetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const targetType = (searchParams.get('type') || 'ZONE') as 'ZONE' | 'USER';
  const entityId = searchParams.get('id');
  const targetPeriod = searchParams.get('period') || '';
  const periodType = (searchParams.get('periodType') || 'YEARLY') as 'MONTHLY' | 'YEARLY';
  const targetId = searchParams.get('targetId');

  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entityName, setEntityName] = useState('');
  
  // For creating new targets
  const [newTargetValue, setNewTargetValue] = useState('');
  const [showProductTypes, setShowProductTypes] = useState(true);
  
  // Product types from backend enum
  const [productTargets, setProductTargets] = useState<{ [key: string]: string }>({});
  
  // NEW: Track input values as strings to prevent automatic value changes while typing
  const [inputValues, setInputValues] = useState<{ [key: number]: string }>({});

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
    if (entityId && targetPeriod && !authLoading && isAuthenticated && user?.role === UserRole.ADMIN) {
      fetchTargets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, targetPeriod, targetType, authLoading, isAuthenticated, user?.role]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const params = { 
        targetPeriod, 
        periodType: 'YEARLY', // Always fetch yearly targets for editing
        grouped: 'false' // Get individual targets, not grouped
      };
      
      let response;
      if (targetType === 'ZONE') {
        response = await apiService.getZoneTargets(params);
      } else {
        response = await apiService.getUserTargets(params);
      }
      
      const allTargets = response.targets || [];
      
      // Filter targets for the specific entity
      const entityTargets = allTargets.filter((target: Target) => 
        targetType === 'ZONE' 
          ? target.serviceZoneId === parseInt(entityId!)
          : target.userId === parseInt(entityId!)
      );
      
      // Only include targets that actually exist (have an ID)
      const existingTargets = entityTargets.filter((target: Target) => target.id);
      
      setTargets(existingTargets);
      
      // Initialize input values from existing targets
      // Handle floating point precision issues (e.g., 29999999.96 should be 30000000)
      const initialInputValues: { [key: number]: string } = {};
      existingTargets.forEach((target: Target) => {
        const rawValue = Number(target.targetValue);
        const rounded = Math.round(rawValue);
        
        // For large numbers (>= 1000), if close to a whole number (within 0.5), use the whole number
        // This handles precision issues like 29999999.96 -> 30000000
        let displayValue: number;
        if (Math.abs(rawValue) >= 1000 && Math.abs(rawValue - rounded) < 0.5) {
          displayValue = rounded;
        } else if (Math.abs(rawValue - rounded) < 0.01) {
          // For smaller numbers but very close to whole, also round
          displayValue = rounded;
        } else {
          // Otherwise round to 2 decimal places
          displayValue = Math.round(rawValue * 100) / 100;
        }
        
        initialInputValues[target.id] = Number.isInteger(displayValue) 
          ? displayValue.toString() 
          : displayValue.toFixed(2);
      });
      setInputValues(initialInputValues);
      
      // Set entity name
      if (existingTargets.length > 0) {
        const firstTarget = existingTargets[0];
        if (targetType === 'ZONE') {
          setEntityName(firstTarget.serviceZone?.name || 'Unknown Zone');
        } else {
          setEntityName(firstTarget.user?.name || firstTarget.user?.email || 'Unknown User');
        }
      } else {
        // If no targets exist, get entity name from the full list
        const entityData = allTargets.find((target: Target) => 
          targetType === 'ZONE' 
            ? target.serviceZoneId === parseInt(entityId!)
            : target.userId === parseInt(entityId!)
        );
        if (entityData) {
          if (targetType === 'ZONE') {
            setEntityName(entityData.serviceZone?.name || 'Unknown Zone');
          } else {
            setEntityName(entityData.user?.name || entityData.user?.email || 'Unknown User');
          }
        } else {
          // Fallback - fetch entity details directly
          setEntityName(targetType === 'ZONE' ? 'Zone' : 'User');
        }
      }
      
    } catch (error: any) {
      console.error('Failed to fetch targets:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch targets');
    } finally {
      setLoading(false);
    }
  };

  // Only allow numbers, dots, and empty string
  const sanitizeNumericInput = (value: string): string => {
    // Allow empty string
    if (value === '') return '';
    // Remove any character that is not a digit or dot
    let sanitized = value.replace(/[^0-9.]/g, '');
    // Ensure only one dot
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    return sanitized;
  };

  // Update input value (string) - only updates the display
  const updateInputValue = (targetId: number, value: string) => {
    const sanitized = sanitizeNumericInput(value);
    setInputValues(prev => ({
      ...prev,
      [targetId]: sanitized
    }));
  };
  
  // Get the parsed numeric value for a target
  const getTargetNumericValue = (targetId: number): number => {
    const value = inputValues[targetId];
    if (value === undefined || value === '') return 0;
    return parseFloat(value) || 0;
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    let successCount = 0;
    const errors: string[] = [];

    try {
      if (isCreatingNew) {
        // Create new targets
        const targetsToCreate = [];

        // Add overall target if specified
        if (newTargetValue) {
          targetsToCreate.push({
            targetPeriod,
            periodType: 'YEARLY',
            targetValue: parseFloat(newTargetValue),
            targetOfferCount: null,
            productType: null,
            label: 'Overall'
          });
        }

        // Add product-specific targets
        Object.entries(productTargets).forEach(([productType, value]) => {
          if (value) {
            targetsToCreate.push({
              targetPeriod,
              periodType: 'YEARLY',
              targetValue: parseFloat(value),
              targetOfferCount: null,
              productType,
              label: productType
            });
          }
        });

        if (targetsToCreate.length === 0) {
          toast.error('Please enter at least one target value');
          setSaving(false);
          return;
        }

        // Create all targets
        for (const targetData of targetsToCreate) {
          try {
            const createData = {
              targetPeriod: targetData.targetPeriod,
              periodType: targetData.periodType,
              targetValue: targetData.targetValue,
              targetOfferCount: targetData.targetOfferCount,
              productType: targetData.productType
            };

            if (targetType === 'ZONE') {
              await apiService.setZoneTarget({
                ...createData,
                serviceZoneId: parseInt(entityId!)
              });
            } else {
              await apiService.setUserTarget({
                ...createData,
                userId: parseInt(entityId!)
              });
            }
            
            successCount++;
          } catch (error: any) {
            errors.push(`${targetData.label}: ${error.response?.data?.message || 'Failed'}`);
          }
        }
      } else {
        // Update existing targets using inputValues
        for (const target of targets) {
          try {
            const targetValue = parseFloat(inputValues[target.id] || '0') || 0;
            const updateData = {
              targetValue: targetValue,
              targetOfferCount: target.targetOfferCount ? Number(target.targetOfferCount) : null
            };

            if (targetType === 'ZONE') {
              await apiService.updateZoneTarget(target.id, updateData);
            } else {
              await apiService.updateUserTarget(target.id, updateData);
            }
            
            successCount++;
          } catch (error: any) {
            const productLabel = target.productType || 'Overall';
            errors.push(`${productLabel}: ${error.response?.data?.message || 'Failed'}`);
          }
        }

        // Also create NEW product-specific targets that don't exist yet
        for (const [productType, value] of Object.entries(productTargets)) {
          if (value && parseFloat(value) > 0) {
            // Check if this product type doesn't have an existing target
            const existingTarget = targets.find(t => t.productType === productType);
            if (!existingTarget) {
              try {
                const createData = {
                  targetPeriod,
                  periodType: 'YEARLY',
                  targetValue: parseFloat(value),
                  targetOfferCount: null,
                  productType
                };

                if (targetType === 'ZONE') {
                  await apiService.setZoneTarget({
                    ...createData,
                    serviceZoneId: parseInt(entityId!)
                  });
                } else {
                  await apiService.setUserTarget({
                    ...createData,
                    userId: parseInt(entityId!)
                  });
                }
                
                successCount++;
              } catch (error: any) {
                errors.push(`${productType}: ${error.response?.data?.message || 'Failed to create'}`);
              }
            }
          }
        }
      }

      if (errors.length > 0) {
        toast.warning(`Updated ${successCount} targets. Some errors occurred: ${errors.join(', ')}`);
      } else {
        toast.success(`Successfully ${isCreatingNew ? 'created' : 'updated'} ${successCount} target(s)!`);
      }

      // Navigate back to targets page
      setTimeout(() => {
        router.push(`/admin/targets?type=${targetType}&period=${targetPeriod}&periodType=${periodType}`);
      }, 1500);
      
    } catch (error: any) {
      console.error('Failed to update targets:', error);
      toast.error('Failed to update targets: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-blue-50/30 to-[#96AEC2]/10/50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-16 text-center border border-[#AEBFC3]/20 relative overflow-hidden">
          {/* Animated gradient orb */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 w-24 h-24 border-4 border-[#96AEC2]/30 rounded-full"></div>
            <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-blue-600 border-r-blue-400/50 rounded-full animate-spin"></div>
            <div className="absolute inset-2 w-20 h-20 border-4 border-transparent border-b-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-[#5D6E73] font-bold text-xl">Loading targets...</p>
          <p className="text-[#757777] text-sm mt-2">Please wait while we fetch the data</p>
          <div className="flex justify-center gap-1 mt-4">
            <div className="w-2 h-2 bg-[#96AEC2]/100 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#546A7A]/100 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#6F8A9D]/100 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // If no targets exist, we'll create a form to set new targets
  const isCreatingNew = targets.length === 0;

  // Calculate summary for existing targets - use inputValues (user-typed) for target values
  const totalTarget = targets.reduce((sum, t) => sum + getTargetNumericValue(t.id), 0);
  const totalActual = targets.reduce((sum, t) => sum + (t.actualValue || 0), 0);
  const overallAchievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

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
          targetType === 'ZONE' 
            ? 'from-[#6F8A9D] via-[#6F8A9D] to-[#546A7A]' 
            : 'from-[#6F8A9D] via-pink-600 to-[#9E3B47]'
        }`}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#6F8A9D]/100/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" style={{ animation: 'pulse 3s ease-in-out infinite alternate' }}></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-5">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-white/20 backdrop-blur-xl p-4 rounded-2xl border border-white/30">
                  {targetType === 'ZONE' ? <Building2 className="w-10 h-10" /> : <Users className="w-10 h-10" />}
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold flex items-center gap-3">
                  {isCreatingNew ? 'Create Targets' : 'Edit Targets'}
                  <Sparkles className="w-8 h-8 text-[#CE9F6B] animate-pulse" />
                </h1>
                <p className="text-white/80 mt-2 text-lg">
                  {isCreatingNew ? 'Set yearly targets for' : 'Update yearly targets for'} <span className="font-bold text-white">{entityName}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 mt-6">
              <div className="bg-white/15 backdrop-blur-xl px-5 py-3 rounded-xl border border-white/20">
                <span className="text-white/70 text-sm">Type</span>
                <div className="font-bold flex items-center gap-2 mt-0.5">
                  {targetType === 'ZONE' ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  {targetType === 'ZONE' ? 'Zone Target' : 'User Target'}
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur-xl px-5 py-3 rounded-xl border border-white/20">
                <span className="text-white/70 text-sm">Period</span>
                <div className="font-bold mt-0.5">📆 {targetPeriod} (Yearly)</div>
              </div>
              <div className="bg-white/15 backdrop-blur-xl px-5 py-3 rounded-xl border border-white/20">
                <span className="text-white/70 text-sm">{isCreatingNew ? 'Action' : 'Targets'}</span>
                <div className="font-bold mt-0.5">{isCreatingNew ? '✨ Create New' : `📊 ${targets.length} Existing`}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {isCreatingNew ? (
            // Create new target form
            <>
              {/* Overall Target Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden hover:shadow-2xl transition-all">
                <div className="bg-gradient-to-r from-[#82A094] via-[#82A094] to-[#82A094] px-6 py-5">
                  <div className="flex items-center gap-4 text-white">
                    <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                      <TrendingUp className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Overall Yearly Target</h3>
                      <p className="text-emerald-100 text-sm mt-0.5">Set combined target for all product types</p>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <label className="block text-sm font-bold text-[#5D6E73] mb-3">
                    Target Value (₹) <span className="text-[#979796] font-normal">- Yearly total, will be divided by 12 for monthly view</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#979796] font-bold text-2xl">₹</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newTargetValue}
                      onChange={(e) => setNewTargetValue(sanitizeNumericInput(e.target.value))}
                      className="w-full pl-14 pr-6 py-5 border-2 border-[#92A2A5] rounded-xl focus:ring-4 focus:ring-[#82A094]/20 focus:border-[#82A094] text-2xl font-bold transition-all hover:border-emerald-300"
                      placeholder="5000000"
                    />
                  </div>
                  {newTargetValue && (
                    <p className="text-sm text-[#757777] mt-3 flex items-center gap-2">
                      <span className="px-2 py-1 bg-[#82A094]/10 rounded-lg text-[#4F6A64] font-medium">
                        📅 Monthly: {formatCurrency(parseFloat(newTargetValue) / 12)}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Product-Specific Targets Section */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden">
                <div className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] px-6 py-5">
                  <div className="flex items-center gap-4 text-white">
                    <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Product-Specific Targets</h3>
                      <p className="text-violet-100 text-sm mt-0.5">Set individual targets for each product type</p>
                    </div>
                  </div>
                </div>
                
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PRODUCT_TYPES.map((productType) => {
                      const config = PRODUCT_TYPE_CONFIG[productType];
                      return (
                        <div 
                          key={productType} 
                          className={`group relative bg-white border-2 rounded-xl p-5 hover:shadow-lg transition-all ${
                            productTargets[productType] ? `border-${config.color}-300 bg-${config.color}-50/30` : 'border-[#92A2A5] hover:border-[#92A2A5]'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}>
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-[#546A7A]">{config.label}</h4>
                              <p className="text-xs text-[#757777]">{config.icon} Product Type</p>
                            </div>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#979796] font-medium">₹</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={productTargets[productType] || ''}
                              onChange={(e) => setProductTargets({
                                ...productTargets,
                                [productType]: sanitizeNumericInput(e.target.value)
                              })}
                              className="w-full pl-8 pr-3 py-3 border-2 border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] font-semibold transition-all hover:border-[#6F8A9D]"
                              placeholder="Enter yearly target"
                            />
                          </div>
                          {productTargets[productType] && (
                            <p className="text-xs text-[#757777] mt-2">
                              📅 Monthly: {formatCurrency(parseFloat(productTargets[productType]) / 12)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Edit existing targets form
            <>
              {/* Summary Dashboard */}
              <div className="bg-gradient-to-br from-[#5D6E73] via-slate-800 to-[#5D6E73] rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8">
                  <div className="flex items-center gap-3 mb-6 text-white">
                    <div className="p-3 bg-white/10 backdrop-blur-xl rounded-xl">
                      <BarChart3 className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-bold">Performance Summary</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/10">
                      <div className="text-[#979796] text-sm font-semibold mb-2">Total Target</div>
                      <div className="text-3xl font-bold text-white">{formatCurrency(totalTarget)}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/10">
                      <div className="text-[#979796] text-sm font-semibold mb-2">Actual Value</div>
                      <div className="text-3xl font-bold text-[#A2B9AF]">{formatCurrency(totalActual)}</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/10">
                      <div className="text-[#979796] text-sm font-semibold mb-2">Achievement</div>
                      <div className={`text-3xl font-bold ${
                        overallAchievement >= 100 ? 'text-[#A2B9AF]' :
                        overallAchievement >= 75 ? 'text-[#CE9F6B]' : 'text-[#E17F70]'
                      }`}>
                        {overallAchievement.toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/10">
                      <div className="text-[#979796] text-sm font-semibold mb-2">Monthly Target</div>
                      <div className="text-3xl font-bold text-[#6F8A9D]">{formatCurrency(totalTarget / 12)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overall Target Card */}
              {targets.filter(t => !t.productType).map((target) => {
                const actualIndex = targets.findIndex(t => t.id === target.id);
                return (
                  <div key={target.id} className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden hover:shadow-2xl transition-all">
                    <div className="bg-gradient-to-r from-[#82A094] via-[#82A094] to-[#82A094] px-6 py-5">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                            <TrendingUp className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">Overall Yearly Target</h3>
                            <p className="text-emerald-100 text-sm mt-0.5">Combined target for all products</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-100 text-sm">Current Achievement</div>
                          <div className="text-2xl font-bold">{target.achievement?.toFixed(1) || 0}%</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-8">
                      <label className="block text-sm font-bold text-[#5D6E73] mb-3">
                        Target Value (₹) <span className="text-[#E17F70]">*</span>
                        <span className="text-[#979796] font-normal ml-2">Yearly total</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#979796] font-bold text-2xl">₹</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={inputValues[target.id] ?? ''}
                          onChange={(e) => updateInputValue(target.id, e.target.value)}
                          className="w-full pl-14 pr-6 py-5 border-2 border-[#92A2A5] rounded-xl focus:ring-4 focus:ring-[#82A094]/20 focus:border-[#82A094] text-2xl font-bold transition-all hover:border-emerald-300"
                          required
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-4 text-sm">
                        <span className="px-3 py-1.5 bg-[#82A094]/10 rounded-lg text-[#4F6A64] font-medium">
                          📅 Monthly: {formatCurrency(getTargetNumericValue(target.id) / 12)}
                        </span>
                        <span className="px-3 py-1.5 bg-[#96AEC2]/10 rounded-lg text-[#546A7A] font-medium">
                          💰 Actual: {formatCurrency(target.actualValue || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Product-Specific Targets */}
              <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 overflow-hidden">
                <div className="bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] px-6 py-5">
                  <div className="flex items-center gap-4 text-white">
                    <div className="p-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Product-Specific Targets</h3>
                      <p className="text-violet-100 text-sm mt-0.5">Update targets for individual product types</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PRODUCT_TYPES.map((productType) => {
                      const existingTarget = targets.find(t => t.productType === productType);
                      const hasTarget = !!existingTarget;
                      // For existing targets, use inputValues; for new targets, use productTargets
                      const targetInputValue = hasTarget 
                        ? (inputValues[existingTarget!.id] ?? '') 
                        : (productTargets[productType] || '');
                      const targetValue = hasTarget 
                        ? getTargetNumericValue(existingTarget!.id) 
                        : (parseFloat(productTargets[productType] || '0') || 0);
                      const actualValue = existingTarget?.actualValue || 0;
                      const achievement = targetValue > 0 ? (actualValue / targetValue) * 100 : 0;
                      const config = PRODUCT_TYPE_CONFIG[productType];
                      const hasNewValue = !hasTarget && productTargets[productType] && parseFloat(productTargets[productType]) > 0;
                      
                      return (
                        <div 
                          key={productType} 
                          className={`group relative rounded-xl p-5 transition-all ${
                            hasTarget 
                              ? 'bg-white border-2 border-[#6F8A9D] hover:border-[#6F8A9D] hover:shadow-xl' 
                              : hasNewValue
                                ? 'bg-[#A2B9AF]/10 border-2 border-[#82A094] hover:border-green-400 hover:shadow-xl'
                                : 'bg-white border-2 border-dashed border-[#92A2A5] hover:border-[#6F8A9D]'
                          }`}
                        >
                          {/* Header Section */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${hasTarget || hasNewValue ? `bg-gradient-to-br ${config.gradient}` : 'bg-[#92A2A5]'} shadow-md`}>
                                <Package className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h4 className="font-bold text-[#546A7A]">{config.label}</h4>
                                {!hasTarget && !hasNewValue && (
                                  <span className="text-xs text-[#546A7A] bg-[#96AEC2]/10 px-2 py-0.5 rounded-full font-medium">
                                    ✨ New Target
                                  </span>
                                )}
                                {hasNewValue && (
                                  <span className="text-xs text-[#4F6A64] bg-[#A2B9AF]/10 px-2 py-0.5 rounded-full font-medium">
                                    🆕 Will be created
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasTarget && (
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                achievement >= 100 ? 'bg-[#82A094]/20 text-[#4F6A64]' :
                                achievement >= 75 ? 'bg-[#CE9F6B]/20 text-[#976E44]' : 'bg-[#E17F70]/20 text-[#75242D]'
                              }`}>
                                {achievement.toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {/* Input Section */}
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-[#5D6E73]">
                              Yearly Target (₹) {hasTarget && <span className="text-[#E17F70]">*</span>}
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#979796] text-sm">₹</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={targetInputValue}
                                onChange={(e) => {
                                  const sanitized = sanitizeNumericInput(e.target.value);
                                  if (hasTarget && existingTarget) {
                                    updateInputValue(existingTarget.id, sanitized);
                                  } else {
                                    // Store new product target value
                                    setProductTargets(prev => ({
                                      ...prev,
                                      [productType]: sanitized
                                    }));
                                  }
                                }}
                                className="w-full pl-8 pr-3 py-3 border-2 rounded-lg font-semibold text-sm transition-all border-[#92A2A5] focus:ring-2 focus:ring-[#6F8A9D] focus:border-[#6F8A9D] hover:border-[#6F8A9D] bg-white"
                                required={hasTarget}
                                placeholder={hasTarget ? "Enter value" : "Enter to create new target"}
                              />
                            </div>
                            
                            {targetValue > 0 ? (
                              <div className="flex items-center gap-2 text-xs text-[#757777] mt-2">
                                <span className="px-2 py-1 bg-[#6F8A9D]/10 rounded text-[#546A7A]">
                                  📅 Monthly: {formatCurrency(targetValue / 12)}
                                </span>
                                {hasTarget && (
                                  <span className="px-2 py-1 bg-[#96AEC2]/10 rounded text-[#546A7A]">
                                    💰 Actual: {formatCurrency(actualValue)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-[#979796] mt-2">
                                💡 Enter a value to create a new target for this product
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="bg-white rounded-2xl shadow-xl border border-[#AEBFC3]/20 p-6">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-4 border-2 border-[#92A2A5] text-[#5D6E73] rounded-xl hover:bg-[#AEBFC3]/10 hover:border-[#92A2A5] font-bold text-lg transition-all"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 px-6 py-4 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl ${
                  targetType === 'ZONE' 
                    ? 'bg-gradient-to-r from-[#6F8A9D] to-[#6F8A9D] hover:from-[#546A7A] hover:to-[#546A7A]' 
                    : 'bg-gradient-to-r from-[#6F8A9D] to-[#9E3B47] hover:from-[#546A7A] hover:to-pink-700'
                }`}
                disabled={saving || (isCreatingNew && !newTargetValue && Object.values(productTargets).every(v => !v))}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    {isCreatingNew ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save className="w-6 h-6" />
                    {isCreatingNew 
                      ? 'Create Targets' 
                      : `Save Changes${Object.values(productTargets).some(v => v && parseFloat(v) > 0) ? ' & Create New' : ''}`
                    }
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
