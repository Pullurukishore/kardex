"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { preloadRoute } from "@/lib/browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  BarChart2,
  MapPin,
  ChevronLeft,
  LogOut,
  ChevronRight,
  X,
  Package,
  Target,
  Building2,
  Activity,
  Sparkles,
  Rocket,
  Layers,
  Grid3X3,
  Home,
  Zap,
  TrendingUp,
} from "lucide-react";

type NavItem = {
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

const navigation: NavItem[] = [
  // Admin
  { 
    title: "Dashboard", 
    href: "/admin/dashboard", 
    icon: Home, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10",
  },
  { 
    title: "Offers", 
    href: "/admin/offers", 
    icon: Rocket, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  { 
    title: "Customers", 
    href: "/admin/customers", 
    icon: Building2, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  { 
    title: "Spare Parts", 
    href: "/admin/spare-parts", 
    icon: Package, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  { 
    title: "Targets", 
    href: "/admin/targets", 
    icon: Target, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
    { 
    title: "Reports", 
    href: "/admin/reports", 
    icon: BarChart2, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  { 
    title: "Zones", 
    href: "/admin/zones", 
    icon: MapPin, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  { 
    title: "Users", 
    href: "/admin/users", 
    icon: Users, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#546A7A]/10"
  },
  { 
    title: "Activity", 
    href: "/admin/activity", 
    icon: Activity, 
    roles: [UserRole.ADMIN],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },

  // Zone Manager
  { 
    title: "Dashboard", 
    href: "/zone-manager/dashboard", 
    icon: Home, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  { 
    title: "Offers", 
    href: "/zone-manager/offers", 
    icon: Rocket, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  { 
    title: "Customers", 
    href: "/zone-manager/customers", 
    icon: Building2, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  { 
    title: "Spare Parts", 
    href: "/zone-manager/spare-parts", 
    icon: Package, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
  { 
    title: "Reports", 
    href: "/zone-manager/reports", 
    icon: BarChart2, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  { 
    title: "Activity", 
    href: "/zone-manager/activity", 
    icon: Activity, 
    roles: [UserRole.ZONE_MANAGER],
    iconColor: "text-[#9E3B47]",
    iconBgColor: "bg-[#EEC1BF]/10"
  },

  // Zone User
  { 
    title: "Dashboard", 
    href: "/zone-user/dashboard", 
    icon: Home, 
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#96AEC2]/10"
  },
  { 
    title: "Offers", 
    href: "/zone-user/offers", 
    icon: Rocket, 
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#546A7A]",
    iconBgColor: "bg-[#6F8A9D]/10"
  },
  { 
    title: "Customers", 
    href: "/zone-user/customers", 
    icon: Building2, 
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#4F6A64]",
    iconBgColor: "bg-[#82A094]/10"
  },
  { 
    title: "Spare Parts", 
    href: "/zone-user/spare-parts", 
    icon: Package, 
    roles: [UserRole.ZONE_USER],
    iconColor: "text-[#976E44]",
    iconBgColor: "bg-[#CE9F6B]/10"
  },
];

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  userRole?: UserRole;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  onClose?: () => void;
}

export function Sidebar({
  userRole,
  onClose,
  className,
  collapsed = false,
  setCollapsed,
}: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  // Fast role fallback from cookies/localStorage to avoid flicker on reload
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  };
  const cookieRole = getCookie('userRole') as UserRole | null;
  const lsRole = typeof window !== 'undefined' 
    ? ((localStorage.getItem('cookie_userRole') || localStorage.getItem('dev_userRole')) as UserRole | null)
    : null;
  const effectiveRole = (userRole || user?.role || cookieRole || lsRole) as UserRole | undefined;

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  // Persist collapsed state across sessions
  React.useEffect(() => {
    if (typeof window === 'undefined' || !setCollapsed) return;
    try {
      const saved = localStorage.getItem('of_sidebar_collapsed');
      if (saved !== null) {
        setCollapsed(saved === '1');
      }
    } catch {}
  }, [setCollapsed]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('of_sidebar_collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  // Auto-scroll active item into view on mount/route change
  const activeItemRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }, [hydrated, pathname, collapsed]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed?.(!collapsed);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCollapsed, collapsed]);


  const filteredNavItems = React.useMemo(() => {
    if (!effectiveRole) return [];
    return navigation.filter((item) => item.roles.includes(effectiveRole));
  }, [effectiveRole]);

  const handleItemClick = React.useCallback((e: React.MouseEvent, item: NavItem) => {
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    
    e.preventDefault();
    router.push(item.href);
    
    if (isMobile) {
      onClose?.();
    }
  }, [router, onClose, isMobile]);

  const handleItemHover = React.useCallback((item: NavItem) => {
    if (!isMobile && !item.disabled) {
      setHoveredItem(item.href);
      preloadRoute(item.href);
    }
  }, [isMobile]);

  const handleItemLeave = React.useCallback(() => {
    if (!isMobile) {
      setHoveredItem(null);
    }
  }, [isMobile]);

  const renderNavItem = React.useCallback((item: NavItem, index: number) => {
    const isActive = pathname?.startsWith(item.href) ?? false;
    const Icon = item.icon;
    const isHovered = hoveredItem === item.href;

    if (item.disabled) {
      return null;
    }

    return (
      <div key={item.href}>
        <button
          onClick={(e) => handleItemClick(e, item)}
          onMouseEnter={() => handleItemHover(item)}
          onMouseLeave={handleItemLeave}
          aria-current={isActive ? 'page' : undefined}
          aria-label={item.title}
          ref={isActive ? activeItemRef : undefined}
          className={cn(
            "group relative flex items-center w-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#96AEC2]/60 hover:translate-x-1",
            isMobile ? "px-3 py-3 mx-2 my-1 rounded-2xl" : collapsed ? "px-2 py-3 mx-2 my-1 rounded-xl justify-center" : "px-3 py-2.5 mx-2 my-0.5 rounded-xl",
            isActive
              ? "bg-gradient-to-r from-[#96AEC2]/10 via-[#6F8A9D]/10 to-[#6F8A9D]/10 border border-[#96AEC2]/50 ring-1 ring-[#96AEC2]/50/60"
              : "text-[#5D6E73] hover:bg-[#AEBFC3]/10",
          )}
        >
          {isHovered && !isActive && (
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#6F8A9D]/8 via-[#6F8A9D]/8 to-[#6F8A9D]/8" />
          )}
          {isActive && (
            <div className="absolute left-0 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-[#6F8A9D]" />
          )}
          {/* Icon Container */}
          <div className={cn(
            "relative flex items-center justify-center rounded-lg transition-all duration-200",
            isMobile ? "h-10 w-10" : collapsed ? "h-9 w-9" : "h-9 w-9",
            isActive 
              ? "bg-gradient-to-br from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] shadow-md" 
              : cn(item.iconBgColor, "group-hover:scale-110")
          )}>
            <Icon
              className={cn(
                "transition-all duration-200",
                isMobile ? "h-5 w-5" : collapsed ? "h-5 w-5" : "h-5 w-5",
                isActive
                  ? "text-white"
                  : item.iconColor
              )}
            />
            {collapsed && !isMobile && isActive && (
              <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-[#6F8A9D]" />
            )}
          </div>
          
          {/* Label */}
          {(!collapsed || isMobile) && (
            <div className="flex flex-1 items-center justify-between ml-3">
              <span className={cn(
                "font-semibold truncate",
                isMobile ? "text-sm" : "text-sm",
                isActive ? "text-[#546A7A]" : "text-[#5D6E73]"
              )}>
                {item.title}
              </span>
              {item.badge && (
                <span
                  className={cn(
                    "ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse",
                    isActive 
                      ? "bg-[#96AEC2]/20 text-[#546A7A]"
                      : "bg-[#AEBFC3]/20 text-[#5D6E73]"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
          )}
          
          {/* Tooltip for collapsed state */}
          {collapsed && !isMobile && isHovered && (
            <div className="absolute left-full ml-3 z-50 pointer-events-none opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              <div className="bg-[#546A7A] text-white px-3 py-2 rounded-lg text-sm font-medium shadow-xl whitespace-nowrap">
                {item.title}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
              </div>
            </div>
          )}
        </button>
      </div>
    );
  }, [pathname, collapsed, hoveredItem, isMobile, handleItemClick, handleItemHover, handleItemLeave]);

  const navItems = React.useMemo(() => {
    if (!hydrated) return [];
    return filteredNavItems.map((item, index) => renderNavItem(item, index));
  }, [filteredNavItems, renderNavItem, hydrated]);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-[60] flex h-screen flex-col bg-gradient-to-br from-white via-slate-50/80 to-[#96AEC2]/10/30 border-r border-[#92A2A5]/80 shadow-xl transition-all duration-300 ease-out",
        // Mobile-first responsive design
        isMobile 
          ? "w-80" // Wider on mobile for better touch targets
          : collapsed ? "w-20" : "w-64",
        className
      )}
      role="navigation"
      aria-label="Primary"
    >
      {/* Clean accent elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#6F8A9D] opacity-60"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#6F8A9D]/[0.02] via-transparent to-transparent pointer-events-none"></div>
      {/* Modern Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-[#92A2A5]/50 bg-white/90 relative z-10 shadow-sm",
        // Mobile-optimized header height and padding
        isMobile ? "h-16 px-6" : "h-20 px-4"
      )}>
        {(!collapsed || isMobile) && (
          <div className="flex items-center justify-center w-full gap-3">
            <Image 
              src="/favicon-circle.svg" 
              alt="Kardex Logo" 
              width={isMobile ? 36 : 40} 
              height={isMobile ? 36 : 40} 
              className="rounded-lg transition-all duration-200 hover:scale-105"
              priority
            />
            <div className="overflow-hidden w-[94px] sm:w-[112px] flex items-center shrink-0">
              <Image 
                src="/kardex.png" 
                alt="Kardex" 
                width={isMobile ? 200 : 240} 
                height={isMobile ? 62 : 75} 
                className="transition-all duration-200 hover:scale-105 max-w-none w-[200px] sm:w-[240px] h-auto"
                priority
              />
            </div>
          </div>
        )}
        
        {collapsed && !isMobile && (
          <div className="flex items-center justify-center w-full hover:scale-110 hover:rotate-3 transition-transform">
            <Image 
              src="/favicon-circle.svg" 
              alt="Kardex Logo" 
              width={32} 
              height={32} 
              className="rounded-lg transition-all duration-200 hover:scale-105"
              priority
            />
          </div>
        )}

        <button
          className={cn(
            "p-2 rounded-xl hover:bg-white transition-colors hover:scale-105 active:scale-95",
            collapsed && !isMobile && "hidden"
          )}
          onClick={() => isMobile ? onClose?.() : setCollapsed?.(!collapsed)}
        >
          {isMobile ? (
            <X className="h-5 w-5 text-[#5D6E73]" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-[#5D6E73]" />
          )}
        </button>
        
        {!isMobile && !collapsed && (
          <button
            className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white border-2 border-[#92A2A5] rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
            onClick={() => setCollapsed?.(!collapsed)}
          >
            <ChevronLeft className="h-3 w-3 text-[#5D6E73]" />
          </button>
        )}
        
        {!isMobile && collapsed && (
          <button
            className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 bg-white border-2 border-[#92A2A5] rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
            onClick={() => setCollapsed?.(!collapsed)}
          >
            <ChevronRight className="h-3 w-3 text-[#5D6E73]" />
          </button>
        )}
      </div>

      {/* Navigation Section */}
      <ScrollArea className={cn(
        "flex-1",
        isMobile ? "py-4" : "py-6"
      )}>
        <div suppressHydrationWarning>
          {(!collapsed || isMobile) && (
            <nav 
              suppressHydrationWarning
              className={cn(
                "space-y-1",
                isMobile ? "px-6" : "px-4"
              )}
            >
              {navItems}
            </nav>
          )}
        </div>
      </ScrollArea>

      {/* Logout section */}
      <div className={cn(
        "border-t border-[#92A2A5]/60 bg-white/90 relative z-10 shadow-sm",
        isMobile ? "px-6 py-4" : collapsed ? "px-2 py-3" : "px-4 py-3"
      )}>
        <button
          onClick={() => logout?.()}
          aria-label="Logout"
          className={cn(
            "group w-full flex items-center rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E17F70]/50 focus:ring-offset-2 focus:ring-offset-transparent",
            "hover:bg-[#E17F70]/10 hover:shadow-md text-[#5D6E73] hover:text-[#75242D]",
            isMobile ? "px-3 py-3 text-base" : collapsed ? "px-2.5 py-2.5 text-sm justify-center" : "px-2.5 py-2.5 text-sm"
          )}
        >
          {/* Icon with colored background */}
          <div className={cn(
            "flex-shrink-0 rounded-lg transition-all duration-200 flex items-center justify-center bg-[#E17F70]/10 group-hover:bg-[#E17F70]/20 group-hover:shadow-md group-hover:scale-105",
            isMobile ? "h-10 w-10" : "h-9 w-9"
          )}>
            <LogOut className={cn(
              "transition-all duration-200 text-[#9E3B47] group-hover:scale-110",
              isMobile ? "h-5 w-5" : "h-4 w-4"
            )} />
          </div>
          {(!collapsed || isMobile) && (
            <span className={cn(
              "font-semibold",
              isMobile ? "ml-3" : "ml-2.5"
            )}>Logout</span>
          )}
          {/* Tooltip when collapsed */}
          {collapsed && !isMobile && (
            <span
              className={cn(
                "pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[#546A7A]/95 px-2 py-1 text-xs font-medium text-white shadow-lg",
                "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150"
              )}
              role="tooltip"
            >
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
