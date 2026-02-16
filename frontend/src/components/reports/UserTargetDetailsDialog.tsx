'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, DollarSign, TrendingUp, TrendingDown, Package, Mail } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from 'sonner';
import { formatCrLakh, formatINRFull } from '@/lib/format';
import { PRODUCT_TYPE_LABELS } from '@/types/reports';

interface UserTargetDetailsDialogProps {
  userId: number;
  targetPeriod: string;
  periodType: 'MONTHLY' | 'YEARLY';
  open: boolean;
  onClose: () => void;
}

interface UserTargetDetail {
  productType: string;
  targetValue: number;
  targetOfferCount: number;
  actualValue: number;
  actualOfferCount: number;
  achievement: number;
  variance: number;
  variancePercentage: number;
}

const UserTargetDetailsDialog: React.FC<UserTargetDetailsDialogProps> = ({
  userId,
  targetPeriod,
  periodType,
  open,
  onClose,
}) => {
  const [targets, setTargets] = useState<UserTargetDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (open && userId) {
      fetchUserTargetDetails();
    } else {
      setTargets([]);
      setSummary(null);
      setUser(null);
    }
  }, [open, userId, targetPeriod, periodType]);

  const fetchUserTargetDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching user target details for:', { userId, targetPeriod, periodType });

      const response = await apiService.getUserTargetDetails(
        userId,
        { targetPeriod, periodType }
      );

      console.log('User target details response:', response);

      if (response.success && response.data) {
        // Backend returns { user, targets, summary, period }
        const detailsData = response.data.targets || [];
        console.log('Setting targets:', detailsData);
        setTargets(detailsData);
        setUser(response.data.user);

        // Use summary from backend if available, otherwise calculate
        if (response.data.summary) {
          setSummary(response.data.summary);
        } else {
          const totalTarget = detailsData.reduce((sum: number, t: any) => sum + t.targetValue, 0);
          const totalActual = detailsData.reduce((sum: number, t: any) => sum + t.actualValue, 0);
          const totalOffers = detailsData.reduce((sum: number, t: any) => sum + (t.actualOfferCount || 0), 0);

          setSummary({
            totalTarget,
            totalActual,
            totalOffers,
            achievement: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0,
            variance: totalActual - totalTarget,
          });
        }
      } else {
        console.error('Invalid response:', response);
        toast.error('Failed to load user target details');
      }
    } catch (error: any) {
      console.error('Error fetching user target details:', error);
      toast.error(error?.response?.data?.error || 'Failed to load user target details');
    } finally {
      setLoading(false);
    }
  };

  const getAchievementColor = (achievement: number) => {
    if (achievement >= 100) return 'bg-[#A2B9AF]/20 text-[#4F6A64]';
    if (achievement >= 80) return 'bg-[#96AEC2]/20 text-[#546A7A]';
    if (achievement >= 50) return 'bg-[#CE9F6B]/20 text-[#976E44]';
    return 'bg-[#E17F70]/20 text-[#75242D]';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-[#546A7A]" />
            User Target Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="px-6 py-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#546A7A]" />
              </div>
            ) : targets.length > 0 && summary && user ? (
              <>
                {/* User Header - No Zone Information */}
                <div className="bg-gradient-to-r from-[#6F8A9D]/10 to-[#EEC1BF]/10 p-6 rounded-lg border border-[#6F8A9D]/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-[#5D6E73]">User</div>
                      <div className="font-bold text-2xl text-[#546A7A]">{user?.name}</div>
                      <div className="text-sm text-[#5D6E73] flex items-center gap-1 mt-2">
                        <Mail className="h-4 w-4" />
                        {user?.email}
                      </div>
                      <div className="text-xs text-[#AEBFC3]0 mt-1">
                        📅 Period: {targetPeriod} ({periodType})
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-[#5D6E73] mb-2">Overall Achievement</div>
                        <Badge className={getAchievementColor(summary.totalAchievement || 0)}>
                          {(summary.totalAchievement || 0).toFixed(2)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-[#92A2A5] p-4">
                    <div className="text-sm font-medium text-[#5D6E73] mb-2">Target Value</div>
                    <div className="text-2xl font-bold text-[#546A7A]" title={formatINRFull(summary.totalTargetValue)}>
                      {formatCrLakh(summary.totalTargetValue)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#92A2A5] p-4">
                    <div className="text-sm font-medium text-[#5D6E73] mb-2">Actual Value</div>
                    <div className="text-2xl font-bold text-[#4F6A64]" title={formatINRFull(summary.totalActualValue)}>
                      {formatCrLakh(summary.totalActualValue)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#92A2A5] p-4">
                    <div className="text-sm font-medium text-[#5D6E73] mb-2">Variance</div>
                    <div className={`text-2xl font-bold flex items-center gap-1 ${(summary.totalActualValue - summary.totalTargetValue) >= 0 ? 'text-[#4F6A64]' : 'text-[#9E3B47]'
                      }`}>
                      {(summary.totalActualValue - summary.totalTargetValue) >= 0 ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                      <span title={formatINRFull(Math.abs(summary.totalActualValue - summary.totalTargetValue))}>
                        {formatCrLakh(Math.abs(summary.totalActualValue - summary.totalTargetValue))}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-[#92A2A5] p-4">
                    <div className="text-sm font-medium text-[#5D6E73] mb-2">Total Targets</div>
                    <div className="text-2xl font-bold text-[#546A7A]">
                      {summary.totalTargets}
                    </div>
                  </div>
                </div>

                {/* Product Type Breakdown - Cards */}
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-[#546A7A]" />
                    Product Type Breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {targets.map((target, idx) => (
                      <div
                        key={`${target.productType}-${idx}`}
                        className="bg-white rounded-lg border border-[#92A2A5] hover:border-[#6F8A9D] hover:shadow-md transition-all p-4"
                      >
                        {/* Product Type Header */}
                        <div className="flex items-center justify-between mb-4">
                          <Badge variant="outline" className="text-sm">
                            {target.productType ? (PRODUCT_TYPE_LABELS[target.productType] || target.productType) : 'Overall'}
                          </Badge>
                          <div className="text-xs text-[#AEBFC3]0">
                            {target.actualOfferCount || 0} offers
                          </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {/* Target */}
                          <div className="bg-[#96AEC2]/10 rounded p-2">
                            <div className="text-xs text-[#546A7A] font-medium mb-1">Target</div>
                            <div className="text-sm font-bold text-[#546A7A]" title={formatINRFull(target.targetValue)}>
                              {formatCrLakh(target.targetValue)}
                            </div>
                          </div>

                          {/* Actual */}
                          <div className="bg-[#A2B9AF]/10 rounded p-2">
                            <div className="text-xs text-[#4F6A64] font-medium mb-1">Actual</div>
                            <div className="text-sm font-bold text-[#4F6A64]" title={formatINRFull(target.actualValue)}>
                              {formatCrLakh(target.actualValue)}
                            </div>
                          </div>
                        </div>

                        {/* Achievement and Variance */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Achievement */}
                          <div className="bg-[#6F8A9D]/10 rounded p-2">
                            <div className="text-xs text-[#546A7A] font-medium mb-1">Achievement</div>
                            <Badge className={`${getAchievementColor(target.achievement)} text-xs`}>
                              {target.achievement.toFixed(2)}%
                            </Badge>
                          </div>

                          {/* Variance */}
                          <div className={`rounded p-2 ${target.variance >= 0 ? 'bg-[#82A094]/10' : 'bg-[#E17F70]/10'
                            }`}>
                            <div className={`text-xs font-medium mb-1 ${target.variance >= 0 ? 'text-[#4F6A64]' : 'text-[#75242D]'
                              }`}>Variance</div>
                            <div className={`text-xs font-bold flex items-center gap-1 ${target.variance >= 0 ? 'text-[#4F6A64]' : 'text-[#75242D]'
                              }`}>
                              {target.variance >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {formatCrLakh(Math.abs(target.variance))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </>
            ) : (
              <div className="text-center py-12 text-[#AEBFC3]0">
                No target details found for this user
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserTargetDetailsDialog;
