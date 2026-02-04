'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Menu, LogOut, ChevronDown, Zap, Shield, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types/user.types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

// Kardex brand colors - official palette
const KARDEX_BLUE = "#6F8A9D"; // Primary blue
const KARDEX_BLUE_LIGHT = "#96AEC2"; // Light blue
const KARDEX_BLUE_DARK = "#546A7A"; // Dark blue

interface HeaderProps {
  onMenuClick: () => void;
  className?: string;
  isMobile?: boolean;
  sidebarOpen?: boolean;
  showSidebar?: boolean;
}

export function Header({ onMenuClick, className, isMobile = false, sidebarOpen = false, showSidebar = true }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  


  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
    }
  };

  const getEmailInitial = () => {
    if (!user?.email) return 'U';
    return user.email[0].toUpperCase();
  };
  
  const getUserDisplayName = () => {
    if (!user) return 'User';
    
    const name = user.name?.trim();
    if (name && name !== '' && name !== 'null' && name !== 'undefined' && name !== 'User') {
      return name;
    }
    if (user.email) {
      const emailUsername = user.email.split('@')[0];
      return emailUsername;
    }
    return 'User';
  };

  const getRoleDisplayName = (role?: UserRole) => {
    if (!role) return 'User';
    return role
      .toLowerCase()
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-0 shadow-lg shadow-[#6F8A9D]/30';
      case UserRole.ZONE_MANAGER:
        return 'bg-gradient-to-r from-[#6F8A9D] to-[#82A094] text-white border-0 shadow-lg shadow-[#6F8A9D]/30';
      case UserRole.ZONE_USER:
        return 'bg-gradient-to-r from-[#82A094] to-[#A2B9AF] text-white border-0 shadow-lg shadow-[#82A094]/30';
      case UserRole.SERVICE_PERSON:
        return 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border-0 shadow-lg shadow-[#82A094]/30';
      case UserRole.EXPERT_HELPDESK:
        return 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-0 shadow-lg shadow-[#CE9F6B]/30';
      default:
        return 'bg-[#AEBFC3]/20 text-[#5D6E73]';
    }
  };
  
  const getAvatarGradient = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D]';
      case UserRole.ZONE_MANAGER:
        return 'from-[#6F8A9D] via-[#82A094] to-[#6F8A9D]';
      case UserRole.ZONE_USER:
        return 'from-[#82A094] via-[#A2B9AF] to-[#82A094]';
      case UserRole.SERVICE_PERSON:
        return 'from-[#82A094] via-[#4F6A64] to-[#82A094]';
      case UserRole.EXPERT_HELPDESK:
        return 'from-[#CE9F6B] via-[#976E44] to-[#CE9F6B]';
      default:
        return 'from-[#6F8A9D] via-[#546A7A] to-[#6F8A9D]';
    }
  };

  // Role-based URL helpers
  const getNewTicketUrl = () => {
    switch (user?.role) {
      case UserRole.ADMIN:
        return '/admin/tickets/create';
      case UserRole.ZONE_MANAGER:
      case UserRole.ZONE_USER:
        return '/zone/tickets/create';
      case UserRole.EXPERT_HELPDESK:
        return '/expert/tickets/create';
      case UserRole.EXTERNAL_USER:
        return '/external/tickets/create';
      default:
        return '/admin/tickets/create';
    }
  };

  const getNewOfferUrl = () => {
    switch (user?.role) {
      case UserRole.ADMIN:
        return '/admin/offers/new';
      case UserRole.ZONE_MANAGER:
      case UserRole.ZONE_USER:
        return '/zone/offers/new';
      case UserRole.EXPERT_HELPDESK:
        return '/expert/offers/new';
      default:
        return '/admin/offers/new';
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex-shrink-0',
        'bg-white/95 backdrop-blur-2xl',
        'border-b border-[#6F8A9D]/15',
        'shadow-[0_4px_30px_-4px_rgba(111,138,157,0.12)]',
        className
      )}
      suppressHydrationWarning
    >
      {/* Top gradient accent - Kardex brand colors */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B] blur-sm opacity-50" />
      </div>
      
      <div className={cn(
        "relative flex items-center justify-between",
        isMobile ? "h-18 px-5" : "h-[76px] px-8"
      )}>
        {/* Left section */}
        <div 
          className="flex items-center gap-4 transition-all duration-200 ease-out"
        >
          {showSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "lg:hidden rounded-xl",
                "text-[#6F8A9D] hover:text-[#546A7A]",
                "hover:bg-gradient-to-br hover:from-[#96AEC2]/10 hover:to-[#96AEC2]/5",
                "hover:shadow-lg hover:shadow-[#96AEC2]/10",
                "transition-all duration-300",
                "border border-transparent hover:border-[#96AEC2]/20",
                isMobile ? "h-11 w-11" : "h-10 w-10"
              )}
              onClick={onMenuClick}
            >
              <Menu className={cn(
                "transition-transform duration-200",
                isMobile ? "h-6 w-6" : "h-5 w-5"
              )} />
              <span className="sr-only">Toggle menu</span>
            </Button>
          )}
          
          {/* Title section with enhanced styling */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              {/* Decorative element */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-[#96AEC2] via-[#82A094] to-[#CE9F6B] rounded-full opacity-80" />
              
              <div className="pl-2">
                <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-bold tracking-tight leading-tight">
                  <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                    Kardex
                  </span>
                  <span className="text-[#96AEC2]/30 mx-2 font-light">|</span>
                  <span className="bg-gradient-to-r from-[#6F8A9D] via-[#82A094] to-[#CE9F6B] bg-clip-text text-transparent">
                    Field Service
                  </span>
                </h1>
                <p className="text-[11px] font-medium text-[#6F8A9D]/60 tracking-wide uppercase mt-0.5 hidden sm:block">
                  Management System
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right section */}
        <div 
          className="flex items-center gap-4 transition-all duration-200 ease-out"
        >
          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "rounded-2xl transition-all duration-300",
                  "hover:bg-gradient-to-r hover:from-[#96AEC2]/[0.08] hover:via-white hover:to-[#82A094]/[0.05]",
                  "hover:shadow-xl hover:shadow-[#96AEC2]/10",
                  "border border-transparent hover:border-[#96AEC2]/15",
                  "group",
                  isMobile ? "h-12 px-2" : "h-14 px-4"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {/* Avatar ambient glow */}
                    <div className={cn(
                      "absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-60 transition-all duration-500 blur-lg",
                      "bg-gradient-to-br",
                      getAvatarGradient(user?.role)
                    )} />
                    
                    {/* Avatar ring animation on hover */}
                    <div className={cn(
                      "absolute -inset-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300",
                      "ring-2 ring-[#96AEC2]/20"
                    )} />
                    
                    <Avatar className={cn(
                      "relative ring-2 ring-offset-2 ring-offset-white shadow-lg transition-all duration-300",
                      "ring-[#96AEC2]/25 group-hover:ring-[#6F8A9D]/40",
                      "group-hover:scale-110",
                      isMobile ? "h-9 w-9" : "h-11 w-11"
                    )}>
                      <AvatarFallback className={cn(
                        "bg-gradient-to-br text-white font-bold",
                        isMobile ? "text-sm" : "text-base",
                        getAvatarGradient(user?.role)
                      )}>
                        {getEmailInitial()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Online status indicator */}
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-white shadow-md transition-all duration-300",
                      isOnline 
                        ? "bg-gradient-to-br from-[#82A094] to-[#4F6A64]" 
                        : "bg-[#979796]"
                    )}>
                      {isOnline && (
                        <div className="absolute inset-0 rounded-full bg-[#82A094] animate-ping opacity-40" style={{ animationDuration: '2s' }} />
                      )}
                    </div>
                  </div>
                  
                  <div className={cn(
                    "text-left",
                    isMobile ? "hidden" : "hidden sm:block"
                  )}>
                    <p className="text-sm font-bold text-[#546A7A] truncate max-w-[130px] group-hover:text-[#6F8A9D] transition-colors">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-[11px] font-semibold text-[#6F8A9D]/60 truncate max-w-[130px]">
                      {getRoleDisplayName(user?.role)}
                    </p>
                  </div>
                  
                  <div className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-lg bg-[#96AEC2]/10 group-hover:bg-[#96AEC2]/15 transition-all",
                    isMobile ? "hidden" : "hidden sm:flex"
                  )}>
                    <ChevronDown className="h-3.5 w-3.5 text-[#6F8A9D]/60 transition-all duration-300 group-hover:text-[#6F8A9D] group-hover:translate-y-0.5" />
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent
              className="w-80 bg-white/[0.97] backdrop-blur-2xl border border-[#96AEC2]/15 shadow-2xl shadow-[#6F8A9D]/15 rounded-2xl p-0 overflow-hidden"
              align="end"
              forceMount
            >
              <ScrollArea className="max-h-[calc(100vh-120px)]">
                {/* User header with premium styling */}
                <div className="relative p-6 border-b border-[#96AEC2]/10 overflow-hidden">
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#96AEC2]/10 via-white to-[#82A094]/10" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#82A094]/15 via-transparent to-transparent blur-2xl" />
                  
                  <div className="relative flex items-center gap-4">
                    <div className="relative">
                      <div className={cn(
                        "absolute -inset-2 rounded-full blur-xl opacity-40",
                        "bg-gradient-to-br",
                        getAvatarGradient(user?.role)
                      )} />
                      <Avatar className="relative h-16 w-16 ring-3 ring-offset-2 ring-offset-white ring-[#96AEC2]/20 shadow-xl">
                        <AvatarFallback className={cn(
                          "bg-gradient-to-br text-white font-bold text-2xl",
                          getAvatarGradient(user?.role)
                        )}>
                          {getEmailInitial()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-[#546A7A] truncate">
                        {getUserDisplayName()}
                      </p>
                      {user?.email && (
                        <p className="text-xs text-[#6F8A9D]/60 truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                      {user?.role && (
                        <Badge className={cn(
                          "mt-2.5 text-[10px] px-3 py-1 font-bold",
                          getRoleBadgeStyle(user.role)
                        )}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Online status card */}
                  <div className="relative mt-5 flex items-center gap-3 px-4 py-3 bg-white/80 rounded-xl border border-[#96AEC2]/10 shadow-sm">
                    <div className="relative">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        isOnline ? "bg-gradient-to-br from-[#82A094] to-[#4F6A64]" : "bg-[#979796]"
                      )} />
                      {isOnline && (
                        <div className="absolute inset-0 w-3 h-3 bg-[#82A094] rounded-full animate-ping opacity-40" style={{ animationDuration: '2s' }} />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#546A7A]">
                      {isOnline ? 'Online & Active' : 'Offline'}
                    </span>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#96AEC2]/10 rounded-lg">
                      <Activity className="w-3 h-3 text-[#6F8A9D]/60" />
                      <span className="text-[10px] font-medium text-[#6F8A9D]/60">Active</span>
                    </div>
                  </div>
                </div>
                
                {/* Admin options */}
                {user?.role === 'ADMIN' && (
                  <>
                    <div className="p-2">
                      <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-[#6F8A9D]/50 uppercase tracking-widest">
                        Administration
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <a href="/admin/manage-admins" className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#546A7A] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30 transition-all cursor-pointer group">
                          <div className="p-2.5 bg-gradient-to-br from-[#96AEC2]/15 to-[#96AEC2]/5 rounded-xl group-hover:from-white/20 group-hover:to-white/10 group-hover:scale-110 group-hover:shadow-lg transition-all">
                            <Shield className="h-4 w-4 text-[#6F8A9D] group-hover:text-white" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">Manage Admins</span>
                            <span className="text-[10px] text-[#6F8A9D]/50 group-hover:text-white/70">System administrators</span>
                          </div>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/admin/manage-external" className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#546A7A] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30 transition-all cursor-pointer group">
                          <div className="p-2.5 bg-gradient-to-br from-[#A2B9AF]/15 to-[#A2B9AF]/5 rounded-xl group-hover:from-white/20 group-hover:to-white/10 group-hover:scale-110 group-hover:shadow-lg transition-all">
                            <Users className="h-4 w-4 text-[#82A094] group-hover:text-white" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">External Users</span>
                            <span className="text-[10px] text-[#6F8A9D]/50 group-hover:text-white/70">Customer accounts</span>
                          </div>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/admin/manage-expert-helpdesk" className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#546A7A] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30 transition-all cursor-pointer group">
                          <div className="p-2.5 bg-gradient-to-br from-amber-100 to-[#EEC1BF]/10 rounded-xl group-hover:from-white/20 group-hover:to-white/10 group-hover:scale-110 group-hover:shadow-lg transition-all">
                            <Zap className="h-4 w-4 text-[#976E44] group-hover:text-white" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">Expert Helpdesk</span>
                            <span className="text-[10px] text-[#6F8A9D]/50 group-hover:text-white/70">Support specialists</span>
                          </div>
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/admin/pin-management" className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#546A7A] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30 transition-all cursor-pointer group">
                          <div className="p-2.5 bg-gradient-to-br from-[#CE9F6B]/15 to-[#CE9F6B]/5 rounded-xl group-hover:from-white/20 group-hover:to-white/10 group-hover:scale-110 group-hover:shadow-lg transition-all">
                            <svg className="h-4 w-4 text-[#CE9F6B] group-hover:text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 7a2 2 0 1 0-4 0v2a2 2 0 1 0 4 0V7z"/><path d="M12 15v2"/><circle cx="12" cy="12" r="10"/></svg>
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">Pin Management</span>
                            <span className="text-[10px] text-[#6F8A9D]/50 group-hover:text-white/70">Access control</span>
                          </div>
                        </a>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-gradient-to-r from-transparent via-[#96AEC2]/10 to-transparent" />
                  </>
                )}

                {/* Expert Helpdesk options */}
                {user?.role === 'EXPERT_HELPDESK' && (
                  <>
                    <div className="p-2">
                      <DropdownMenuItem asChild>
                        <a href="/expert/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#546A7A] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30 transition-all cursor-pointer group">
                          <div className="p-2.5 bg-gradient-to-br from-[#CE9F6B]/15 to-[#EEC1BF]/10 rounded-xl group-hover:from-white/20 group-hover:to-white/10 group-hover:scale-110 group-hover:shadow-lg transition-all">
                            <Zap className="h-4 w-4 text-[#976E44] group-hover:text-white" />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">Expert Dashboard</span>
                            <span className="text-[10px] text-[#6F8A9D]/50 group-hover:text-white/70">Your workspace</span>
                          </div>
                        </a>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-gradient-to-r from-transparent via-[#96AEC2]/10 to-transparent" />
                  </>
                )}
                
                {/* Logout with enhanced styling */}
                <div className="p-2">
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#9E3B47] hover:text-[#75242D] hover:bg-gradient-to-r hover:from-[#E17F70]/10 hover:to-red-100/50 transition-all cursor-pointer group"
                  >
                    <div className="p-2.5 bg-gradient-to-br from-red-100 to-[#E17F70]/10 rounded-xl group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-red-200/50 transition-all">
                      <LogOut className="h-4 w-4 text-[#9E3B47]" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm block">Sign Out</span>
                      <span className="text-[10px] text-[#E17F70]">End your session</span>
                    </div>
                  </DropdownMenuItem>
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
