import {
    UserCheck,
    UserX,
    Zap,
    XCircle,
    AlertTriangle,
    Clock,
    Timer,
    MapPin,
    Activity
} from 'lucide-react'

export interface AttendanceRecord {
    id: number;
    userId: number;
    checkInAt: string;
    checkOutAt?: string;
    checkInLatitude?: number;
    checkInLongitude?: number;
    checkInAddress?: string;
    checkOutLatitude?: number;
    checkOutLongitude?: number;
    checkOutAddress?: string;
    totalHours?: number;
    status: 'CHECKED_IN' | 'CHECKED_OUT' | 'ABSENT' | 'LATE' | 'EARLY_CHECKOUT' | 'AUTO_CHECKED_OUT';
    notes?: string;
    createdAt: string;
    updatedAt: string;
    user: {
        id: number;
        name: string;
        email: string;
        role: string;
        serviceZones: Array<{
            serviceZone: {
                id: number;
                name: string;
            };
        }>;
        _count: {
            activityLogs: number;
        };
    };
    flags: Array<{
        type: string;
        message: string;
        severity: 'info' | 'warning' | 'error';
    }>;
    gaps: Array<{
        start: string;
        end: string;
        duration: number;
    }>;
    activityCount: number;
}

export interface AttendanceStats {
    totalRecords: number;
    statusBreakdown: Record<string, number>;
    averageHours: number;
    period: string;
}

export interface ServicePerson {
    id: number;
    name: string;
    email: string;
    serviceZones: Array<{
        serviceZone: {
            id: number;
            name: string;
        };
    }>;
}

export interface ServiceZone {
    id: number;
    name: string;
    description?: string;
}

export const STATUS_CONFIG: Record<string, any> = {
    CHECKED_IN: { label: 'Checked In', color: 'bg-[#A2B9AF]/20 text-[#4F6A64] border-[#A2B9AF]', icon: UserCheck },
    CHECKED_OUT: { label: 'Checked Out', color: 'bg-[#96AEC2]/20 text-[#546A7A] border-[#96AEC2]', icon: UserX },
    AUTO_CHECKED_OUT: { label: 'Auto Checkout', color: 'bg-[#6F8A9D]/20 text-[#546A7A] border-[#6F8A9D]', icon: Zap },
    ABSENT: { label: 'Absent', color: 'bg-[#E17F70]/20 text-[#75242D] border-[#E17F70]', icon: XCircle },
    LATE: { label: 'Late', color: 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]', icon: AlertTriangle },
    EARLY_CHECKOUT: { label: 'Early Checkout', color: 'bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]', icon: Clock },
};

export const FLAG_CONFIG: Record<string, any> = {
    LATE_CHECKIN: { label: 'Late Check-in', color: 'bg-[#CE9F6B]/20 text-[#976E44]', icon: Clock },
    EARLY_CHECKOUT: { label: 'Early Checkout', color: 'bg-[#CE9F6B]/20 text-[#976E44]', icon: Timer },
    LONG_BREAK: { label: 'Long Break', color: 'bg-[#6F8A9D]/20 text-[#546A7A]', icon: Clock },
    NO_CHECKOUT: { label: 'No Checkout', color: 'bg-[#E17F70]/20 text-[#75242D]', icon: XCircle },
    SUSPICIOUS_LOCATION: { label: 'Location Issue', color: 'bg-[#E17F70]/20 text-[#75242D]', icon: MapPin },
    LOW_ACTIVITY: { label: 'Low Activity', color: 'bg-[#AEBFC3]/20 text-[#546A7A]', icon: Activity },
};
