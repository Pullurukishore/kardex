"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Clock,
  MapPin,
  Activity,
  Loader2,
  Calendar,
  User,
  FileText,
  Play,
  Square,
  CheckCircle,
  Navigation,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api/api-client";
import { cn } from "@/lib/utils";
import EnhancedLocationCapture from './EnhancedLocationCapture';
import { LocationData as EnhancedLocationData } from '@/hooks/useEnhancedLocation';

interface ActivityLog {
  id: number;
  activityType: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  ticket?: {
    id: number;
    title: string;
    status?: string;
    priority?: string;
    customer?: {
      companyName?: string;
    };
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
  ActivityStage?: Array<{
    id: number;
    stage: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }>;
}

const ACTIVITY_TYPES = [
  { value: "TICKET_WORK", label: "Ticket Work", icon: "🎫" },
  { value: "PO_DISCUSSION", label: "PO Discussion", icon: "💼" },
  { value: "SPARE_REPLACEMENT", label: "Spare Replacement", icon: "🔧" },
  { value: "TRAVEL", label: "Travel", icon: "🚗" },
  { value: "TRAINING", label: "Training", icon: "📚" },
  { value: "REVIEW_MEETING", label: "Review Meeting", icon: "👥" },
  { value: "RELOCATION", label: "Relocation", icon: "📦" },
  { value: "MAINTENANCE_PLANNED", label: "Maintenance Planned", icon: "🔧" },
  { value: "INSTALLATION", label: "Installation", icon: "🔨" },
  { value: "DOCUMENTATION", label: "Documentation", icon: "📝" },
  { value: "WORK_FROM_HOME", label: "Work From Home", icon: "🏠" },
  { value: "OTHER", label: "Other", icon: "📋" },
];

// Activity types that don't require scheduling (ad-hoc activities)
const AD_HOC_ACTIVITY_TYPES = ['WORK_FROM_HOME', 'OTHER', 'BREAK', 'DOCUMENTATION'];

// Stage templates for different activity types (dual-flow system)
const ACTIVITY_STAGE_TEMPLATES: Record<string, Array<{
  stage: string;
  label: string;
  description: string;
  required: boolean;
  icon: string;
}>> = {
  PO_DISCUSSION: [
    { stage: 'STARTED', label: 'Started', description: 'Begin PO discussion', required: true, icon: '🚀' },
    { stage: 'TRAVELING', label: 'Traveling', description: 'Travel to location', required: true, icon: '🚗' },
    { stage: 'ARRIVED', label: 'Arrived', description: 'Arrive at customer location', required: true, icon: '📍' },
    { stage: 'PLANNING', label: 'Planning', description: 'Discuss PO requirements', required: true, icon: '📋' },
    { stage: 'DOCUMENTATION', label: 'Documentation', description: 'Document discussion outcomes', required: true, icon: '📝' },
    { stage: 'COMPLETED', label: 'Completed', description: 'Complete PO discussion', required: true, icon: '✅' }
  ],

  SPARE_REPLACEMENT: [
    { stage: 'STARTED', label: 'Started', description: 'Begin spare replacement', required: true, icon: '🚀' },
    { stage: 'TRAVELING', label: 'Traveling', description: 'Travel to location', required: true, icon: '🚗' },
    { stage: 'ARRIVED', label: 'Arrived', description: 'Arrive at customer location', required: true, icon: '📍' },
    { stage: 'ASSESSMENT', label: 'Assessment', description: 'Assess what needs replacement', required: true, icon: '🔍' },
    { stage: 'EXECUTION', label: 'Execution', description: 'Replace the spare part', required: true, icon: '🔧' },
    { stage: 'TESTING', label: 'Testing', description: 'Test the replacement', required: true, icon: '🧪' },
    { stage: 'CUSTOMER_HANDOVER', label: 'Customer Handover', description: 'Customer handover', required: false, icon: '🤝' },
    { stage: 'COMPLETED', label: 'Completed', description: 'Complete replacement', required: true, icon: '✅' }
  ],

  INSTALLATION: [
    { stage: 'STARTED', label: 'Started', description: 'Begin installation', required: true, icon: '🚀' },
    { stage: 'TRAVELING', label: 'Traveling', description: 'Travel to location', required: true, icon: '🚗' },
    { stage: 'ARRIVED', label: 'Arrived', description: 'Arrive at installation site', required: true, icon: '📍' },
    { stage: 'ASSESSMENT', label: 'Assessment', description: 'Site assessment', required: true, icon: '🔍' },
    { stage: 'PREPARATION', label: 'Preparation', description: 'Prepare for installation', required: true, icon: '🛠️' },
    { stage: 'EXECUTION', label: 'Execution', description: 'Perform installation', required: true, icon: '🔨' },
    { stage: 'TESTING', label: 'Testing', description: 'Test installation', required: true, icon: '🧪' },
    { stage: 'CUSTOMER_HANDOVER', label: 'Customer Handover', description: 'Customer training/handover', required: true, icon: '🤝' },
    { stage: 'DOCUMENTATION', label: 'Documentation', description: 'Document installation', required: true, icon: '📝' },
    { stage: 'COMPLETED', label: 'Completed', description: 'Complete installation', required: true, icon: '✅' }
  ],

  MAINTENANCE_PLANNED: [
    { stage: 'STARTED', label: 'Started', description: 'Begin maintenance', required: true, icon: '🚀' },
    { stage: 'TRAVELING', label: 'Traveling', description: 'Travel to location', required: true, icon: '🚗' },
    { stage: 'ARRIVED', label: 'Arrived', description: 'Arrive at maintenance site', required: true, icon: '📍' },
    { stage: 'PREPARATION', label: 'Preparation', description: 'Prepare maintenance tools', required: true, icon: '🛠️' },
    { stage: 'EXECUTION', label: 'Execution', description: 'Perform maintenance', required: true, icon: '🔧' },
    { stage: 'TESTING', label: 'Testing', description: 'Test after maintenance', required: true, icon: '🧪' },
    { stage: 'DOCUMENTATION', label: 'Documentation', description: 'Document maintenance', required: true, icon: '📝' },
    { stage: 'COMPLETED', label: 'Completed', description: 'Complete maintenance', required: true, icon: '✅' }
  ],

  // Default template for other activity types
  DEFAULT: [
    { stage: 'STARTED', label: 'Started', description: 'Begin activity', required: true, icon: '🚀' },
    { stage: 'TRAVELING', label: 'Traveling', description: 'Travel to location', required: false, icon: '🚗' },
    { stage: 'ARRIVED', label: 'Arrived', description: 'Arrive at location', required: false, icon: '📍' },
    { stage: 'WORK_IN_PROGRESS', label: 'Work in Progress', description: 'Work in progress', required: true, icon: '⚡' },
    { stage: 'COMPLETED', label: 'Completed', description: 'Complete activity', required: true, icon: '✅' }
  ]
};

interface ActivityLoggerProps {
  onActivityChange?: () => Promise<void> | void;
  activities?: ActivityLog[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
}

interface ApiResponse {
  activities: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Enhanced activity flow management
const getActivityFlow = (activityType: string, ticketId?: number) => {
  if (activityType === 'TICKET_WORK' && ticketId) {
    return 'TICKET_STATUS_FLOW'; // Use existing ticket status progression
  } else {
    return 'ACTIVITY_STAGE_FLOW'; // Use new stage progression with stages
  }
};

// Activity stages for non-ticket activities
const ACTIVITY_STAGES = {
  MAINTENANCE_PLANNED: ['PLANNING', 'IN_PROGRESS', 'TESTING', 'COMPLETED'],
  MAINTENANCE_EMERGENCY: ['ASSESSMENT', 'IN_PROGRESS', 'TESTING', 'COMPLETED'],
  INSPECTION: ['PREPARATION', 'INSPECTION', 'DOCUMENTATION', 'COMPLETED'],
  TRAINING: ['SETUP', 'DELIVERY', 'EVALUATION', 'COMPLETED'],
  TRAVEL: ['STARTED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED'],
  BREAK: ['STARTED', 'COMPLETED'],
  WORK_FROM_HOME: ['STARTED', 'IN_PROGRESS', 'COMPLETED'],
  OTHER: ['STARTED', 'IN_PROGRESS', 'COMPLETED']
};

// Get next stage for activity
const getNextStage = (activityType: string, currentStage?: string) => {
  const stages = ACTIVITY_STAGES[activityType as keyof typeof ACTIVITY_STAGES] || ACTIVITY_STAGES.OTHER;
  if (!currentStage) return stages[0];
  const currentIndex = stages.indexOf(currentStage);
  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
};

// Get all stages for activity type
const getActivityStages = (activityType: string) => {
  return ACTIVITY_STAGES[activityType as keyof typeof ACTIVITY_STAGES] || ACTIVITY_STAGES.OTHER;
};

// Memoize the component to prevent unnecessary re-renders
function ActivityLoggerComponent({
  onActivityChange,
  activities: propActivities,
}: ActivityLoggerProps) {
  const [activities, setActivities] = useState<ActivityLog[]>(
    propActivities || []
  );
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeActivity, setActiveActivity] = useState<ActivityLog | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  // Dual-flow system state
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageTemplate, setStageTemplate] = useState<any[]>([]);
  const [activityFlow, setActivityFlow] = useState<'TICKET_STATUS_FLOW' | 'ACTIVITY_STAGE_FLOW'>('ACTIVITY_STAGE_FLOW');

  const { toast } = useToast();

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Track if we've already triggered an activity change in the current render cycle
  const activityChangeInProgress = useRef(false);
  const lastFetchTime = useRef(0);
  const justEndedActivity = useRef(false);
  const initialLoadComplete = useRef(false);
  const FETCH_COOLDOWN = 1000; // 1 second cooldown between fetches (reduced from 2000ms)

  // Form state
  const [formData, setFormData] = useState({
    activityType: "",
    title: "",
    ticketId: "",
    activityScheduleId: "",
  });

  // Location state for activity logging
  const [activityLocation, setActivityLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationCapture, setShowLocationCapture] = useState(false);
  const [enhancedLocation, setEnhancedLocation] = useState<EnhancedLocationData | null>(null);

  // Tickets state for dropdown
  const [allTickets, setAllTickets] = useState<
    {
      id: number;
      title: string;
      status?: string;
      priority?: string;
      customer?: { companyName?: string };
    }[]
  >([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Accepted schedules state for dropdown
  const [acceptedSchedules, setAcceptedSchedules] = useState<
    {
      id: number;
      description?: string;
      activityType: string;
      scheduledDate: string;
      location?: string;
      priority?: string;
    }[]
  >([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Get current location for activity logging with enhanced features
  const getCurrentLocationForActivity = async () => {
    if (!navigator.geolocation) {
      const errorMsg = "Geolocation is not supported by this browser";
      setLocationError(errorMsg);
      return null;
    }

    setLocationLoading(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000, // Reduced timeout - shorter timeouts often give better accuracy
            maximumAge: 0 // No cache - always get fresh location
          });
        }
      );

      const { latitude, longitude } = position.coords;
      const accuracy = position.coords.accuracy || 999999;

      // Provide accuracy feedback only for extreme cases (> 2000m threshold)
      if (accuracy > 2000) {
        toast({
          title: "Very Poor GPS Signal",
          description: `GPS accuracy is very poor (±${Math.round(accuracy)}m). Please move outdoors with clear sky view for better accuracy.`,
          variant: "destructive",
        });
      }

      // Try to get address from coordinates using backend geocoding service
      let address = '';
      try {
        const response = await apiClient.get(`/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`);

        if (response.data?.success && response.data?.data?.address) {
          address = response.data.data.address;
        } else {
        }
      } catch (geocodeError) {
      }

      const locationData = {
        lat: latitude,
        lng: longitude,
        address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      };

      setActivityLocation(locationData);
      setLocationError(null);

      return locationData;
    } catch (error: any) {
      let errorMessage = "Could not get your current location.";

      if (error.code === 1) {
        errorMessage = "Location access denied. Please ensure location services are enabled.";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable. Please check your GPS/network connection.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }

      setLocationError(errorMessage);

      toast({
        title: "Location Error",
        description: errorMessage,
        variant: "destructive",
      });

      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  // Fetch activities from backend API with cooldown to prevent infinite loops
  const fetchActivities = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    // Skip cooldown if this is the first fetch (lastFetchTime is 0) or if force refresh is requested
    if (
      !forceRefresh &&
      lastFetchTime.current > 0 &&
      now - lastFetchTime.current < FETCH_COOLDOWN
    ) {
      return activities; // Return current activities
    }

    lastFetchTime.current = now;

    try {
      setLoading(true);

      const responseData = await apiClient.get("/activities?includeStages=true&includeTicket=true&limit=50");

      // Handle the response structure - could be direct data or wrapped in ApiResponse
      const activitiesData = (responseData as any)?.activities || responseData || [];

      // Debug logging to help diagnose stage issues
      console.log('Fetched activities:', activitiesData.length);
      activitiesData.forEach((activity: any) => {
        console.log(`Activity ${activity.id}: ${activity.activityType}, endTime: ${activity.endTime}, stages: ${activity.ActivityStage?.length || 0}`);
        if (activity.ActivityStage) {
          activity.ActivityStage.forEach((stage: any) => {
            console.log(`  Stage ${stage.id}: ${stage.stage}, endTime: ${stage.endTime}`);
          });
        }
      });

      // Update activities state - force update even if same data
      setActivities([...activitiesData]);

      // Find and set active activity (one without endTime)
      const activeActivity = activitiesData.find(
        (activity: ActivityLog) => !activity.endTime
      );
      setActiveActivity(activeActivity || null);

      return activitiesData;
    } catch (error: any) {
      // Show user-friendly error message
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to load activities";
      toast({
        title: "Error Loading Activities",
        description: `${errorMessage} (Status: ${error.response?.status || "Unknown"
          })`,
        variant: "destructive",
      });

      // Don't clear activities on error, return current activities to maintain state
      return activities;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch workable tickets for dropdown (excludes closed/pending)
  const fetchWorkableTickets = useCallback(async () => {
    try {
      setTicketsLoading(true);

      const response = await apiClient.get("/tickets?view=assigned-to-service-person&limit=50");

      // Parse tickets from response
      const responseData = response.data;
      let ticketsData = [];

      if (Array.isArray(responseData)) {
        ticketsData = responseData;
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        ticketsData = responseData.data;
      } else if (responseData?.tickets && Array.isArray(responseData.tickets)) {
        ticketsData = responseData.tickets;
      }

      // Filter tickets - exclude closed, resolved, and cancelled statuses
      const workableTicketsData = ticketsData.filter(
        (ticket: any) =>
          ticket &&
          ticket.status &&
          !["CLOSED", "RESOLVED", "CLOSED_PENDING", "CANCELLED"].includes(ticket.status)
      );

      setAllTickets(workableTicketsData);
    } catch (error: any) {
      // Don't show error toast for tickets as it's not critical
      setAllTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  // Fetch accepted schedules for dropdown
  const fetchAcceptedSchedules = useCallback(async () => {
    try {
      setSchedulesLoading(true);

      const response = await apiClient.get("/activity-schedule?status=ACCEPTED&limit=50");

      // Parse schedules from response
      const responseData = response.data || response;
      let schedulesData = [];

      if (Array.isArray(responseData)) {
        schedulesData = responseData;
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        schedulesData = responseData.data;
      }

      setAcceptedSchedules(schedulesData);
    } catch (error: any) {
      // Don't show error toast for schedules as it's not critical
      setAcceptedSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  // Start new activity
  const handleStartActivity = async () => {
    if (!formData.activityType) {
      toast({
        title: "Error",
        description: "Please select an Activity Type",
        variant: "destructive",
      });
      return;
    }

    // Only require scheduled activity for non-ad-hoc activity types
    if (!formData.activityScheduleId && !AD_HOC_ACTIVITY_TYPES.includes(formData.activityType)) {
      toast({
        title: "Error",
        description: "Please select a Scheduled Activity",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Get current location if not already available
      let locationData = activityLocation;
      let enhancedLocationData = enhancedLocation;

      if (!locationData && !enhancedLocationData) {
        locationData = await getCurrentLocationForActivity();
        if (!locationData) {
          toast({
            title: "Location Required",
            description:
              "Unable to get your location. Please allow location access to log activity.",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      // Prepare activity data for backend - use enhanced location if available
      const activityData: any = {
        activityType: formData.activityType,
        title: formData.title,
        latitude: enhancedLocationData?.latitude || locationData?.lat,
        longitude: enhancedLocationData?.longitude || locationData?.lng,
        location: enhancedLocationData?.address || locationData?.address,
        accuracy: enhancedLocationData?.accuracy,
        locationSource: enhancedLocationData?.source || 'gps',
        ticketId: formData.ticketId ? parseInt(formData.ticketId) : undefined,
        startTime: new Date().toISOString(),
      };

      // Include schedule ID if selected
      if (formData.activityScheduleId) {
        activityData.activityScheduleId = parseInt(formData.activityScheduleId);
      }

      // Create activity via backend API
      const response = await apiClient.post("/activities", activityData);

      // Reset form and close dialog
      setFormData({
        activityType: "",
        title: "",
        ticketId: "",
        activityScheduleId: "",
      });
      setActivityLocation(null);
      setEnhancedLocation(null);
      setLocationError(null);
      setShowLocationCapture(false);
      setDialogOpen(false);

      // Notify parent component to refresh dashboard data (activities will be updated there)
      if (onActivityChange) {
        await onActivityChange();
      }

      toast({
        title: "Activity Started",
        description: `Started "${formData.title}" successfully`,
      });
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.data?.error === "Check-in required") {
        toast({
          title: "Check-in Required",
          description:
            error.response.data.message ||
            "You must check in before logging activities. Please check in first with your location.",
          variant: "destructive",
        });
      } else {
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          "Failed to start activity";
        toast({
          title: "Error Starting Activity",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // End active activity (simple: end current stage, let backend handle activity end)
  const handleEndActivity = async () => {
    if (!activeActivity) {
      toast({
        title: "Error",
        description: "No active activity to end.",
        variant: "destructive",
      });
      return;
    }

    // Find the active stage (stage without endTime)
    const activeStage = activeActivity.ActivityStage?.find((stage: any) => !stage.endTime);

    // If no active stage, fall back to ending the activity itself
    if (!activeStage) {
      try {
        setSubmitting(true);

        await apiClient.put(`/activities/${activeActivity.id}/complete`, {
          endTime: new Date().toISOString(),
        });

        toast({
          title: "Activity Ended",
          description: "Activity has been ended.",
        });

        setActiveActivity(null);

        if (onActivityChange) {
          await onActivityChange();
        }
      } catch (error: any) {
        let errorMessage = "Failed to end activity";

        if (error.response) {
          errorMessage =
            error.response.data?.error ||
            error.response.data?.message ||
            errorMessage;

          if (error.response.status === 404) {
            errorMessage = "Activity not found or already ended";
          } else if (error.response.status === 400) {
            errorMessage = "Invalid request - activity may already be ended";
          } else if (error.response.status >= 500) {
            errorMessage = "Server error. Please try again later.";
          }
        } else if (error.request) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        }

        toast({
          title: "Error Ending Activity",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }

      return;
    }

    try {
      setSubmitting(true);

      await apiClient.put(
        `/activities/${activeActivity.id}/stages/${activeStage.id}`,
        {
          endTime: new Date().toISOString(),
        }
      );

      toast({
        title: "Activity Stage Ended",
        description: "Current activity stage has been ended.",
      });

      // Backend will automatically set activity endTime when last stage ends
      setActiveActivity(null);

      if (onActivityChange) {
        await onActivityChange();
      }
    } catch (error: any) {
      let errorMessage = "Failed to end activity";

      if (error.response) {
        errorMessage =
          error.response.data?.error ||
          error.response.data?.message ||
          errorMessage;

        if (error.response.status === 404) {
          errorMessage = "Activity not found or already ended";
        } else if (error.response.status === 400) {
          errorMessage = "Invalid request - activity may already be ended";
        } else if (error.response.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }
      } else if (error.request) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      toast({
        title: "Error Ending Activity",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format duration with live time calculation for ongoing activities
  const formatDuration = (minutes?: number, ongoing?: boolean, startTime?: string, endTime?: string) => {
    if (ongoing && startTime) {
      // Calculate live duration for ongoing activities
      const start = new Date(startTime);
      const now = currentTime;
      const diffMs = now.getTime() - start.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (diffMinutes < 60) {
        return `${diffMinutes}m ${diffSeconds}s`;
      }
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}m ${diffSeconds}s`;
    }

    // If not ongoing, try to calculate duration from start/end times if duration is not provided
    if (!ongoing && startTime && endTime && (!minutes || minutes <= 0)) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diffMs = end.getTime() - start.getTime();
      const diffMinutes = Math.ceil(diffMs / (1000 * 60)); // Use ceil to round up to at least 1 minute

      // Always show at least 1 minute for any completed activity
      const finalMinutes = Math.max(diffMinutes, 1);

      if (finalMinutes < 60) {
        return `${finalMinutes}m`;
      }
      const hours = Math.floor(finalMinutes / 60);
      const mins = finalMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    if (ongoing) return "Ongoing";

    // Check for valid duration - must be a positive number
    if (minutes === undefined || minutes === null || minutes <= 0) {
      return "N/A";
    }

    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get activity type info
  const getActivityTypeInfo = (type: string) => {
    return (
      ACTIVITY_TYPES.find((t) => t.value === type) || {
        label: type,
        icon: "📋",
      }
    );
  };

  // Update activities when prop changes with improved change detection
  useEffect(() => {
    // Don't override local state if we just ended an activity
    if (justEndedActivity.current) {
      return;
    }

    // Always use propActivities when provided, with change detection to prevent unnecessary re-renders
    if (propActivities !== undefined && Array.isArray(propActivities)) {
      // Check if activities actually changed to prevent unnecessary updates
      const currentIds = activities.map(a => a.id).sort();
      const newIds = propActivities.map(a => a.id).sort();
      const hasChanged = currentIds.length !== newIds.length ||
        currentIds.some((id, index) => id !== newIds[index]);

      if (hasChanged || !initialLoadComplete.current) {
        setActivities([...propActivities]); // Create new array to force re-render
        setLoading(false);
        initialLoadComplete.current = true;

        // Find active activity from props
        const activeActivity = propActivities.find(
          (activity: ActivityLog) => !activity.endTime
        );
        setActiveActivity(activeActivity || null);
      }
    }
    // Don't fetch activities here to avoid infinite loops
    // Let the initial load effect handle fetching when no props are provided
  }, [propActivities, activities]);

  // Handle activity changes and refresh data
  const handleActivityChange = useCallback(async () => {
    if (activityChangeInProgress.current) {
      return;
    }

    try {
      activityChangeInProgress.current = true;

      // Only notify parent component, don't fetch activities here to avoid loops
      if (onActivityChange) {
        await onActivityChange();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to update activities",
        variant: "destructive",
      });
    } finally {
      // Reset the flag after a longer delay to prevent rapid successive calls
      setTimeout(() => {
        activityChangeInProgress.current = false;
      }, 1000); // Increased to 1 second
    }
  }, [onActivityChange, toast]);

  // Timer for live duration updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  // Initial load - only run once on mount when no props are provided
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!mounted) return;

      // Add small delay to ensure parent component finishes loading first
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!mounted) return;

      // Only fetch activities if no props are provided
      // If props are provided, the propActivities useEffect will handle the data
      if (!propActivities || !Array.isArray(propActivities)) {
        try {
          await fetchActivities();
          initialLoadComplete.current = true;
        } catch (error) {
          if (mounted) {
            setLoading(false);
            initialLoadComplete.current = true;
          }
        }
      } else {
        setLoading(false);
        initialLoadComplete.current = true;
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Force re-render if activities is not an array
  if (!Array.isArray(activities)) {
    setActivities([]);
  }

  // Memoize the component's JSX to prevent unnecessary re-renders
  const activityLoggerContent = useMemo(
    () => (
      <Card className="w-full border border-[#92A2A5] shadow-sm rounded-xl overflow-hidden">
        {/* Header */}
        <CardHeader className={`${isMobile ? 'p-4' : 'p-5'} bg-[#AEBFC3]/10 border-b border-[#AEBFC3]/30`}>
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-4' : 'flex-row'}`}>
            <CardTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#6F8A9D]/20">
                <Activity className="h-5 w-5 text-[#546A7A]" />
              </div>
              <div>
                <span className={`font-bold text-[#546A7A] ${isMobile ? 'text-lg' : 'text-lg'}`}>Activity Log</span>
              </div>
            </CardTitle>
            <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
              {activeActivity && (
                <Button
                  onClick={handleEndActivity}
                  disabled={submitting}
                  variant="destructive"
                  size={isMobile ? "default" : "sm"}
                  className={`${isMobile ? 'flex-1 h-11' : 'h-9'} font-medium rounded-lg`}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  End Activity
                </Button>
              )}
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (open) {
                    fetchWorkableTickets();
                    fetchAcceptedSchedules();
                  } else {
                    setActivityLocation(null);
                    setLocationError(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size={isMobile ? "default" : "sm"}
                    disabled={!!activeActivity}
                    className={`${isMobile ? 'flex-1 h-11' : 'h-9'} bg-[#546A7A] hover:bg-[#546A7A] font-medium rounded-lg`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log Activity
                  </Button>
                </DialogTrigger>
                <DialogContent className={isMobile ? "w-[95vw] max-w-[95vw] max-h-[90vh] p-0 overflow-hidden rounded-2xl" : "sm:max-w-[520px] max-h-[90vh] p-0 overflow-hidden rounded-2xl"}>
                  {/* Premium Dialog Header */}
                  <div className="relative bg-gradient-to-br from-[#546A7A] via-[#6F8A9D] to-[#96AEC2] p-5 sm:p-6 overflow-hidden">
                    {/* Background decorations - floating orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/15 rounded-full blur-2xl"></div>
                      <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/5 rounded-full blur-xl"></div>
                      {/* Subtle grid pattern */}
                      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    </div>
                    <DialogHeader className="relative z-10 p-0">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
                          <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                        </div>
                        <div>
                          <DialogTitle className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow">Log New Activity</DialogTitle>
                          <p className="text-white/80 text-sm sm:text-base mt-1">Start a new work activity</p>
                        </div>
                      </div>
                    </DialogHeader>
                  </div>

                  {/* Dialog Content */}
                  <div className={`p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[60vh] bg-gradient-to-b from-[#AEBFC3]/10 to-white`}>
                    {/* Activity Type Cards Grid */}
                    <div className="space-y-3">
                      <Label htmlFor="activityType" className="text-sm font-bold text-[#546A7A] flex items-center gap-2.5">
                        <span className="w-6 h-6 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">1</span>
                        Activity Type
                      </Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                        {ACTIVITY_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                activityType: type.value,
                                ticketId: "",
                                activityScheduleId: "",
                              }))
                            }
                            className={cn(
                              "relative flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-300 touch-manipulation min-h-[80px] sm:min-h-[90px]",
                              formData.activityType === type.value
                                ? "border-[#6F8A9D] bg-gradient-to-br from-[#96AEC2]/20 to-[#6F8A9D]/15 shadow-lg shadow-[#6F8A9D]/20 scale-[1.02] ring-2 ring-[#96AEC2]/30"
                                : "border-[#AEBFC3] bg-white hover:border-[#92A2A5] hover:bg-[#AEBFC3]/10 hover:shadow-md active:scale-[0.98]"
                            )}
                          >
                            <span className="text-2xl sm:text-[28px] mb-1.5 drop-shadow-sm">{type.icon}</span>
                            <span className={cn(
                              "text-[10px] sm:text-[11px] font-semibold text-center leading-tight tracking-tight",
                              formData.activityType === type.value
                                ? "text-[#546A7A]"
                                : "text-[#5D6E73]"
                            )}>
                              {type.label}
                            </span>
                            {formData.activityType === type.value && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-full flex items-center justify-center shadow-lg shadow-[#82A094]/40 animate-in zoom-in-50 duration-200">
                                <CheckCircle className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Show scheduled activity dropdown - only for activity types that require scheduling */}
                    {formData.activityType && !AD_HOC_ACTIVITY_TYPES.includes(formData.activityType) && (
                      <div className="space-y-3">
                        <Label htmlFor="activityScheduleId" className="text-sm font-bold text-[#546A7A] flex items-center gap-2.5">
                          <span className="w-6 h-6 bg-gradient-to-br from-[#CE9F6B] to-[#976E44] rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">2</span>
                          Scheduled Activity
                          <span className="text-xs font-semibold text-[#976E44] bg-[#CE9F6B]/15 px-2 py-1 rounded-full border border-[#CE9F6B]">Required</span>
                        </Label>
                        <Select
                          value={formData.activityScheduleId}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              activityScheduleId: value,
                            }))
                          }
                        >
                          <SelectTrigger
                            id="activityScheduleId"
                            className={`${isMobile ? 'h-14 text-base' : 'h-12'} rounded-xl border-2 border-[#AEBFC3] focus:border-[#6F8A9D] bg-white shadow-sm hover:border-[#92A2A5] transition-colors`}
                          >
                            <SelectValue placeholder="Select scheduled activity" />
                          </SelectTrigger>
                          <SelectContent>
                            {acceptedSchedules.filter(
                              (schedule) => schedule.activityType === formData.activityType
                            ).length === 0 ? (
                              <div className="p-3 text-center text-sm text-[#979796]">
                                No schedules available for this activity type
                              </div>
                            ) : (
                              acceptedSchedules
                                .filter(
                                  (schedule) => schedule.activityType === formData.activityType
                                )
                                .map((schedule) => (
                                  <SelectItem
                                    key={schedule.id}
                                    value={schedule.id.toString()}
                                    className="py-3"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {schedule.description || `${schedule.activityType} - ${new Date(schedule.scheduledDate).toLocaleDateString()}`}
                                      </span>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                          {schedule.activityType}
                                        </Badge>
                                        {schedule.priority && (
                                          <Badge
                                            className={`text-xs ${schedule.priority === "HIGH"
                                              ? "bg-[#E17F70]/20 text-[#75242D]"
                                              : schedule.priority === "MEDIUM"
                                                ? "bg-[#CE9F6B]/20 text-[#976E44]"
                                                : "bg-[#A2B9AF]/20 text-[#4F6A64]"
                                              }`}
                                          >
                                            {schedule.priority}
                                          </Badge>
                                        )}
                                        {schedule.location && (
                                          <span className="truncate">
                                            📍 {schedule.location}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Show info message for ad-hoc activity types */}
                    {formData.activityType && AD_HOC_ACTIVITY_TYPES.includes(formData.activityType) && (
                      <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 border border-[#96AEC2] rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-md flex items-center justify-center text-white text-xs">✓</span>
                          <span className="text-sm text-[#546A7A] font-medium">
                            No scheduling required for {ACTIVITY_TYPES.find(t => t.value === formData.activityType)?.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Location Section */}
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-[#546A7A] flex items-center gap-2.5">
                        <span className="w-6 h-6 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">3</span>
                        Location
                      </Label>

                      {/* Show location capture dialog when needed */}
                      {showLocationCapture ? (
                        <div className="bg-gradient-to-br from-[#96AEC2]/10 to-[#6F8A9D]/10 border-2 border-[#96AEC2] rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-[#E17F70] to-[#9E3B47] rounded-xl flex items-center justify-center shadow-md">
                                <MapPin className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <h3 className="font-bold text-[#546A7A] text-sm">Capture Location</h3>
                                <p className="text-xs text-[#AEBFC3]0">GPS or manual selection</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowLocationCapture(false)}
                              className="h-8 w-8 p-0 rounded-full hover:bg-[#92A2A5]/30"
                            >
                              ✕
                            </Button>
                          </div>
                          <EnhancedLocationCapture
                            onLocationCapture={(location) => {
                              setEnhancedLocation(location);
                              // Convert to legacy format for compatibility
                              setActivityLocation({
                                lat: location.latitude,
                                lng: location.longitude,
                                address: location.address
                              });
                              setShowLocationCapture(false);
                              setLocationError(null);
                              toast({
                                title: "Location Captured",
                                description: `${location.source === 'manual' ? 'Manual' : 'GPS'} location set successfully.`,
                              });
                            }}
                            previousLocation={enhancedLocation || undefined}
                            required={true}
                            enableJumpDetection={true}
                            autoCapture={false}
                            className=""
                          />
                        </div>
                      ) : (
                        /* Show captured location or capture button */
                        <div className="space-y-2">
                          {(activityLocation || enhancedLocation) ? (
                            /* Location captured - show details */
                            <div className="bg-gradient-to-br from-[#A2B9AF]/15 to-[#82A094]/10 border-2 border-[#82A094] rounded-2xl p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-xl flex items-center justify-center shadow-md shadow-[#82A094]/40">
                                    <CheckCircle className="h-5 w-5 text-white" />
                                  </div>
                                  <span className="font-bold text-[#4F6A64] text-sm">Location Ready</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {enhancedLocation?.source === 'manual' ? (
                                    <Badge variant="secondary" className="text-xs bg-[#96AEC2]/20 text-[#546A7A] px-2 py-1">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      Manual
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs bg-[#A2B9AF]/20 text-[#4F6A64] px-2 py-1">
                                      <Navigation className="h-3 w-3 mr-1" />
                                      GPS
                                    </Badge>
                                  )}
                                  {/* Recapture button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowLocationCapture(true)}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-[#96AEC2]/20"
                                    title="Recapture location"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 text-[#546A7A]" />
                                  </Button>
                                  {/* Clear button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActivityLocation(null);
                                      setEnhancedLocation(null);
                                      toast({
                                        title: "Location Cleared",
                                        description: "Please capture location again to continue.",
                                      });
                                    }}
                                    className="h-7 w-7 p-0 rounded-full hover:bg-[#E17F70]/20"
                                    title="Clear location"
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-[#E17F70]" />
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-3 space-y-1">
                                <p className="text-sm text-[#5D6E73] break-words">
                                  📍 {(enhancedLocation?.address || activityLocation?.address) ||
                                    `${(enhancedLocation?.latitude || activityLocation?.lat)?.toFixed(6)}, ${(enhancedLocation?.longitude || activityLocation?.lng)?.toFixed(6)}`}
                                </p>
                                <p className="text-xs text-[#AEBFC3]0">
                                  🕒 {enhancedLocation ? new Date(enhancedLocation.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ) : (
                            /* No location - show capture button */
                            <button
                              type="button"
                              onClick={() => setShowLocationCapture(true)}
                              className={`w-full border-2 border-dashed border-[#96AEC2] rounded-xl bg-gradient-to-r from-[#96AEC2]/10/50 to-[#6F8A9D]/10/50 hover:from-[#96AEC2]/10 hover:to-[#6F8A9D]/10 transition-all duration-200 ${isMobile ? 'py-5' : 'py-4'}`}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-xl flex items-center justify-center">
                                  <MapPin className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-[#546A7A] font-semibold text-sm">Capture Location</span>
                                <span className="text-[#979796] text-xs">GPS or manual selection</span>
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dialog Footer */}
                  <div className="border-t border-[#92A2A5]/30 bg-gradient-to-b from-[#AEBFC3]/5 to-[#AEBFC3]/10 p-4 sm:p-5">
                    <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'justify-end flex-row'}`}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setShowLocationCapture(false);
                          setEnhancedLocation(null);
                        }}
                        disabled={submitting}
                        className={`${isMobile ? 'w-full h-12 order-2' : ''} rounded-xl border-2 border-[#92A2A5] hover:bg-[#AEBFC3]/10 text-[#5D6E73] font-medium`}
                      >
                        Cancel
                      </Button>

                      {/* Show message if location not captured */}
                      {!activityLocation && !enhancedLocation ? (
                        <div className={`${isMobile ? 'w-full order-1' : ''} flex items-center justify-center gap-2 px-4 py-3 bg-[#CE9F6B]/15 border-2 border-[#CE9F6B] rounded-xl text-[#976E44]`}>
                          <MapPin className="h-5 w-5 animate-pulse" />
                          <span className="font-semibold text-sm">Capture location to start activity</span>
                        </div>
                      ) : (
                        <Button
                          onClick={handleStartActivity}
                          disabled={
                            submitting ||
                            !formData.activityType ||
                            // Only require schedule for non-ad-hoc activity types
                            (!AD_HOC_ACTIVITY_TYPES.includes(formData.activityType) && !formData.activityScheduleId)
                          }
                          className={`${isMobile ? 'w-full h-14 order-1' : 'h-11'} bg-gradient-to-r from-[#82A094] to-[#4F6A64] hover:from-[#4F6A64] hover:to-[#4F6A64] rounded-xl font-bold shadow-lg shadow-[#82A094]/40 text-white active:scale-[0.98] transition-transform`}
                        >
                          {submitting ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-5 w-5 mr-2 fill-current" />
                          )}
                          Start Activity
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`space-y-4 ${isMobile ? 'p-4' : 'p-5'}`}>
          {/* Active Activity */}
          {activeActivity && (
            <div className="bg-white border border-[#A2B9AF] rounded-xl overflow-hidden shadow-sm">
              {/* Active header bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#A2B9AF]/10 border-b border-[#A2B9AF]/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#A2B9AF]/100 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-[#4F6A64]">Active Now</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#A2B9AF]/20 text-[#4F6A64] text-xs font-bold rounded-full">
                    {formatDuration(undefined, true, activeActivity.startTime)}
                  </span>
                </div>
                <span className="text-xs text-[#AEBFC3]0">
                  Started {new Date(activeActivity.startTime).toLocaleTimeString()}
                </span>
              </div>

              {/* Activity content */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#AEBFC3]/20 flex items-center justify-center text-lg">
                    {getActivityTypeInfo(activeActivity.activityType).icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#AEBFC3]0">
                        {getActivityTypeInfo(activeActivity.activityType).label}
                      </span>
                    </div>
                    <h4 className="font-semibold text-[#546A7A]">{activeActivity.title}</h4>
                    {activeActivity.description && (
                      <p className="text-sm text-[#AEBFC3]0 mt-1 line-clamp-2">
                        {activeActivity.description}
                      </p>
                    )}
                  </div>
                </div>

                {activeActivity.location && (
                  <div className="flex items-start gap-2 mt-3 pt-3 border-t border-[#AEBFC3]/30">
                    <MapPin className="h-4 w-4 text-[#979796] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#AEBFC3]0 break-words leading-relaxed">
                      {activeActivity.location}
                    </span>
                  </div>
                )}
              </div>
              {activeActivity.ticket && (
                <div className="mt-3 p-3 bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#546A7A]" />
                      <span className="font-medium text-[#546A7A]">
                        Ticket #{activeActivity.ticket.id}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Badge
                        className={`text-xs ${activeActivity.ticket.status === "OPEN"
                          ? "bg-[#96AEC2]/20 text-[#546A7A]"
                          : activeActivity.ticket.status === "IN_PROGRESS"
                            ? "bg-[#CE9F6B]/20 text-[#976E44]"
                            : activeActivity.ticket.status === "ASSIGNED"
                              ? "bg-[#6F8A9D]/20 text-[#546A7A]"
                              : activeActivity.ticket.status === "RESOLVED"
                                ? "bg-[#A2B9AF]/20 text-[#4F6A64]"
                                : "bg-[#AEBFC3]/20 text-[#546A7A]"
                          }`}
                      >
                        {activeActivity.ticket.status || "OPEN"}
                      </Badge>
                      <Badge
                        className={`text-xs ${activeActivity.ticket.priority === "CRITICAL"
                          ? "bg-[#E17F70]/20 text-[#75242D]"
                          : activeActivity.ticket.priority === "HIGH"
                            ? "bg-[#CE9F6B]/20 text-[#976E44]"
                            : activeActivity.ticket.priority === "MEDIUM"
                              ? "bg-[#96AEC2]/20 text-[#546A7A]"
                              : "bg-[#AEBFC3]/20 text-[#546A7A]"
                          }`}
                      >
                        {activeActivity.ticket.priority || "MEDIUM"}
                      </Badge>
                    </div>
                  </div>
                  <h5 className="text-sm font-medium text-[#546A7A] mb-1">
                    {activeActivity.ticket.title}
                  </h5>
                  <p className="text-xs text-[#546A7A]">
                    Customer:{" "}
                    {activeActivity.ticket.customer?.companyName ||
                      "Unknown Customer"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Recent Activities */}
          <div className="space-y-3">
            {(() => {
              // Filter activities for today and yesterday only
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

              const recentActivities = activities.filter((activity) => {
                // Exclude active activity
                if (activity.id === activeActivity?.id) return false;

                // Filter for today and yesterday only
                const activityDate = new Date(activity.startTime);
                return activityDate >= yesterday;
              });

              return (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#5D6E73]">
                      Recent Activities
                    </h4>
                    <span className="text-xs text-[#AEBFC3]0">
                      Today & Yesterday ({recentActivities.length})
                    </span>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading activities...
                      </p>
                    </div>
                  ) : recentActivities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No recent activities (today & yesterday)</p>
                    </div>
                  ) : (
                    recentActivities
                      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) // Most recent first
                      .map((activity) => {
                        const isOngoing = !activity.endTime || activity.endTime === null || activity.endTime === '';
                        return (
                          <div
                            key={activity.id}
                            className={`${isMobile ? 'p-3' : 'p-3'} border rounded-lg hover:bg-[#AEBFC3]/10 touch-manipulation`}
                          >
                            <div className={`flex items-center justify-between mb-2 ${isMobile ? 'flex-col gap-2' : 'flex-row'}`}>
                              <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap w-full justify-center' : ''}`}>
                                <span className={isMobile ? "text-base" : "text-sm"}>
                                  {getActivityTypeInfo(activity.activityType).icon}
                                </span>
                                <Badge variant="outline" className={isMobile ? "text-sm" : "text-xs"}>
                                  {getActivityTypeInfo(activity.activityType).label}
                                </Badge>
                                {isOngoing ? (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-[#CE9F6B]/20 text-[#976E44] border-[#CE9F6B]"
                                  >
                                    {formatDuration(undefined, true, activity.startTime)}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    {formatDuration(activity.duration, false, activity.startTime, activity.endTime)}
                                  </Badge>
                                )}
                              </div>
                              <span className={`${isMobile ? 'text-sm w-full text-center' : 'text-xs'} text-muted-foreground`}>
                                {new Date(activity.startTime).toLocaleDateString()}
                              </span>
                            </div>
                            <h5 className={`${isMobile ? 'text-base' : 'text-sm'} font-medium ${isMobile ? 'text-center' : ''}`}>{activity.title}</h5>
                            {activity.description && (
                              <p className={`${isMobile ? 'text-sm text-center' : 'text-xs'} text-muted-foreground mt-1`}>
                                {activity.description}
                              </p>
                            )}
                            <div className={`flex items-center gap-4 mt-2 text-muted-foreground ${isMobile ? 'flex-col gap-2 text-sm' : 'text-xs flex-row'}`}>
                              <div className="flex items-center gap-1">
                                <Clock className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
                                <span>
                                  {new Date(activity.startTime).toLocaleTimeString()}
                                </span>
                                {activity.endTime && (
                                  <span>
                                    {" "}
                                    -{" "}
                                    {new Date(activity.endTime).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                              {activity.location && (
                                <div className="flex items-start gap-1">
                                  <MapPin className={`flex-shrink-0 mt-0.5 ${isMobile ? "h-4 w-4" : "h-3 w-3"}`} />
                                  <span className="break-words leading-relaxed text-xs">
                                    {activity.location}
                                  </span>
                                </div>
                              )}
                            </div>
                            {activity.ticket && (
                              <div className="mt-2 p-2 bg-[#96AEC2]/10 border border-[#96AEC2] rounded">
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex items-center gap-1">
                                    <FileText className="h-3 w-3 text-[#546A7A]" />
                                    <span className="text-xs font-medium text-[#546A7A]">
                                      Ticket #{activity.ticket.id}
                                    </span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Badge
                                      className={`text-xs ${activity.ticket.status === "OPEN"
                                        ? "bg-[#96AEC2]/20 text-[#546A7A]"
                                        : activity.ticket.status === "IN_PROGRESS"
                                          ? "bg-[#CE9F6B]/20 text-[#976E44]"
                                          : activity.ticket.status === "ASSIGNED"
                                            ? "bg-[#6F8A9D]/20 text-[#546A7A]"
                                            : activity.ticket.status === "RESOLVED"
                                              ? "bg-[#A2B9AF]/20 text-[#4F6A64]"
                                              : "bg-[#AEBFC3]/20 text-[#546A7A]"
                                        }`}
                                    >
                                      {activity.ticket.status || "OPEN"}
                                    </Badge>
                                    <Badge
                                      className={`text-xs ${activity.ticket.priority === "CRITICAL"
                                        ? "bg-[#E17F70]/20 text-[#75242D]"
                                        : activity.ticket.priority === "HIGH"
                                          ? "bg-[#CE9F6B]/20 text-[#976E44]"
                                          : activity.ticket.priority === "MEDIUM"
                                            ? "bg-[#96AEC2]/20 text-[#546A7A]"
                                            : "bg-[#AEBFC3]/20 text-[#546A7A]"
                                        }`}
                                    >
                                      {activity.ticket.priority || "MEDIUM"}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-xs text-[#546A7A] font-medium mb-1">
                                  {activity.ticket.title}
                                </p>
                                <p className="text-xs text-[#546A7A]">
                                  {activity.ticket.customer?.companyName ||
                                    "Unknown Customer"}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>
    ),
    [
      loading,
      submitting,
      activeActivity,
      activities,
      dialogOpen,
      formData,
      activityLocation,
      locationLoading,
      locationError,
      allTickets,
      acceptedSchedules,
      showLocationCapture,
      enhancedLocation,
      isMobile,
      currentTime,
      fetchActivities,
      handleEndActivity,
      handleStartActivity,
      getCurrentLocationForActivity,
      toast,
    ]
  );

  return activityLoggerContent;
}

const ActivityLogger = React.memo(ActivityLoggerComponent);

export default ActivityLogger;
