"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/user.types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavItemSkeleton } from "@/components/ui/NavigationLoading";
import { preloadRoute } from "@/lib/browser";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronLeft,
  ChevronDown,
  LogOut,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import { getNavigationForRoleAndSubModule, type NavItem, type SubModule } from "./navigationConfig";

// Constants
const MOBILE_BREAKPOINT = 1024;

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  userRole?: UserRole;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  onClose?: () => void;
}

// Memoized Nav Item Component - using CSS transitions instead of framer-motion
const MemoizedNavItem = React.memo(({ 
  item, 
  pathname, 
  collapsed, 
  isMobile, 
  level = 0,
  onItemClick,
  onSectionToggle,
  expandedSections 
}: {
  item: NavItem;
  pathname: string | null;
  collapsed: boolean;
  isMobile: boolean;
  level?: number;
  onItemClick: (e: React.MouseEvent, item: NavItem) => void;
  onSectionToggle: (href: string) => void;
  expandedSections: Record<string, boolean>;
}) => {
  const isActive = pathname?.startsWith(item.href) ?? false;
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedSections[item.href] ?? false;
  const Icon = item.icon;

  if (item.disabled) {
    return null;
  }

  return (
    <div className={cn("relative")}>
      <div className={cn("relative", {
        "mb-1": hasChildren && isExpanded
      })}>
        <button
          onClick={(e) => hasChildren ? onSectionToggle(item.href) : onItemClick(e, item)}
          onMouseEnter={() => !isMobile && preloadRoute(item.href)}
          aria-current={isActive && !hasChildren ? 'page' : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-label={item.title}
          className={cn(
            "group relative flex items-center rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/50 focus:ring-offset-2 focus:ring-offset-transparent",
            "transition-all duration-200 ease-out hover:translate-x-[3px] active:scale-[0.98]",
            isMobile ? "px-3 py-3 text-base font-medium min-h-[56px]" : "px-2.5 py-2.5 text-sm font-medium",
            isActive && !hasChildren
              ? "bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#96AEC2] text-white shadow-lg shadow-[#6F8A9D]/30"
              : "text-[#4F5B5F] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30",
            level > 0 && !isMobile ? `pl-${level * 2 + 2.5}` : "",
            isMobile ? "touch-manipulation" : ""
          )}
          title={collapsed && !isMobile ? item.title : undefined}
        >
          {/* Active indicator line */}
          {!hasChildren && isActive && (
            <div
              className="absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-white/80 shadow-lg shadow-white/50 transition-all duration-300"
            />
          )}
          
          {/* Icon container */}
          <div className={cn(
            "flex-shrink-0 rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center",
            isMobile ? "h-10 w-10" : "h-9 w-9",
            isActive && !hasChildren
              ? "bg-white/20 shadow-inner backdrop-blur-sm"
              : cn(item.iconBgColor, "group-hover:bg-white/20 group-hover:shadow-lg group-hover:scale-110")
          )}>
            <Icon
              className={cn(
                "transition-all duration-300",
                isMobile ? "h-5 w-5" : "h-4 w-4",
                isActive && !hasChildren
                  ? "text-white drop-shadow-sm"
                  : cn(item.iconColor, "group-hover:text-white group-hover:scale-110")
              )}
            />
          </div>
          
          {(!collapsed || isMobile) && (
            <span className={cn(
              "flex flex-1 items-center justify-between relative z-10",
              isMobile ? "ml-3" : "ml-2.5"
            )}>
              <span className={cn(
                "truncate font-semibold text-left tracking-tight",
                isMobile ? "text-base" : "text-sm"
              )}>
                {item.title}
              </span>
              
              {hasChildren && (
                <span
                  className={cn(
                    "ml-2 transition-transform duration-200",
                    isExpanded ? "rotate-180" : "rotate-0"
                  )}
                >
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-white/70" : "text-[#757777]"
                  )} />
                </span>
              )}
              
              {item.badge && (
                <span className={cn(
                  "ml-2 rounded-full bg-gradient-to-r from-[#6F8A9D] to-[#96AEC2] font-bold text-white shadow-lg shadow-[#6F8A9D]/30",
                  isMobile ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
                )}>
                  {item.badge}
                </span>
              )}
            </span>
          )}
          
          {/* Tooltip when collapsed */}
          {collapsed && !isMobile && (
            <div className={cn(
              "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-[#546A7A] px-3 py-2.5 text-xs font-semibold text-white shadow-2xl z-[100]",
              "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
            )}>
              {item.title}
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#546A7A] rotate-45" />
            </div>
          )}
        </button>
      </div>
      
      {/* Children items - using CSS transitions instead of AnimatePresence */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          hasChildren && isExpanded ? "opacity-100 max-h-[1000px]" : "opacity-0 max-h-0",
          !isMobile && "ml-4 pl-3 border-l-2 border-[#6F8A9D]/20"
        )}
      >
        {hasChildren && (
          <div className="pt-1 space-y-0.5">
            {item.children?.map((child) => (
              <MemoizedNavItem
                key={child.href}
                item={child}
                pathname={pathname}
                collapsed={collapsed}
                isMobile={isMobile}
                level={level + 1}
                onItemClick={onItemClick}
                onSectionToggle={onSectionToggle}
                expandedSections={expandedSections}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MemoizedNavItem.displayName = 'MemoizedNavItem';

export function Sidebar({
  userRole,
  onClose,
  className,
  collapsed = false,
  setCollapsed,
}: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMobile, setIsMobile] = React.useState(false);
  const [subModule, setSubModule] = React.useState<SubModule>(null);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const checkMobile = () => {
      // Debounce resize event for better performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }, 100);
    };
    
    // Initial check (immediate)
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      window.addEventListener('resize', checkMobile);
    }
    return () => {
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkMobile);
      }
    };
  }, []);

  // No initial load delay needed



  // Read sub-module selection from localStorage (with storage event listener)
  // Use ref to avoid re-reading on every render
  const lastStoredSubModule = React.useRef<string | null>(null);
  
  React.useEffect(() => {
    const updateSubModule = () => {
      const stored = localStorage.getItem('selectedSubModule');
      // Only update state if value actually changed
      if (stored !== lastStoredSubModule.current) {
        lastStoredSubModule.current = stored;
        if (stored === 'tickets' || stored === 'offers') {
          setSubModule(stored);
        } else {
          setSubModule(null);
        }
      }
    };
    
    // Initial read
    updateSubModule();
    
    // Listen for storage changes (from other tabs or FSM select page)
    window.addEventListener('storage', updateSubModule);
    
    return () => window.removeEventListener('storage', updateSubModule);
  }, []);

  // Auto-detect module from URL path and sync localStorage
  React.useEffect(() => {
    if (!pathname) return;
    
    // Define which paths belong to which module
    const commonPaths = ['/customers', '/service-zones', '/zone-users', '/reports'];
    const ticketPaths = ['/tickets', '/service-person', '/service-persons', '/activity-scheduling', '/attendance', '/attendence', '/dashboard', ...commonPaths];
    const offerPaths = ['/offers', '/targets', '/spare-parts', '/forecast', ...commonPaths];
    
    // Check if current path matches a ticket module path
    const isTicketPath = ticketPaths.some(path => pathname.includes(path));
    // Check if current path matches an offer module path  
    const isOfferPath = offerPaths.some(path => pathname.includes(path));
    
    // Only auto-switch if we can clearly determine the module from the path
    // and there's a mismatch with the stored value
    const stored = localStorage.getItem('selectedSubModule');
    
    if (isOfferPath && !isTicketPath) {
      // Clear offer path match - switch to offers
      if (stored !== 'offers') {
        localStorage.setItem('selectedSubModule', 'offers');
        setSubModule('offers');
      } else {
        setSubModule('offers');
      }
    } else if (isTicketPath && !isOfferPath) {
      // Clear ticket path match - switch to tickets
      if (stored !== 'tickets') {
        localStorage.setItem('selectedSubModule', 'tickets');
        setSubModule('tickets');
      } else {
        setSubModule('tickets');
      }
    } else {
      // Ambiguous or no match - use stored value
      if (stored === 'tickets' || stored === 'offers') {
        setSubModule(stored);
      }
    }
  }, [pathname]);

  const filteredNavItems = React.useMemo(() => {
    if (!userRole) return [];
    return getNavigationForRoleAndSubModule(userRole, subModule);
  }, [userRole, subModule]);

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

  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({});

  const toggleSection = React.useCallback((href: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [href]: !prev[href]
    }));
  }, []);

  const navItems = React.useMemo(() => (
    <div className="space-y-1">
      {filteredNavItems.map((item) => (
        <MemoizedNavItem
          key={item.href}
          item={item}
          pathname={pathname}
          collapsed={collapsed}
          isMobile={isMobile}
          onItemClick={handleItemClick}
          onSectionToggle={toggleSection}
          expandedSections={expandedSections}
        />
      ))}
    </div>
  ), [filteredNavItems, pathname, collapsed, isMobile, handleItemClick, toggleSection, expandedSections]);

  return (
    <div
      className={cn(
        "flex flex-col h-full",
        "bg-gradient-to-b from-[#AEBFC3]/10 via-white/90 to-[#AEBFC3]/20",
        "backdrop-blur-xl",
        "border-r border-[#6F8A9D]/15",
        "shadow-xl shadow-[#6F8A9D]/10",
        className
      )}
      role="navigation"
      aria-label="Primary"
    >
      {/* Top gradient accent bar - Kardex brand colors */}
      <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#96AEC2] via-[#6F8A9D] to-[#CE9F6B]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#96AEC2] via-[#6F8A9D] to-[#CE9F6B] blur-sm opacity-50" />
      </div>
      
      {/* Animated background glows - Kardex brand colors */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#96AEC2]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-32 left-1/3 w-32 h-32 bg-[#82A094]/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(#6F8A9D 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} 
      />

      {/* Header */}
      <div className={cn(
        "relative flex items-center justify-between border-b border-[#96AEC2]/10",
        "bg-white/50 backdrop-blur-xl",
        isMobile ? "h-16 px-5" : "h-[76px] px-3"
      )}>
        <div suppressHydrationWarning className="flex-1 flex items-center justify-center">
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-2.5 transition-all duration-300">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <Image 
                  src="/favicon-circle.svg" 
                  alt="Kardex Logo" 
                  width={isMobile ? 36 : 40} 
                  height={isMobile ? 36 : 40} 
                  className="relative rounded-xl shadow-lg shadow-[#6F8A9D]/20"
                  priority
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-full border-2 border-white shadow-sm">
                  <div className="absolute inset-0 bg-[#82A094] rounded-full animate-ping opacity-40" style={{ animationDuration: '2s' }} />
                </div>
              </div>
              <Image 
                src="/kardex.png" 
                alt="Kardex" 
                width={isMobile ? 180 : 200} 
                height={isMobile ? 56 : 62} 
                className="transition-transform duration-200"
                style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </div>
          )}
          {collapsed && !isMobile && (
            <div className="relative group transition-all duration-300">
              <div className="absolute -inset-1 bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <Image 
                src="/favicon-circle.svg" 
                alt="Kardex Logo" 
                width={36} 
                height={36} 
                className="relative rounded-xl shadow-lg shadow-[#6F8A9D]/20"
                priority
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-full border-2 border-white shadow-sm">
                <div className="absolute inset-0 bg-[#82A094] rounded-full animate-ping opacity-40" style={{ animationDuration: '2s' }} />
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-2 rounded-xl transition-all duration-300",
            "text-[#6F8A9D]/60 hover:text-[#6F8A9D]",
            "hover:bg-[#96AEC2]/10 hover:shadow-md hover:shadow-[#96AEC2]/10",
            "active:scale-95",
            isMobile ? "h-10 w-10" : "h-8 w-8"
          )}
          onClick={() => isMobile ? onClose?.() : setCollapsed?.(!collapsed)}
        >
          {isMobile ? (
            <X className="h-5 w-5" />
          ) : collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Label */}
      {(!collapsed || isMobile) && (
        <div className={cn(
          "px-5 pt-4 pb-2",
          isMobile ? "px-6" : "px-4"
        )}>
          <p className="text-[10px] font-bold text-[#6F8A9D]/70 uppercase tracking-widest">
            Navigation
          </p>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <div suppressHydrationWarning>
          {(!collapsed || isMobile) ? (
            <nav className={cn(
              "space-y-1",
              isMobile ? "px-4" : "px-3"
            )}>
              {navItems}
            </nav>
          ) : (
            /* Collapsed icons only */
            <nav className="px-2 space-y-2">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname?.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={(e) => handleItemClick(e, item)}
                    onMouseEnter={() => preloadRoute(item.href)}
                    className={cn(
                      "group relative flex items-center justify-center w-full h-12 rounded-xl transition-all duration-200",
                      "hover:scale-110 active:scale-95",
                      isActive
                        ? "bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#96AEC2] text-white shadow-lg shadow-[#6F8A9D]/30"
                        : cn(item.iconBgColor, "hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30")
                    )}
                    title={item.title}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-all",
                      isActive ? "text-white drop-shadow-sm" : cn(item.iconColor, "group-hover:text-white")
                    )} />
                    
                    {/* Tooltip */}
                    <div className={cn(
                      "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-[#546A7A] px-3 py-2.5 text-xs font-semibold text-white shadow-2xl z-[100]",
                      "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                    )}>
                      {item.title}
                      <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#546A7A] rotate-45" />
                    </div>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </ScrollArea>

      {/* Switch Module Button */}
      {subModule && (
        <div className={cn(
          "relative border-t border-[#96AEC2]/15",
          "bg-white/90 backdrop-blur-xl",
          isMobile ? "px-4 py-2" : "px-3 py-2"
        )}>
          <button
            onClick={() => router.push('/fsm/select')}
            aria-label="Switch Module"
            className={cn(
              "group w-full flex items-center rounded-xl transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[#6F8A9D]/50 focus:ring-offset-2",
              "hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#82A094]/10 hover:shadow-md hover:shadow-[#96AEC2]/10 text-[#4F5B5F] hover:text-[#6F8A9D]",
              "hover:translate-x-1 active:scale-[0.98]",
              isMobile ? "px-3 py-3 text-base" : collapsed ? "justify-center py-2.5" : "px-2.5 py-2.5 text-sm"
            )}
          >
            <div className={cn(
              "flex-shrink-0 rounded-xl transition-all duration-300 flex items-center justify-center",
              "bg-[#96AEC2]/10 group-hover:bg-[#96AEC2]/20 group-hover:shadow-lg group-hover:scale-110",
              isMobile ? "h-10 w-10" : "h-9 w-9"
            )}>
              <RefreshCw className={cn(
                "transition-all duration-300 text-[#6F8A9D] group-hover:text-[#546A7A]",
                isMobile ? "h-5 w-5" : "h-4 w-4"
              )} />
            </div>
            {(!collapsed || isMobile) && (
              <span className={cn(
                "font-semibold tracking-tight",
                isMobile ? "ml-3" : "ml-2.5"
              )}>Switch Module</span>
            )}
            
            {/* Tooltip when collapsed */}
            {collapsed && !isMobile && (
              <div className={cn(
                "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-[#546A7A] px-3 py-2.5 text-xs font-semibold text-white shadow-2xl z-[100]",
                "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
              )}>
                Switch Module
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#546A7A] rotate-45" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* Logout */}
      <div className={cn(
        "relative border-t border-[#96AEC2]/15",
        "bg-white/90 backdrop-blur-xl",
        isMobile ? "px-4 py-4" : "px-3 py-3"
      )}>
        <button
          onClick={() => logout?.()}
          aria-label="Logout"
          className={cn(
            "group w-full flex items-center rounded-xl transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[#E17F70]/50 focus:ring-offset-2",
            "hover:bg-gradient-to-r hover:from-[#E17F70]/10 hover:to-[#EEC1BF]/10 hover:shadow-md hover:shadow-red-200/30 text-[#4F5B5F] hover:text-[#9E3B47]",
            "hover:translate-x-1 active:scale-[0.98]",
            isMobile ? "px-3 py-3 text-base" : collapsed ? "justify-center py-2.5" : "px-2.5 py-2.5 text-sm"
          )}
        >
          <div className={cn(
            "flex-shrink-0 rounded-xl transition-all duration-300 flex items-center justify-center",
            "bg-[#E17F70]/10 group-hover:bg-[#E17F70]/20 group-hover:shadow-lg group-hover:scale-110",
            isMobile ? "h-10 w-10" : "h-9 w-9"
          )}>
            <LogOut className={cn(
              "transition-all duration-300 text-[#E17F70] group-hover:text-[#9E3B47]",
              isMobile ? "h-5 w-5" : "h-4 w-4"
            )} />
          </div>
          {(!collapsed || isMobile) && (
            <span className={cn(
              "font-semibold tracking-tight",
              isMobile ? "ml-3" : "ml-2.5"
            )}>Logout</span>
          )}
          
          {/* Tooltip when collapsed */}
          {collapsed && !isMobile && (
            <div className={cn(
              "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-[#546A7A] px-3 py-2.5 text-xs font-semibold text-white shadow-2xl z-[100]",
              "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
            )}>
              Logout
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#546A7A] rotate-45" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
} 
