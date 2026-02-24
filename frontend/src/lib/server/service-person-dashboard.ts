import { cookies } from 'next/headers';

interface DashboardData {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    zoneId?: string;
  };
  attendance: {
    isCheckedIn: boolean;
    checkInAt?: string;
    totalHours?: number;
    status: string;
    location?: {
      latitude: number;
      longitude: number;
      address: string;
    };
  };
  activities: {
    active: Array<{
      id: number;
      activityType: string;
      title: string;
      startTime: string;
      location?: string;
      currentStage?: string;
      ticket?: {
        id: number;
        title: string;
        status: string;
      };
    }>;
    recent: Array<{
      id: number;
      activityType: string;
      title: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      location?: string;
    }>;
    todayCount: number;
    todayHours: number;
  };
  tickets: {
    assigned: Array<{
      id: number;
      title: string;
      status: string;
      priority: string;
      customer: {
        companyName: string;
      };
      asset: {
        machineId: string;
        model?: string;
      };
      createdAt: string;
      slaDueAt?: string;
    }>;
    assignedCount: number;
    completedToday: number;
    inProgress: number;
  };
  stats: {
    todayHours: number;
    activeActivities: number;
    assignedTickets: number;
    completedToday: number;
    weeklyHours: number;
    monthlyTickets: number;
  };
}

export async function getServicePersonDashboardData(): Promise<DashboardData | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value || cookieStore.get('token')?.value;

    if (!accessToken) {
      return null;
    }

    // Determine base URL with smart API path handling
    const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5003';
    const baseUrl = envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch all required data in parallel
    const [userResponse, attendanceResponse, activitiesResponse, ticketsResponse] = await Promise.all([
      fetch(`${baseUrl}/auth/profile`, { headers }),
      fetch(`${baseUrl}/attendance/status`, { headers }),
      fetch(`${baseUrl}/activities?limit=50`, { headers }),
      fetch(`${baseUrl}/tickets?filter=assigned-to-service-person&limit=20`, { headers }),
    ]);

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json();
    const attendanceData = attendanceResponse.ok ? await attendanceResponse.json() : { isCheckedIn: false, status: 'CHECKED_OUT' };
    const activitiesData = activitiesResponse.ok ? await activitiesResponse.json() : { activities: [], pagination: {} };
    const ticketsData = ticketsResponse.ok ? await ticketsResponse.json() : { tickets: [], pagination: {} };

    // Process activities data
    const activities = activitiesData.activities || [];
    const activeActivities = activities.filter((activity: any) => !activity.endTime);
    const recentActivities = activities.slice(0, 10);

    // Calculate today's activity stats
    const today = new Date().toDateString();
    const todayActivities = activities.filter((activity: any) =>
      new Date(activity.startTime).toDateString() === today
    );

    const todayHours = todayActivities.reduce((total: number, activity: any) => {
      if (activity.duration) {
        return total + (activity.duration / 60); // Convert minutes to hours
      }
      return total;
    }, 0);

    // Process tickets data
    const tickets = ticketsData.tickets || [];
    const assignedTickets = tickets.filter((ticket: any) =>
      ['ASSIGNED', 'IN_PROGRESS', 'ONSITE_VISIT_STARTED', 'ONSITE_VISIT_REACHED', 'ONSITE_VISIT_IN_PROGRESS'].includes(ticket.status)
    );

    const completedToday = tickets.filter((ticket: any) =>
      ['RESOLVED', 'CLOSED', 'ONSITE_VISIT_RESOLVED'].includes(ticket.status) &&
      new Date(ticket.updatedAt).toDateString() === today
    ).length;

    const inProgressTickets = tickets.filter((ticket: any) =>
      ['IN_PROGRESS', 'ONSITE_VISIT_IN_PROGRESS'].includes(ticket.status)
    ).length;

    // Calculate weekly hours (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyActivities = activities.filter((activity: any) =>
      new Date(activity.startTime) >= weekAgo
    );
    const weeklyHours = weeklyActivities.reduce((total: number, activity: any) => {
      if (activity.duration) {
        return total + (activity.duration / 60);
      }
      return total;
    }, 0);

    // Calculate monthly tickets (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthlyTickets = tickets.filter((ticket: any) =>
      new Date(ticket.createdAt) >= monthAgo
    ).length;

    return {
      user: {
        id: userData.id,
        name: userData.name || userData.email,
        email: userData.email,
        role: userData.role,
        zoneId: userData.zoneId,
      },
      attendance: {
        isCheckedIn: attendanceData.isCheckedIn || false,
        checkInAt: attendanceData.attendance?.checkInAt,
        totalHours: attendanceData.attendance?.totalHours || 0,
        status: attendanceData.attendance?.status || 'CHECKED_OUT',
        location: attendanceData.attendance?.checkInLatitude ? {
          latitude: parseFloat(attendanceData.attendance.checkInLatitude),
          longitude: parseFloat(attendanceData.attendance.checkInLongitude),
          address: attendanceData.attendance.checkInAddress || 'Unknown Location',
        } : undefined,
      },
      activities: {
        active: activeActivities.map((activity: any) => ({
          id: activity.id,
          activityType: activity.activityType,
          title: activity.title,
          startTime: activity.startTime,
          location: activity.location,
          currentStage: activity.ActivityStage?.[activity.ActivityStage.length - 1]?.stage,
          ticket: activity.ticket ? {
            id: activity.ticket.id,
            title: activity.ticket.title,
            status: activity.ticket.status,
          } : undefined,
        })),
        recent: recentActivities.map((activity: any) => ({
          id: activity.id,
          activityType: activity.activityType,
          title: activity.title,
          startTime: activity.startTime,
          endTime: activity.endTime,
          duration: activity.duration,
          location: activity.location,
        })),
        todayCount: todayActivities.length,
        todayHours: Math.round(todayHours * 100) / 100,
      },
      tickets: {
        assigned: assignedTickets.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          customer: {
            companyName: ticket.customer?.companyName || 'Unknown Customer',
          },
          asset: {
            machineId: ticket.asset?.machineId || 'Unknown Asset',
            model: ticket.asset?.model,
          },
          createdAt: ticket.createdAt,
          slaDueAt: ticket.slaDueAt,
        })),
        assignedCount: assignedTickets.length,
        completedToday: completedToday,
        inProgress: inProgressTickets,
      },
      stats: {
        todayHours: Math.round(todayHours * 100) / 100,
        activeActivities: activeActivities.length,
        assignedTickets: assignedTickets.length,
        completedToday: completedToday,
        weeklyHours: Math.round(weeklyHours * 100) / 100,
        monthlyTickets: monthlyTickets,
      },
    };
  } catch (error) {
    return null;
  }
}