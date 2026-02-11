'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/user.types';

// Dynamic imports for heavy components - reduces initial bundle
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

interface DashboardClientWrapperProps {
  children: React.ReactNode;
  userRole: UserRole;
}

export function DashboardClientWrapper({ children, userRole }: DashboardClientWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const pathname = usePathname();
  
  // Service persons and external users don't need sidebar - single dashboard approach
  const showSidebar = userRole !== 'SERVICE_PERSON' && userRole !== 'EXTERNAL_USER';

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      // Auto-collapse sidebar on desktop, but keep it as overlay on mobile
      if (!mobile && window.innerWidth < 1280) { // xl breakpoint
        setIsCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile sidebar on route change and handle page transitions
  useEffect(() => {
    setSidebarOpen(false);
    // Trigger page transition animation
    setIsPageVisible(false);
    const timer = setTimeout(() => {
      setPageKey(prev => prev + 1);
      setIsPageVisible(true);
    }, 10);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Mobile overlay */}
      {showSidebar && sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - fixed position, edge-to-edge like Finance */}
      {showSidebar && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-[60] print:hidden transition-all duration-300 ease-out",
            isMobile 
              ? cn("w-80", sidebarOpen ? "translate-x-0" : "-translate-x-full")
              : cn(isCollapsed ? "w-[72px]" : "w-64", "hidden lg:block")
          )}
        >
          <Sidebar 
            userRole={userRole}
            collapsed={!isMobile && isCollapsed}
            setCollapsed={setIsCollapsed}
            onClose={() => setSidebarOpen(false)}
            className="h-full w-full"
          />
        </div>
      )}
      
      {/* Main content - no extra padding/gaps like Finance */}
      <div 
        className={cn(
          "flex flex-col h-screen overflow-hidden transition-all duration-300 ease-out relative z-10",
          !showSidebar 
            ? "ml-0" 
            : isMobile 
              ? "ml-0" 
              : isCollapsed 
                ? "lg:ml-[72px]"
                : "lg:ml-64"
        )}
      >
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          showSidebar={showSidebar}
          className="print:hidden flex-shrink-0"
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className={cn("min-h-full", isMobile ? "p-3" : "p-4")}>
            {/* Page transition */}
            <div
              key={pageKey}
              className={cn(
                "transition-all duration-150 ease-out",
                isPageVisible 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-1"
              )}
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
