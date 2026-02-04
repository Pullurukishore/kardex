'use client'

import { Card, CardContent } from '@/components/ui/card'
import { 
  Users, 
  MapPin, 
  Timer, 
  AlertTriangle 
} from 'lucide-react'
import { AttendanceStats, AttendanceRecord } from '@/lib/constants/attendance'

interface AttendanceStatsCardsProps {
  stats: AttendanceStats | null;
  loading: boolean;
  dateRange: string;
  attendanceRecords: AttendanceRecord[];
}

export default function AttendanceStatsCards({ 
  stats, 
  loading, 
  dateRange, 
  attendanceRecords 
}: AttendanceStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
      {/* Total Records Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] hover:shadow-2xl transition-all duration-500 group rounded-3xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-125 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -translate-x-10 translate-y-10 group-hover:scale-110 transition-transform duration-700"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <p className="text-sm font-bold text-white/80 uppercase tracking-widest">Total Attendance</p>
              {loading || !stats ? (
                <div className="h-10 w-24 bg-white/20 rounded-xl animate-pulse"></div>
              ) : (
                <p className="text-4xl font-black text-white tracking-tight leading-none">
                  {stats?.totalRecords || attendanceRecords.length}
                </p>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full w-fit">
                <Users className="h-3.5 w-3.5 text-white/90" />
                <span className="text-[10px] font-bold text-white/90 uppercase">
                  {dateRange === 'today' ? 'Today' : 'Selected period'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 shadow-xl border border-white/20">
              <Users className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unique Locations Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#82A094] to-[#A2B9AF] hover:shadow-2xl transition-all duration-500 group rounded-3xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-125 transition-transform duration-700"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <p className="text-sm font-bold text-white/80 uppercase tracking-widest">Locations</p>
              {loading ? (
                <div className="h-10 w-24 bg-white/20 rounded-xl animate-pulse"></div>
              ) : (
                <p className="text-4xl font-black text-white tracking-tight leading-none">
                  {new Set(attendanceRecords.map(r => r.checkInAddress).filter(Boolean)).size}
                </p>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full w-fit">
                <MapPin className="h-3.5 w-3.5 text-white/90" />
                <span className="text-[10px] font-bold text-white/90 uppercase">Unique check-in sites</span>
              </div>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl group-hover:-rotate-6 group-hover:scale-110 transition-all duration-500 shadow-xl border border-white/20">
              <MapPin className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avg Hours Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#6F8A9D] to-[#96AEC2] hover:shadow-2xl transition-all duration-500 group rounded-3xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-125 transition-transform duration-700"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <p className="text-sm font-bold text-white/80 uppercase tracking-widest">
                {dateRange === 'today' ? 'Hours Today' : 'Avg Hours'}
              </p>
              {loading || !stats ? (
                <div className="h-10 w-24 bg-white/20 rounded-xl animate-pulse"></div>
              ) : (
                <p className="text-4xl font-black text-white tracking-tight leading-none">
                  {dateRange === 'today' 
                    ? attendanceRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0).toFixed(1)
                    : stats?.averageHours?.toFixed(1) || '0.0'}
                  <span className="text-lg ml-1 font-bold text-white/60">HRS</span>
                </p>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full w-fit">
                <Timer className="h-3.5 w-3.5 text-white/90" />
                <span className="text-[10px] font-bold text-white/90 uppercase">
                  {dateRange === 'today' ? 'Total work today' : 'Per shift average'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl group-hover:scale-125 transition-all duration-500 shadow-xl border border-white/20">
              <Timer className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#9E3B47] to-[#E17F70] hover:shadow-2xl transition-all duration-500 group rounded-3xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 -translate-y-10 group-hover:scale-125 transition-transform duration-700"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <p className="text-sm font-bold text-white/80 uppercase tracking-widest">Late or Absent</p>
              {loading || !stats ? (
                <div className="h-10 w-24 bg-white/20 rounded-xl animate-pulse"></div>
              ) : (
                <p className="text-4xl font-black text-white tracking-tight leading-none">
                  {(stats?.statusBreakdown?.LATE || 0) + 
                   (stats?.statusBreakdown?.ABSENT || 0) + 
                   (stats?.statusBreakdown?.EARLY_CHECKOUT || 0) ||
                   attendanceRecords.filter(r => ['LATE', 'ABSENT', 'EARLY_CHECKOUT'].includes(r.status)).length}
                </p>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full w-fit">
                <AlertTriangle className="h-3.5 w-3.5 text-white/90" />
                <span className="text-[10px] font-bold text-white/90 uppercase">
                  Needs attention
                </span>
              </div>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-xl border border-white/20">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
