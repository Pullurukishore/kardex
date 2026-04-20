import { UserRole } from "@/types/user.types";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  MapPin,
  ChevronDown,
  Ticket,
  Calendar,
  Activity,
  IndianRupee,
  FileText,
  Zap,
  Clock,
  History,
  TrendingUp,
  Brain,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  children?: NavItem[];
  disabled?: boolean;
  badge?: string;
  iconColor?: string;
  iconBgColor?: string;
};

// Admin navigation - loaded only for admin users
export const adminNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Sales & Offers",
    href: "/admin/offers",
    icon: IndianRupee,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
    children: [
      {
        title: "Offers",
        href: "/admin/offers",
        icon: IndianRupee,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Targets",
        href: "/admin/targets",
        icon: BarChart2,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      },
      {
        title: "Spare Parts",
        href: "/admin/spare-parts",
        icon: Activity,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      },
      {
        title: "Forecast",
        href: "/admin/forecast",
        icon: BarChart2,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Growth Pillar",
        href: "/admin/growth-report",
        icon: TrendingUp,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Activity Log",
        href: "/admin/offer-activity-log",
        icon: History,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      }
    ]
  },
  {
    title: "Service Management",
    href: "/admin/tickets",
    icon: Ticket,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10",
    children: [
      {
        title: "Tickets",
        href: "/admin/tickets",
        icon: Ticket,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Customers",
        href: "/admin/customers",
        icon: Users,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Service Zones",
        href: "/admin/service-zones",
        icon: MapPin,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#9E3B47]",
        iconBgColor: "bg-[#EEC1BF]/10"
      },
      {
        title: "Service Persons",
        href: "/admin/service-person",
        icon: Activity,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      },
      {
        title: "Zone Users",
        href: "/admin/zone-users",
        icon: Users,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#546A7A]/10"
      },
      {
        title: "Activity Log",
        href: "/admin/ticket-activity-log",
        icon: History,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      }
    ]
  },
  {
    title: "Activity Management",
    href: "/admin/attendance",
    icon: Activity,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10",
    children: [
      {
        title: "Activity Scheduling",
        href: "/admin/activity-scheduling",
        icon: Clock,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#546A7A]/10"
      },
      {
        title: "Daily Activity",
        href: "/admin/attendance",
        icon: Calendar,
        roles: [UserRole.ADMIN],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      }
    ]
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: FileText,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
  },
];

// Service Person navigation - loaded only for service persons
export const servicePersonNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/service-person/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.SERVICE_PERSON],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "My Tickets",
    href: "/service-person/tickets",
    icon: Ticket,
    roles: [UserRole.SERVICE_PERSON],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
];

// Zone Manager navigation - loaded only for zone managers
export const zoneManagerNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/zone/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Sales & Offers",
    href: "/zone-manager/offers",
    icon: IndianRupee,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
    children: [
      {
        title: "Offers",
        href: "/zone-manager/offers",
        icon: IndianRupee,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Spare Parts",
        href: "/zone-manager/spare-parts",
        icon: Activity,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      },
      {
        title: "Forecast",
        href: "/zone-manager/forecast",
        icon: BarChart2,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
    ]
  },
  {
    title: "Service Management",
    href: "/zone/tickets",
    icon: Ticket,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10",
    children: [
      {
        title: "Tickets",
        href: "/zone/tickets",
        icon: Ticket,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Customers",
        href: "/zone/customers",
        icon: Users,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Service Persons",
        href: "/zone/service-persons",
        icon: Activity,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      }
    ]
  },
  {
    title: "Activity Management",
    href: "/zone/attendance",
    icon: Activity,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10",
    children: [
      {
        title: "Activity Scheduling",
        href: "/zone/activity-scheduling",
        icon: Clock,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#546A7A]/10"
      },
      {
        title: "Daily Activity",
        href: "/zone/attendence",
        icon: Calendar,
        roles: [UserRole.ZONE_MANAGER],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      }
    ]
  },
  {
    title: "Reports",
    href: "/zone-manager/reports",
    icon: FileText,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Zone User navigation - loaded only for zone users
export const zoneUserNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/zone/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Sales & Offers",
    href: "/zone/offers",
    icon: IndianRupee,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
    children: [
      {
        title: "Offers",
        href: "/zone/offers",
        icon: IndianRupee,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "My Forecast",
        href: "/zone/forecast",
        icon: BarChart2,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Spare Parts",
        href: "/zone/spare-parts",
        icon: Activity,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      }
    ]
  },
  {
    title: "Service Management",
    href: "/zone/tickets",
    icon: Ticket,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10",
    children: [
      {
        title: "Tickets",
        href: "/zone/tickets",
        icon: Ticket,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Customers",
        href: "/zone/customers",
        icon: Users,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Service Persons",
        href: "/zone/service-persons",
        icon: Activity,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      }
    ]
  },
  {
    title: "Activity Management",
    href: "/zone/attendance",
    icon: Activity,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10",
    children: [
      {
        title: "Activity Scheduling",
        href: "/zone/activity-scheduling",
        icon: Clock,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#546A7A]/10"
      },
      {
        title: "Daily Activity",
        href: "/zone/attendence",
        icon: Calendar,
        roles: [UserRole.ZONE_USER],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      }
    ]
  },
  {
    title: "Reports",
    href: "/zone/reports",
    icon: FileText,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Expert Helpdesk navigation - loaded only for expert helpdesk users
// Same structure as admin but with expert-specific paths and role restrictions
export const expertHelpdeskNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/expert/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Sales & Offers",
    href: "/expert/offers",
    icon: IndianRupee,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
    children: [
      {
        title: "Offers",
        href: "/expert/offers",
        icon: IndianRupee,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Targets",
        href: "/expert/targets",
        icon: BarChart2,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      },
      {
        title: "Spare Parts",
        href: "/expert/spare-parts",
        icon: Activity,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      },
      {
        title: "Forecast",
        href: "/expert/forecast",
        icon: BarChart2,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      }
    ]
  },
  {
    title: "Service Management",
    href: "/expert/tickets",
    icon: Ticket,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10",
    children: [
      {
        title: "My Tickets",
        href: "/expert/tickets",
        icon: Ticket,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#96AEC2]/10"
      },
      {
        title: "Customers",
        href: "/expert/customers",
        icon: Users,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#6F8A9D]/10"
      },
      {
        title: "Service Zones",
        href: "/expert/service-zones",
        icon: MapPin,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#9E3B47]",
        iconBgColor: "bg-[#EEC1BF]/10"
      },
      {
        title: "Service Persons",
        href: "/expert/service-person",
        icon: Activity,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#976E44]",
        iconBgColor: "bg-[#CE9F6B]/10"
      }
    ]
  },
  {
    title: "Activity Management",
    href: "/expert/attendance",
    icon: Activity,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10",
    children: [
      {
        title: "Activity Scheduling",
        href: "/expert/activity-scheduling",
        icon: Clock,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#546A7A]",
        iconBgColor: "bg-[#546A7A]/10"
      },
      {
        title: "Daily Activity",
        href: "/expert/attendance",
        icon: Calendar,
        roles: [UserRole.EXPERT_HELPDESK],
        iconColor: "text-[#4F6A64]",
        iconBgColor: "bg-[#82A094]/10"
      }
    ]
  },
  {
    title: "Reports",
    href: "/expert/reports",
    icon: FileText,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
  },
];

// Sub-module type for FSM
export type SubModule = 'tickets' | 'offers' | null;

// ============================================
// TICKETS-FOCUSED NAVIGATION (Service & Activity)
// ============================================

// Admin Tickets Navigation (flattened - no submenus)
export const adminTicketsNavigation: NavItem[] = [
  {
    title: "AI Intelligence",
    href: "/admin/ticket-insights",
    icon: Brain,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#9E3B47]/10",
    badge: "AI"
  },
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Tickets",
    href: "/admin/tickets",
    icon: Ticket,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Zones",
    href: "/admin/service-zones",
    icon: MapPin,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },
  {
    title: "Service Persons",
    href: "/admin/service-person",
    icon: Activity,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Zone Users",
    href: "/admin/zone-users",
    icon: Users,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Activity Scheduling",
    href: "/admin/activity-scheduling",
    icon: Clock,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Daily Activity",
    href: "/admin/attendance",
    icon: Calendar,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Reports",
    href: "/admin/reports?reportType=ticket-summary",
    icon: FileText,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
  },
  {
    title: "Activity Log",
    href: "/admin/ticket-activity-log",
    icon: History,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
  },
];

// Admin Offers Navigation (flattened - no submenus)
export const adminOffersNavigation: NavItem[] = [
  {
    title: "AI Intelligence",
    href: "/admin/ai-insights",
    icon: Brain,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#82A094]",
    iconBgColor: "bg-[#82A094]/10",
    badge: "AI"
  },
  {
    title: "Offers",
    href: "/admin/offers",
    icon: IndianRupee,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Customers",
    href: "/admin/customers",
    icon: Users,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Zones",
    href: "/admin/service-zones",
    icon: MapPin,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },
  {
    title: "Zone Users",
    href: "/admin/zone-users",
    icon: Users,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Targets",
    href: "/admin/targets",
    icon: BarChart2,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Spare Parts",
    href: "/admin/spare-parts",
    icon: Activity,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Forecast",
    href: "/admin/forecast",
    icon: BarChart2,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Offer Summary Report",
    href: "/admin/reports?reportType=offer-summary",
    icon: FileText,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Growth Pillar",
    href: "/admin/growth-report",
    icon: TrendingUp,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Activity Log",
    href: "/admin/offer-activity-log",
    icon: History,
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  }
];

// Zone Manager Tickets Navigation (flattened)
export const zoneManagerTicketsNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/zone/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Tickets",
    href: "/zone/tickets",
    icon: Ticket,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Customers",
    href: "/zone/customers",
    icon: Users,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Persons",
    href: "/zone/service-persons",
    icon: Activity,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Activity Scheduling",
    href: "/zone/activity-scheduling",
    icon: Clock,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Daily Activity",
    href: "/zone/attendence",
    icon: Calendar,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Reports",
    href: "/zone-manager/reports?reportType=ticket-summary",
    icon: FileText,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Zone Manager Offers Navigation (flattened)
export const zoneManagerOffersNavigation: NavItem[] = [
  {
    title: "Offers",
    href: "/zone-manager/offers",
    icon: IndianRupee,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Customers",
    href: "/zone/customers",
    icon: Users,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Spare Parts",
    href: "/zone-manager/spare-parts",
    icon: Activity,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Forecast",
    href: "/zone-manager/forecast",
    icon: BarChart2,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Offer Summary Report",
    href: "/zone-manager/reports?reportType=offer-summary",
    icon: FileText,
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Zone User Tickets Navigation (flattened)
export const zoneUserTicketsNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/zone/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Tickets",
    href: "/zone/tickets",
    icon: Ticket,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Customers",
    href: "/zone/customers",
    icon: Users,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Persons",
    href: "/zone/service-persons",
    icon: Activity,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Activity Scheduling",
    href: "/zone/activity-scheduling",
    icon: Clock,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Daily Activity",
    href: "/zone/attendence",
    icon: Calendar,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Reports",
    href: "/zone/reports?reportType=ticket-summary",
    icon: FileText,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Zone User Offers Navigation (flattened)
export const zoneUserOffersNavigation: NavItem[] = [
  {
    title: "Offers",
    href: "/zone/offers",
    icon: IndianRupee,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Customers",
    href: "/zone/customers",
    icon: Users,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "My Forecast",
    href: "/zone/forecast",
    icon: BarChart2,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Spare Parts",
    href: "/zone/spare-parts",
    icon: Activity,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Offer Summary Report",
    href: "/zone/reports?reportType=offer-summary",
    icon: FileText,
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Expert Helpdesk Tickets Navigation (flattened)
export const expertHelpdeskTicketsNavigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/expert/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "My Tickets",
    href: "/expert/tickets",
    icon: Ticket,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Customers",
    href: "/expert/customers",
    icon: Users,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Zones",
    href: "/expert/service-zones",
    icon: MapPin,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },
  {
    title: "Service Persons",
    href: "/expert/service-person",
    icon: Activity,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Activity Scheduling",
    href: "/expert/activity-scheduling",
    icon: Clock,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  {
    title: "Daily Activity",
    href: "/expert/attendance",
    icon: Calendar,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Reports",
    href: "/expert/reports?reportType=ticket-summary",
    icon: FileText,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10",
  },
];

// Expert Helpdesk Offers Navigation (flattened)
export const expertHelpdeskOffersNavigation: NavItem[] = [
  {
    title: "Offers",
    href: "/expert/offers",
    icon: IndianRupee,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Customers",
    href: "/expert/customers",
    icon: Users,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  {
    title: "Service Zones",
    href: "/expert/service-zones",
    icon: MapPin,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },
  {
    title: "Targets",
    href: "/expert/targets",
    icon: BarChart2,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  {
    title: "Spare Parts",
    href: "/expert/spare-parts",
    icon: Activity,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  {
    title: "Forecast",
    href: "/expert/forecast",
    icon: BarChart2,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  {
    title: "Offer Summary Report",
    href: "/expert/reports?reportType=offer-summary",
    icon: FileText,
    roles: [UserRole.EXPERT_HELPDESK],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
];

// Get navigation for specific role (original - returns full navigation)
export const getNavigationForRole = (role: UserRole): NavItem[] => {
  switch (role) {
    case UserRole.ADMIN:
      return adminNavigation;
    case UserRole.SERVICE_PERSON:
      return servicePersonNavigation;
    case UserRole.ZONE_MANAGER:
      return zoneManagerNavigation;
    case UserRole.ZONE_USER:
      return zoneUserNavigation;
    case UserRole.EXPERT_HELPDESK:
      return expertHelpdeskNavigation;
    default:
      return [];
  }
};

// Get navigation for specific role AND sub-module (filtered navigation)
export const getNavigationForRoleAndSubModule = (
  role: UserRole,
  subModule: SubModule
): NavItem[] => {
  // If no sub-module selected, return full navigation
  if (!subModule) {
    return getNavigationForRole(role);
  }

  switch (role) {
    case UserRole.ADMIN:
      return subModule === 'tickets' ? adminTicketsNavigation : adminOffersNavigation;
    case UserRole.SERVICE_PERSON:
      // Service person only deals with tickets
      return servicePersonNavigation;
    case UserRole.ZONE_MANAGER:
      return subModule === 'tickets' ? zoneManagerTicketsNavigation : zoneManagerOffersNavigation;
    case UserRole.ZONE_USER:
      return subModule === 'tickets' ? zoneUserTicketsNavigation : zoneUserOffersNavigation;
    case UserRole.EXPERT_HELPDESK:
      return subModule === 'tickets' ? expertHelpdeskTicketsNavigation : expertHelpdeskOffersNavigation;
    default:
      return [];
  }
};
