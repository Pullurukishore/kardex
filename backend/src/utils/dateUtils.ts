import { differenceInMinutes, getDay, setHours, setMinutes, setSeconds, setMilliseconds, addDays } from 'date-fns';

/**
 * Business hours: 9 AM to 5:30 PM (8.5 hours per day)
 */
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 17;
export const BUSINESS_END_MINUTE = 30;
export const BUSINESS_MINUTES_PER_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60 + BUSINESS_END_MINUTE; // 510 minutes
export const CALENDAR_MINUTES_PER_DAY = 24 * 60; // 1440 minutes

/**
 * Optimized Helper function to calculate business hours between two dates 
 * (9 AM to 5:30 PM, excluding Sundays)
 * 
 * Performance: O(1) for same-day or O(1) mathematical calculation for multi-day.
 */
export function calculateBusinessHoursInMinutes(startDate: Date, endDate: Date): number {
    if (startDate >= endDate) return 0;

    const start = new Date(startDate);
    start.setSeconds(0, 0);
    const end = new Date(endDate);
    end.setSeconds(0, 0);

    // If same day
    if (start.toDateString() === end.toDateString()) {
        if (getDay(start) === 0) return 0; // Sunday

        const bStart = setMilliseconds(setSeconds(setMinutes(setHours(new Date(start), BUSINESS_START_HOUR), 0), 0), 0);
        const bEnd = setMilliseconds(setSeconds(setMinutes(setHours(new Date(start), BUSINESS_END_HOUR), BUSINESS_END_MINUTE), 0), 0);

        const actualStart = start < bStart ? bStart : (start > bEnd ? bEnd : start);
        const actualEnd = end > bEnd ? bEnd : (end < bStart ? bStart : end);

        return Math.max(0, differenceInMinutes(actualEnd, actualStart));
    }

    // Multi-day calculation
    let totalMinutes = 0;

    // 1. Minutes on the first day
    if (getDay(start) !== 0) {
        const firstDayEnd = setMilliseconds(setSeconds(setMinutes(setHours(new Date(start), BUSINESS_END_HOUR), BUSINESS_END_MINUTE), 0), 0);
        const firstDayStartLimit = setMilliseconds(setSeconds(setMinutes(setHours(new Date(start), BUSINESS_START_HOUR), 0), 0), 0);
        const effectiveStart = start < firstDayStartLimit ? firstDayStartLimit : (start > firstDayEnd ? firstDayEnd : start);
        totalMinutes += Math.max(0, differenceInMinutes(firstDayEnd, effectiveStart));
    }

    // 2. Full intermediate days (mathematical calculation to avoid O(N) loop)
    const nextDay = addDays(new Date(start), 1);
    nextDay.setHours(0, 0, 0, 0);

    const lastDayStart = new Date(end);
    lastDayStart.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((lastDayStart.getTime() - nextDay.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays > 0) {
        // Count Sundays in the range
        let sundays = 0;
        for (let i = 0; i < diffDays; i++) {
            if (getDay(addDays(nextDay, i)) === 0) sundays++;
        }
        totalMinutes += (diffDays - sundays) * BUSINESS_MINUTES_PER_DAY;
    }

    // 3. Minutes on the last day
    if (getDay(end) !== 0) {
        const lastDayStartLimit = setMilliseconds(setSeconds(setMinutes(setHours(new Date(end), BUSINESS_START_HOUR), 0), 0), 0);
        const lastDayEndLimit = setMilliseconds(setSeconds(setMinutes(setHours(new Date(end), BUSINESS_END_HOUR), BUSINESS_END_MINUTE), 0), 0);
        const effectiveEnd = end > lastDayEndLimit ? lastDayEndLimit : (end < lastDayStartLimit ? lastDayStartLimit : end);
        totalMinutes += Math.max(0, differenceInMinutes(effectiveEnd, lastDayStartLimit));
    }

    return totalMinutes;
}

/**
 * Helper function to properly convert Prisma Decimal to JavaScript number
 * Preserves full precision for accurate calculations
 */
export function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toNumber === 'function') return value.toNumber();
    const parsed = parseFloat(value.toString());
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate risk class based on days overdue
 */
export function calculateRiskClass(dueByDays: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (dueByDays <= 0) return 'LOW';
    if (dueByDays <= 30) return 'MEDIUM';
    if (dueByDays <= 90) return 'HIGH';
    return 'CRITICAL';
}

/**
 * Calculate days between two dates (today and a reference date)
 * Positive result means the reference date is in the past (overdue)
 */
export function calculateDaysBetween(referenceDate: Date | null | undefined, targetDate: Date = new Date()): number {
    if (!referenceDate || isNaN(new Date(referenceDate).getTime())) return 0;

    const today = new Date(targetDate);
    today.setHours(0, 0, 0, 0);
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - ref.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Unified calculation for ticket resolution time (downtime).
 * Follows the priority: actualResolutionTime > metadata.downtimeMinutes > business hours duration.
 */
export function calculateTicketResolutionMinutes(
    actualResolutionTime: number | null | undefined,
    relatedMachineIds: string | null | undefined,
    createdAt: Date | string,
    updatedAt: Date | string,
    visitCompletedDate?: Date | string | null
): number {
    // Priority 1: actualResolutionTime from Excel import (already in minutes)
    // We check for typeof number or string to ensure 0 is accepted
    if (actualResolutionTime !== null && actualResolutionTime !== undefined) {
        const val = toNumber(actualResolutionTime);
        if (val >= 0) return val;
    }

    // Priority 2: metadata downtimeMinutes from Excel import
    if (relatedMachineIds) {
        try {
            const metadata = typeof relatedMachineIds === 'string' 
                ? JSON.parse(relatedMachineIds) 
                : relatedMachineIds;
            if (metadata?.downtimeMinutes !== null && metadata?.downtimeMinutes !== undefined) {
                const val = toNumber(metadata.downtimeMinutes);
                if (val >= 0) return val;
            }
        } catch { /* ignore parse errors */ }
    }

    // Priority 3: Calculate duration between createdAt and updatedAt using business hours
    const start = new Date(createdAt);
    let end = new Date(updatedAt);

    // If updatedAt is effectively the same as createdAt (imported tickets), 
    // fall back to visitCompletedDate if available
    const diffMins = Math.abs((end.getTime() - start.getTime()) / 60000);
    if (diffMins <= 1 && visitCompletedDate) {
        end = new Date(visitCompletedDate);
    }

    return calculateBusinessHoursInMinutes(start, end);
}

/**
 * Unified calculation for travel time.
 * Priority: metadata.travelHourMinutes > status history (Leg A + Leg B) > timestamps.
 */
export function calculateTravelMinutes(
    relatedMachineIds: string | null | undefined,
    statusHistory: any[] | null | undefined,
    visitStartedAt?: Date | string | null,
    visitReachedAt?: Date | string | null,
    visitInProgressAt?: Date | string | null
): number {
    let minutes = 0;

    // Priority 1: Use imported Excel travel hour (metadata)
    if (relatedMachineIds) {
        try {
            const metadata = typeof relatedMachineIds === 'string' 
                ? JSON.parse(relatedMachineIds) 
                : relatedMachineIds;
            if (metadata?.travelHourMinutes && metadata.travelHourMinutes > 0) {
                return toNumber(metadata.travelHourMinutes);
            }
        } catch { /* ignore parse errors */ }
    }

    // Priority 2: Calculate from status history (sum of Leg A and Leg B)
    if (statusHistory && statusHistory.length > 0) {
        const sortedHistory = [...statusHistory].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
        
        const goingStart = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_STARTED' || h.status === 'VISIT_STARTED');
        const goingEnd = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_REACHED' || h.status === 'ONSITE_VISIT_IN_PROGRESS' || h.status === 'VISIT_REACHED' || h.status === 'VISIT_IN_PROGRESS');
        const returnStart = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_RESOLVED');
        const returnEnd = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_COMPLETED');

        if (goingStart && goingEnd && new Date(goingStart.changedAt) < new Date(goingEnd.changedAt)) {
            minutes += differenceInMinutes(new Date(goingEnd.changedAt), new Date(goingStart.changedAt));
        }
        if (returnStart && returnEnd && new Date(returnStart.changedAt) < new Date(returnEnd.changedAt)) {
            minutes += differenceInMinutes(new Date(returnEnd.changedAt), new Date(returnStart.changedAt));
        }
    }

    // Priority 3: Fallback to direct timestamp fields if status history is missing/incomplete
    if (minutes === 0 && visitStartedAt && (visitReachedAt || visitInProgressAt)) {
        const start = new Date(visitStartedAt);
        const end = new Date(visitReachedAt || visitInProgressAt!);
        if (start < end) {
            minutes = differenceInMinutes(end, start);
        }
    }

    return minutes;
}

/**
 * Unified calculation for onsite resolution time (active work time).
 * Priority: metadata.workHourMinutes > status history.
 */
export function calculateOnsiteResolutionMinutes(
    relatedMachineIds: string | null | undefined,
    statusHistory: any[] | null | undefined
): number {
    // Priority 1: Use imported Excel work hour (metadata)
    if (relatedMachineIds) {
        try {
            const metadata = typeof relatedMachineIds === 'string' 
                ? JSON.parse(relatedMachineIds) 
                : relatedMachineIds;
            if (metadata?.workHourMinutes && metadata.workHourMinutes > 0) {
                return toNumber(metadata.workHourMinutes);
            }
        } catch { /* ignore parse errors */ }
    }

    // Priority 2: Calculate from status history (ONSITE_VISIT_IN_PROGRESS to RESOLVED)
    if (statusHistory && statusHistory.length > 0) {
        const sortedHistory = [...statusHistory].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
        
        const onsiteStart = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_IN_PROGRESS');
        const onsiteEnd = sortedHistory.find((h: any) => h.status === 'ONSITE_VISIT_RESOLVED' || h.status === 'RESOLVED');
        
        if (onsiteStart && onsiteEnd && new Date(onsiteStart.changedAt) < new Date(onsiteEnd.changedAt)) {
            return differenceInMinutes(new Date(onsiteEnd.changedAt), new Date(onsiteStart.changedAt));
        }
    }

    return 0;
}

/**
 * Conversion helper to format minutes into human-readable Days, Hours, Minutes
 * based on business hours.
 */
export function formatMinutesToBusinessDH(totalMinutes: number) {
    const days = Math.floor(totalMinutes / BUSINESS_MINUTES_PER_DAY);
    const remainingAfterDays = totalMinutes % BUSINESS_MINUTES_PER_DAY;
    const hours = Math.floor(remainingAfterDays / 60);
    const minutes = Math.round(remainingAfterDays % 60);

    return { days, hours, minutes };
}


