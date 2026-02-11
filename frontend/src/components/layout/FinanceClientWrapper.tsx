'use client';

import { ReactNode, useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, FileText, Users, CreditCard, BarChart3, 
  Download, ArrowLeft, LogOut, ChevronDown, Bell, Menu, X,
  HelpCircle, ChevronLeft, ChevronRight, Activity, UserCog, Landmark, Wallet
} from 'lucide-react';

interface FinanceLayoutProps {
  children: ReactNode;
}

type FinanceRoleType = 'FINANCE_ADMIN' | 'FINANCE_USER' | 'FINANCE_VIEWER';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  roles?: FinanceRoleType[];
}

const allNavItems: NavItem[] = [
  { href: '/finance/ar/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & KPIs' },
  { href: '/finance/ar/invoices', label: 'Invoices', icon: FileText, description: 'Manage invoices' },
  { href: '/finance/ar/invoices?type=PREPAID', label: 'Prepaid Invoices', icon: Wallet, description: 'Advance payments' },
  { href: '/finance/ar/customers', label: 'Customers', icon: Users, description: 'Customer master' },
  { href: '/finance/ar/activities', label: 'Activities', icon: Activity, description: 'All activity logs', roles: ['FINANCE_ADMIN'] },
  { href: '/finance/ar/reports', label: 'Reports', icon: BarChart3, description: 'Analytics & exports' },
  { href: '/finance/ar/import', label: 'Import', icon: Download, description: 'Excel import', roles: ['FINANCE_ADMIN', 'FINANCE_USER'] },
  { href: '/finance/ar/users', label: 'Finance Users', icon: UserCog, description: 'Manage users', roles: ['FINANCE_ADMIN'] },
];

function FinanceSidebar({ 
  isMobile, 
  mobileMenuOpen, 
  setMobileMenuOpen,
  isCollapsed,
  setIsCollapsed
}: { 
  isMobile: boolean; 
  mobileMenuOpen: boolean; 
  setMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  
  const navItems = useMemo(() => {
    const userFinanceRole = (user as any)?.financeRole as FinanceRoleType | undefined;
    
    return allNavItems.filter(item => {
      if (!item.roles) return true;
      if (!userFinanceRole) return false;
      if (userFinanceRole === 'FINANCE_ADMIN') return true;
      return item.roles.includes(userFinanceRole);
    });
  }, [user]);

  const activeNavItem = useMemo(() => {
    let bestMatch: NavItem | null = null;
    let maxSpecificity = -1;

    navItems.forEach(item => {
      const [itemPath, itemQuery] = item.href.split('?');
      const itemParams = new URLSearchParams(itemQuery || '');
      const itemParamKeys = Array.from(itemParams.keys());

      const pathMatches = pathname === itemPath || pathname.startsWith(itemPath + '/');
      if (!pathMatches) return;

      let score = 0;

      if (itemParamKeys.length > 0) {
        let paramsMatch = true;
        for (const key of itemParamKeys) {
          if (searchParams.get(key) !== itemParams.get(key)) {
            paramsMatch = false;
            break;
          }
        }
        if (!paramsMatch) return;
        score += 10;
      }

      if (pathname === itemPath) score += 2;
      else score += 1;

      if (score > maxSpecificity) {
        maxSpecificity = score;
        bestMatch = item;
      }
    });

    return bestMatch;
  }, [pathname, searchParams, navItems]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, setMobileMenuOpen]);

  const handleBack = () => {
    router.push('/finance/select');
  };

  const handleLogout = async () => {
    localStorage.removeItem('selectedModule');
    localStorage.removeItem('selectedSubModule');
    await logout();
  };

  const showSidebar = mobileMenuOpen || !isMobile;

  return (
    <>
      {/* Overlay for mobile */}
      {mobileMenuOpen && isMobile && (
        <div
          className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {showSidebar && (
        <aside
          className={cn(
            "fixed left-0 top-0 z-[60] flex h-screen flex-col",
            "bg-[#F4F7F9]",
            "border-r border-[#6F8A9D]/15",
            "shadow-sm",
            "transition-all duration-300 ease-out",
            isMobile ? "w-80" : isCollapsed ? "w-[72px]" : "w-64",
            isMobile && !mobileMenuOpen && "-translate-x-full",
            isMobile && mobileMenuOpen && "translate-x-0"
          )}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B] blur-sm opacity-50" />
          </div>
          
          {/* Background glows removed for 'Slate Tint' look */}

          <div className={cn(
            "relative flex items-center justify-between border-b border-[#96AEC2]/15",
            "bg-[#F4F7F9]",
            isMobile ? "h-16 px-5" : "h-[72px] px-3"
          )}>
            <div className="flex-1 flex items-center justify-center">
              {(!isCollapsed || isMobile) && (
                <div className="flex items-center gap-2.5 transition-opacity duration-200">
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
                    width={isMobile ? 100 : 110} 
                    height={isMobile ? 40 : 44} 
                    className="transition-transform duration-200"
                    style={{ width: 'auto', height: 'auto' }}
                    priority
                  />
                </div>
              )}
              {isCollapsed && !isMobile && (
                <div className="relative group transition-opacity duration-200">
                  <div className="absolute -inset-1 bg-gradient-to-br from-[#96AEC2]/20 to-[#82A094]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  <Image 
                    src="/favicon-circle.svg" 
                    alt="Kardex Logo" 
                    width={36} 
                    height={36} 
                    className="relative rounded-xl shadow-lg shadow-[#6F8A9D]/20"
                    priority
                  />
                </div>
              )}
            </div>

            <button
              className={cn(
                "absolute right-2 rounded-xl transition-all duration-300",
                "text-[#6F8A9D]/60 hover:text-[#6F8A9D]",
                "hover:bg-[#96AEC2]/10 hover:shadow-md",
                "active:scale-95",
                isMobile ? "h-10 w-10" : "h-8 w-8",
                "flex items-center justify-center"
              )}
              onClick={() => isMobile ? setMobileMenuOpen(false) : setIsCollapsed(!isCollapsed)}
            >
              {isMobile ? (
                <X className="h-5 w-5" />
              ) : isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {(!isCollapsed || isMobile) && (
            <div className={cn("px-5 pt-4 pb-2", isMobile ? "px-6" : "px-4")}>
              <p className="text-[10px] font-bold text-[#6F8A9D]/50 uppercase tracking-widest">
                Navigation
              </p>
            </div>
          )}

          <nav className={cn("flex-1 py-2 overflow-y-auto", isMobile ? "px-4" : "px-3")}>
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeNavItem === item;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "group relative flex items-center rounded-xl transition-all duration-300",
                      isMobile ? "px-3 py-3 text-base" : isCollapsed ? "justify-center py-2.5" : "px-2.5 py-2.5 text-sm",
                      isActive
                        ? "bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-[#96AEC2] text-white shadow-lg shadow-[#6F8A9D]/30"
                        : "text-[#5D6E73] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#CE9F6B] hover:shadow-lg hover:shadow-[#E17F70]/30"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-white/80 shadow-lg transition-all duration-300" />
                    )}
                    
                    <div className={cn(
                      "flex-shrink-0 rounded-xl transition-all duration-300 flex items-center justify-center",
                      isMobile ? "h-10 w-10" : "h-9 w-9",
                      isActive
                        ? "bg-white/20 shadow-inner backdrop-blur-sm"
                        : "bg-[#6F8A9D]/10 group-hover:bg-white/20 group-hover:shadow-lg group-hover:scale-110"
                    )}>
                      <Icon className={cn(
                        "transition-all duration-300",
                        isMobile ? "h-5 w-5" : "h-4 w-4",
                        isActive ? "text-white" : "text-[#6F8A9D] group-hover:text-white"
                      )} />
                    </div>
                    
                    {(!isCollapsed || isMobile) && (
                      <span className={cn("flex flex-1 items-center", isMobile ? "ml-3" : "ml-2.5")}>
                        <div className="flex-1 min-w-0">
                          <span className="truncate font-semibold tracking-tight block">{item.label}</span>
                          <span className={cn(
                            "text-[10px] block",
                            isActive ? "text-white/70" : "text-[#92A2A5] group-hover:text-white/70"
                          )}>{item.description}</span>
                        </div>
                      </span>
                    )}
                    
                    {isCollapsed && !isMobile && (
                      <div className={cn(
                        "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-xl bg-[#546A7A] px-3 py-2.5 text-xs font-semibold text-white shadow-2xl z-[100]",
                        "opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                      )}>
                        {item.label}
                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#546A7A] rotate-45" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className={cn(
            "relative border-t border-[#96AEC2]/15",
            "bg-[#F4F7F9]",
            isMobile ? "px-4 py-2" : "px-3 py-2"
          )}>
            <button
              onClick={handleBack}
              className={cn(
                "group w-full flex items-center rounded-xl transition-all duration-300",
                "hover:bg-gradient-to-r hover:from-[#96AEC2]/10 hover:to-[#82A094]/10 hover:shadow-md text-[#5D6E73] hover:text-[#6F8A9D]",
                isMobile ? "px-3 py-3 text-base" : isCollapsed ? "justify-center py-2.5" : "px-2.5 py-2.5 text-sm"
              )}
            >
              <div className={cn(
                "flex-shrink-0 rounded-xl transition-all duration-300 flex items-center justify-center",
                "bg-[#96AEC2]/10 group-hover:bg-[#96AEC2]/20 group-hover:shadow-lg group-hover:scale-110",
                isMobile ? "h-10 w-10" : "h-9 w-9"
              )}>
                <ArrowLeft className={cn(
                  "transition-all duration-300 text-[#6F8A9D] group-hover:text-[#546A7A]",
                  isMobile ? "h-5 w-5" : "h-4 w-4"
                )} />
              </div>
              {(!isCollapsed || isMobile) && (
                <span className={cn("font-semibold tracking-tight", isMobile ? "ml-3" : "ml-2.5")}>Switch Module</span>
              )}
              
              {isCollapsed && !isMobile && (
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

          <div className={cn(
            "relative border-t border-[#96AEC2]/15",
            "bg-[#F4F7F9]",
            isMobile ? "px-4 py-4" : "px-3 py-3"
          )}>
            <button
              onClick={handleLogout}
              className={cn(
                "group w-full flex items-center rounded-xl transition-all duration-300",
                "hover:bg-gradient-to-r hover:from-[#E17F70]/10 hover:to-[#EEC1BF]/10 hover:shadow-md text-[#5D6E73] hover:text-[#9E3B47]",
                isMobile ? "px-3 py-3 text-base" : isCollapsed ? "justify-center py-2.5" : "px-2.5 py-2.5 text-sm"
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
              {(!isCollapsed || isMobile) && (
                <span className={cn("font-semibold tracking-tight", isMobile ? "ml-3" : "ml-2.5")}>Logout</span>
              )}
              
              {isCollapsed && !isMobile && (
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
        </aside>
      )}
    </>
  );
}

function FinanceLayoutMain({
  children,
  isMobile,
  setMobileMenuOpen,
  isCollapsed
}: {
  children: ReactNode;
  isMobile: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  const handleBack = () => router.push('/finance/select');
  const handleLogout = async () => {
    localStorage.removeItem('selectedModule');
    localStorage.removeItem('selectedSubModule');
    await logout();
  };

  const getUserDisplayName = () => {
    if (!user) return 'Guest User';
    return user.name || user.email?.split('@')[0] || 'User';
  };

  const getEmailInitial = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const isOnline = !!user;

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden transition-all duration-500 ease-out relative z-10",
      isMobile ? "ml-0" : isCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
    )}>
      <header
        className={cn(
          'sticky top-0 z-50 flex-shrink-0',
          'bg-white/80 backdrop-blur-xl',
          'border-b border-[#AEBFC3]/20',
          'shadow-[0_4px_24px_-4px_rgba(111,138,157,0.08)]'
        )}
      >
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#96AEC2] via-[#82A094] to-[#CE9F6B] blur-sm opacity-50" />
        </div>
        
        <div className={cn("relative flex items-center justify-between", isMobile ? "h-18 px-5" : "h-[76px] px-8")}>
          <div className="flex items-center gap-4">
            <button
              className={cn(
                "lg:hidden rounded-xl",
                "text-[#6F8A9D] hover:text-[#546A7A]",
                "hover:bg-[#96AEC2]/10 hover:shadow-lg",
                "transition-all duration-300",
                "border border-transparent hover:border-[#96AEC2]/20",
                isMobile ? "h-11 w-11" : "h-10 w-10",
                "flex items-center justify-center"
              )}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className={cn("transition-transform", isMobile ? "h-6 w-6" : "h-5 w-5")} />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-[#96AEC2] via-[#82A094] to-[#CE9F6B] rounded-full opacity-80" />
                <div className="pl-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
                    <span className="bg-gradient-to-r from-[#546A7A] via-[#6F8A9D] to-[#82A094] bg-clip-text text-transparent">
                      Accounts Receivable
                    </span>
                  </h1>
                  <p className="text-[11px] font-medium text-[#6F8A9D]/60 tracking-wide uppercase mt-0.5 hidden sm:block">
                    Finance Module
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#6F8A9D]/8 transition-all border border-transparent hover:border-[#6F8A9D]/20 group"
              >
                <div className="relative">
                  <div className="absolute -inset-1.5 rounded-full opacity-0 group-hover:opacity-60 transition-all duration-500 blur-lg bg-gradient-to-br from-[#6F8A9D] via-[#82A094] to-[#6F8A9D]" />
                  <div className={cn(
                    "relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#96AEC2] flex items-center justify-center text-white font-bold shadow-lg shadow-[#6F8A9D]/25 ring-2 ring-white",
                    "group-hover:scale-110 transition-transform"
                  )}>
                    {getEmailInitial()}
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-white shadow-md transition-all",
                    isOnline ? "bg-gradient-to-br from-[#82A094] to-[#4F6A64]" : "bg-[#979796]"
                  )}>
                    {isOnline && (
                      <div className="absolute inset-0 rounded-full bg-[#82A094] animate-ping opacity-40" style={{ animationDuration: '2s' }} />
                    )}
                  </div>
                </div>
                
                <div className="hidden md:block text-left">
                  <div className="text-sm font-semibold text-[#546A7A] group-hover:text-[#6F8A9D] transition-colors">{getUserDisplayName()}</div>
                  <div className="text-xs text-[#92A2A5] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#82A094]" />
                    {(user as any)?.financeRole || 'FINANCE_USER'}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#92A2A5] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div 
                    className="absolute right-0 top-full mt-2 w-72 bg-white/[0.97] backdrop-blur-2xl rounded-2xl border-2 border-[#6F8A9D]/20 shadow-2xl shadow-[#6F8A9D]/10 overflow-hidden z-50 transition-all duration-200"
                  >
                    <div className="relative p-5 border-b border-[#6F8A9D]/10 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D]/10 via-white to-[#82A094]/10" />
                      <div className="relative flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute -inset-2 rounded-full blur-xl opacity-40 bg-gradient-to-br from-[#6F8A9D] via-[#82A094] to-[#6F8A9D]" />
                          <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-[#6F8A9D] to-[#96AEC2] flex items-center justify-center text-white text-xl font-bold shadow-xl">
                            {getEmailInitial()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-[#546A7A] truncate">{getUserDisplayName()}</p>
                          {user?.email && (
                            <p className="text-xs text-[#92A2A5] truncate mt-0.5">{user.email}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="relative mt-4 flex items-center gap-3 px-4 py-3 bg-white/80 rounded-xl border border-[#6F8A9D]/10 shadow-sm">
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
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#6F8A9D]/10 rounded-lg">
                          <Activity className="w-3 h-3 text-[#6F8A9D]/60" />
                          <span className="text-[10px] font-medium text-[#6F8A9D]/60">Finance</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <button
                        onClick={() => { setUserMenuOpen(false); handleBack(); }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-[#5D6E73] hover:text-white hover:bg-gradient-to-r hover:from-[#6F8A9D] hover:to-[#82A094] hover:shadow-lg transition-all group"
                      >
                        <div className="p-2 bg-[#6F8A9D]/10 rounded-lg group-hover:bg-white/20 transition-all">
                          <ArrowLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold block">Switch Module</span>
                          <span className="text-[10px] text-[#92A2A5] group-hover:text-white/70">Return to selection</span>
                        </div>
                      </button>
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-[#9E3B47] hover:text-white hover:bg-gradient-to-r hover:from-[#E17F70] hover:to-[#9E3B47] hover:shadow-lg transition-all group"
                      >
                        <div className="p-2 bg-[#E17F70]/10 rounded-lg group-hover:bg-white/20 transition-all">
                          <LogOut className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold block">Sign Out</span>
                          <span className="text-[10px] text-[#E17F70]/70 group-hover:text-white/70">End your session</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className={cn("min-h-full", isMobile ? "py-4 px-4" : "py-6 px-4 sm:px-6 lg:px-8")}>
          {children}
        </div>
      </main>
    </div>
  );
}

export function FinanceClientWrapper({ children }: FinanceLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => setStateMobile(window.innerWidth < 1024);
    
    checkMobile();
    
    const resizeListener = () => {
      checkMobile();
    };

    window.addEventListener('resize', resizeListener);
    return () => window.removeEventListener('resize', resizeListener);
  }, []);

  const setStateMobile = (mobile: boolean) => {
    setIsMobile(mobile);
    if (!mobile) setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <Suspense fallback={<div className="w-64 fixed h-screen bg-white/50 backdrop-blur-xl" />}>
        <FinanceSidebar 
          isMobile={isMobile}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />
      </Suspense>

      <FinanceLayoutMain
        isMobile={isMobile}
        setMobileMenuOpen={setMobileMenuOpen}
        isCollapsed={isCollapsed}
      >
        {children}
      </FinanceLayoutMain>
    </div>
  );
}
