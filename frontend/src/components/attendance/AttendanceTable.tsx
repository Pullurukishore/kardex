'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  XCircle, 
  Zap, 
  Activity, 
  Timer, 
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  ArrowRight
} from 'lucide-react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { AttendanceRecord } from '@/lib/constants/attendance'
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface AttendanceTableProps {
  loading: boolean;
  attendanceRecords: AttendanceRecord[];
  processedRecords: any[];
  onViewDetails: (record: AttendanceRecord) => void;
  onEdit: (record: AttendanceRecord) => void;
  onAddActivity: (record: AttendanceRecord) => void;
}

export default function AttendanceTable({
  loading,
  attendanceRecords,
  processedRecords,
  onViewDetails,
  onEdit,
  onAddActivity
}: AttendanceTableProps) {
  return (
    <Card className="border-0 shadow-2xl overflow-hidden bg-white rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-[#546A7A] via-[#607D8B] to-[#6F8A9D] text-white">
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-white/80" />
                  Service Person
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-white/80" />
                  Date
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/80" />
                  Shift Time
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-white/80" />
                  Hours Worked
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-white/80" />
                  Status
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-white/80" />
                  Activities
                </div>
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-[#6F8A9D]" />
                    <p className="text-[#546A7A] font-bold uppercase tracking-widest text-xs">Syncing personnel data...</p>
                  </div>
                </td>
              </tr>
            ) : attendanceRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-24 text-center">
                  <div className="bg-slate-50 p-12 rounded-3xl inline-block border-2 border-dashed border-slate-200">
                    <Users className="h-12 w-12 text-[#AEBFC3] mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-[#546A7A] mb-1">No Attendance Records</h3>
                    <p className="text-[#6F8A9D] text-sm">No attendance data found for the selected date and filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              processedRecords.map((record, index) => {
                // Use the statusConfig provided in processedRecords (the "check if there then use" logic)
                const statusConfig = record.statusConfig;
                const StatusIcon = statusConfig.icon || Activity;
                
                return (
                  <tr 
                    key={record.id} 
                    onClick={() => onViewDetails(record)}
                    className={`
                      transition-all duration-300 cursor-pointer
                      hover:bg-[#96AEC2]/5 group/row
                      ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                    `}
                  >
                    {/* User Name */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#546A7A]/10 group-hover/row:scale-110 transition-transform duration-500">
                            {(record.user.name || record.user.email).charAt(0).toUpperCase()}
                          </div>
                          {record.status === 'CHECKED_IN' && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#82A094] rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#546A7A] group-hover/row:text-[#6F8A9D] transition-colors truncate">
                            {record.user.name || record.user.email}
                          </p>
                          <p className="text-[10px] font-bold text-[#AEBFC3] uppercase tracking-wider truncate">
                            {record.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    {/* Date */}
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="font-bold text-[#546A7A] text-sm">
                          {record.checkInAt 
                            ? format(parseISO(record.checkInAt), 'MMM dd, yyyy') 
                            : record.createdAt 
                              ? format(parseISO(record.createdAt), 'MMM dd, yyyy')
                              : '-'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            (record.checkInAt && isToday(parseISO(record.checkInAt))) || 
                            (!record.checkInAt && record.createdAt && isToday(parseISO(record.createdAt)))
                              ? 'bg-[#A2B9AF]/30 text-[#4F6A64]' 
                              : 'bg-[#AEBFC3]/20 text-[#6F8A9D]'
                          }`}>
                            {(() => {
                              const dateStr = record.checkInAt || record.createdAt;
                              if (!dateStr) return '';
                              const date = parseISO(dateStr);
                              if (isToday(date)) return 'Today';
                              if (isYesterday(date)) return 'Yesterday';
                              return format(date, 'EEEE');
                            })()}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Shift Info */}
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-[#AEBFC3] uppercase leading-none mb-1">Check-in</span>
                            <span className="font-mono font-bold text-[#546A7A] text-xs px-2 py-1 bg-white rounded-lg border border-slate-100 shadow-sm">
                              {record.checkInAt ? format(parseISO(record.checkInAt), 'HH:mm') : '--:--'}
                            </span>
                          </div>
                          <ArrowRight className="h-3 w-3 text-[#AEBFC3]" />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-[#AEBFC3] uppercase leading-none mb-1">Check-out</span>
                            <span className={`font-mono font-bold text-xs px-2 py-1 bg-white rounded-lg border border-slate-100 shadow-sm ${
                              record.checkOutAt ? 'text-[#546A7A]' : 'text-[#82A094] animate-pulse'
                            }`}>
                              {record.checkOutAt ? format(parseISO(record.checkOutAt), 'HH:mm') : 'On Duty'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Work Hours */}
                    <td className="px-6 py-5">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 group-hover/row:bg-white transition-colors">
                        <Timer className="h-4 w-4 text-[#6F8A9D]" />
                        <span className="font-black text-[#546A7A] tabular-nums text-sm">
                          {record.totalHours ? Number(record.totalHours).toFixed(1) : '0.0'}
                        </span>
                        <span className="text-[10px] font-black text-[#AEBFC3] uppercase">hrs</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-5">
                      <Badge className={`
                        ${statusConfig.color}
                        px-3 py-1.5 rounded-xl border shadow-sm font-bold uppercase text-[9px] tracking-widest
                        hover:scale-105 transition-transform
                      `}>
                        <StatusIcon className="h-3 w-3 mr-1.5" />
                        {statusConfig.label}
                      </Badge>
                    </td>

                    {/* Missions */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {Array.from({ length: Math.min(record.activityCount || 0, 3) }).map((_, i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-slate-50 flex items-center justify-center shadow-sm">
                              <Activity className="h-3.5 w-3.5 text-[#6F8A9D]" />
                            </div>
                          ))}
                          {record.activityCount > 3 && (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-[#546A7A] shadow-sm">
                              +{record.activityCount - 3}
                            </div>
                          )}
                          {record.activityCount === 0 && (
                            <div className="w-8 h-8 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-[#AEBFC3]">0</span>
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-2xl hover:bg-[#A2B9AF]/30 hover:text-[#4F6A64] transition-all group/plus"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddActivity(record);
                          }}
                        >
                          <Plus className="h-4 w-4 group-hover/plus:rotate-90 transition-transform" />
                        </Button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 rounded-2xl hover:bg-[#546A7A] hover:text-white transition-all duration-300 shadow-sm border border-transparent hover:border-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(record);
                          }}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 rounded-2xl hover:bg-slate-100 shadow-sm border border-transparent"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4 text-[#546A7A]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 border-slate-100 shadow-2xl backdrop-blur-lg bg-white/95 min-w-[160px]">
                            <DropdownMenuItem 
                              className="rounded-xl focus:bg-[#546A7A] focus:text-white cursor-pointer py-3 px-4 font-bold text-xs uppercase tracking-widest gap-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails(record);
                              }}
                            >
                              <Eye className="h-4 w-4" /> 
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="rounded-xl focus:bg-rose-500 focus:text-white cursor-pointer py-3 px-4 font-bold text-xs uppercase tracking-widest gap-3 text-rose-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(record);
                              }}
                            >
                              <Pencil className="h-4 w-4" /> 
                              Edit Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
