'use client';

import { useParams } from 'next/navigation';
import AttendanceDetailView from '@/components/attendance/AttendanceDetailView';

export default function ExpertAttendanceViewPage() {
  const params = useParams();
  const attendanceId = params.id as string;

  return (
    <AttendanceDetailView
      attendanceId={attendanceId}
      apiEndpoint={`/admin/attendance/${attendanceId}`}
      backUrl="/expert/attendance"
      pageTitle="Attendance Details"
    />
  );
}
