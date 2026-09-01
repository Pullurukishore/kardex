'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Ticket, Package, ArrowLeft, ChevronRight, Sparkles, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SubModuleCard {
  id: 'tickets' | 'offers' | 'contracts';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}

export default function FSMSelectPage() {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const subModules: SubModuleCard[] = [
    {
      id: 'tickets',
      title: 'Tickets',
      description: 'Manage service requests, field visits, and customer support tickets',
      icon: <Ticket className="w-8 h-8" />,
      color: '#E17F70',
      features: ['Dashboard', 'Tickets', 'Customers', 'Zones'],
    },
    {
      id: 'offers',
      title: 'Offers',
      description: 'Track sales funnel, manage targets, and monitor performance metrics',
      icon: <Package className="w-8 h-8" />,
      color: '#CE9F6B',
      features: ['Offers', 'Targets', 'Reports', 'Forecast'],
    },
    {
      id: 'contracts',
      title: 'Contracts',
      description: 'Manage service contracts, SLA compliance, and recurring maintenance agreements',
      icon: <FileText className="w-8 h-8" />,
      color: '#82A094',
      features: ['Contracts', 'SLAs', 'Renewals', 'Templates'],
    }
  ];

  const getRoleDashboardPath = (subModuleId: string) => {
    const role = user?.role;
    if (subModuleId === 'tickets') {
      switch (role) {
        case 'ADMIN': return '/admin/dashboard';
        case 'ZONE_USER': return '/zone/dashboard';
        case 'ZONE_MANAGER': return '/zone/dashboard';
        case 'EXPERT_HELPDESK': return '/expert/dashboard';
        case 'SERVICE_PERSON': return '/service-person/dashboard';
        default: return '/admin/dashboard';
      }
    } else if (subModuleId === 'offers') {
      switch (role) {
        case 'ADMIN': return '/admin/offers';
        case 'ZONE_USER': return '/zone/offers';
        case 'ZONE_MANAGER': return '/zone-manager/offers';
        case 'EXPERT_HELPDESK': return '/expert/offers';
        default: return '/admin/offers';
      }
    } else {
      switch (role) {
        case 'ADMIN': return '/admin/contracts';
        case 'ZONE_USER': return '/zone/contracts';
        case 'ZONE_MANAGER': return '/zone-manager/contracts';
        case 'EXPERT_HELPDESK': return '/expert/contracts';
        default: return '/admin/contracts';
      }
    }
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Ensure localStorage is set when this page is accessed directly
    const selectedMod = localStorage.getItem('selectedModule');
    if (!selectedMod) {
      // User came directly to this page (e.g., from login redirect) - set the module
      localStorage.setItem('selectedModule', 'fsm');
    } else if (selectedMod !== 'fsm') {
      // User selected a different module, redirect
      router.push('/module-select');
      return;
    }
    
    if (user?.role === 'EXTERNAL_USER') {
      localStorage.setItem('selectedSubModule', 'tickets');
      router.push('/external/tickets');
    }
  }, [router, user?.role, mounted]);

  const handleSubModuleSelect = (subModuleId: string) => {
    setSelectedModule(subModuleId);
    if (typeof window !== 'undefined') localStorage.setItem('selectedSubModule', subModuleId);
    // Minimal delay for UI feedback
    setTimeout(() => router.push(getRoleDashboardPath(subModuleId)), 100);
  };

  const handleBack = () => {
    localStorage.removeItem('selectedModule');
    router.push('/module-select');
  };

  // Show loading state while mounting
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E17F70] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-6 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E17F70]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#CE9F6B]/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#82A094]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E17F70]/50 to-transparent"></div>
      </div>

      <div className="w-full max-w-5xl relative z-10">
        {/* Back Button */}
        <button onClick={handleBack} className="group flex items-center gap-3 text-white/50 hover:text-[#E17F70] mb-8 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#E17F70]/50 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Back to Modules</span>
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <Image src="/kardex-only.png" alt="Kardex" width={180} height={72} className="mx-auto mb-6 brightness-0 invert" priority />
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E17F70]/10 border border-[#E17F70]/25 mb-4">
            <Sparkles className="w-4 h-4 text-[#E17F70]" />
            <span className="text-sm font-semibold text-[#E17F70]">Field Service Management</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Select Your Workspace</h1>
          <p className="text-white/50 text-base">Choose your area of focus to launch dashboard</p>
        </div>

        {/* Cards - Responsive Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subModules.map((module) => (
            <button
              key={module.id}
              onClick={() => handleSubModuleSelect(module.id)}
              onMouseEnter={() => setHoveredModule(module.id)}
              onMouseLeave={() => setHoveredModule(null)}
              disabled={selectedModule !== null}
              className={`
                relative w-full flex flex-col justify-between p-6 rounded-2xl min-h-[300px]
                bg-white/5 backdrop-blur-sm border border-white/10
                transition-all duration-300 text-left
                ${hoveredModule === module.id ? 'bg-white/10 scale-[1.02]' : ''}
                ${selectedModule === module.id ? 'opacity-60 scale-[0.98]' : ''}
                ${selectedModule && selectedModule !== module.id ? 'opacity-40' : ''}
              `}
              style={{
                borderColor: hoveredModule === module.id ? `${module.color}50` : undefined,
                boxShadow: hoveredModule === module.id ? `0 15px 50px ${module.color}25` : undefined
              }}
            >
              {/* Top Accent bar */}
              <div 
                className={`absolute left-6 right-6 top-0 h-[3px] rounded-b-full transition-opacity ${hoveredModule === module.id ? 'opacity-100' : 'opacity-0'}`} 
                style={{ backgroundColor: module.color }} 
              />
              
              <div className="w-full space-y-5">
                {/* Header elements inside card */}
                <div className="flex justify-between items-center w-full">
                  <div 
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-white transition-all ${hoveredModule === module.id ? 'scale-110' : ''}`}
                    style={{ 
                      background: `linear-gradient(135deg, ${module.color}, ${module.color}99)`, 
                      boxShadow: `0 8px 25px ${module.color}35` 
                    }}
                  >
                    {module.icon}
                  </div>
                  
                  <div 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${hoveredModule === module.id ? 'border-transparent' : 'border-white/10'}`}
                    style={{ backgroundColor: hoveredModule === module.id ? module.color : 'transparent' }}
                  >
                    <ChevronRight className={`w-5 h-5 transition-all ${hoveredModule === module.id ? 'text-white translate-x-0.5' : 'text-white/40'}`} />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{module.title}</h2>
                  <p className="text-sm text-white/50 leading-relaxed min-h-[60px]">{module.description}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-white/5 w-full">
                {module.features.map((f, i) => (
                  <span 
                    key={i} 
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold" 
                    style={{ backgroundColor: `${module.color}15`, color: module.color }}
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Loading */}
              {selectedModule === module.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#1a1a2e]/85">
                  <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                      <div 
                        key={i} 
                        className="w-2.5 h-2.5 rounded-full animate-bounce" 
                        style={{ backgroundColor: module.color, animationDelay: `${i * 0.15}s` }} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-white/30 text-sm">© {new Date().getFullYear()} Kardex Remstar. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
