'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Wrench, Banknote, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasModuleAccess, ModuleType } from '@/types/user.types';

interface ModuleCard {
  id: ModuleType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const allModules: ModuleCard[] = [
  {
    id: 'fsm',
    title: 'Field Service',
    subtitle: 'Management',
    description: 'Tickets, service personnel & customer assets',
    icon: <Wrench className="w-6 h-6" />,
    color: '#E17F70',
  },
  {
    id: 'finance',
    title: 'Finance',
    subtitle: 'Accounts & Analytics',
    description: 'Invoices, payments & financial reports',
    icon: <Banknote className="w-6 h-6" />,
    color: '#CE9F6B',
  }
];

export default function ModuleSelectPage() {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [availableModules, setAvailableModules] = useState<ModuleCard[]>([]);
  const [mounted, setMounted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Wait for both mounted and auth loading to complete
    if (!mounted || isLoading) return;
    
    // Don't redirect to login if no user - they may be coming from login page
    // and auth state hasn't synced yet. Give it time or let PinGuard/middleware handle it.
    if (!user) {
      // Small delay to allow state to sync
      const timer = setTimeout(() => {
        if (!user) router.push('/auth/login');
      }, 100);
      return () => clearTimeout(timer);
    }
    
    if (user.role === 'SERVICE_PERSON') {
      localStorage.setItem('selectedModule', 'fsm');
      localStorage.setItem('selectedSubModule', 'tickets');
      router.push('/service-person/dashboard');
      return;
    }
    
    const accessible = allModules.filter(m => hasModuleAccess(user, m.id));
    setAvailableModules(accessible);
    setInitialized(true);
    
    if (accessible.length === 1) handleModuleSelect(accessible[0].id);
  }, [user, router, mounted, isLoading]);

  const handleModuleSelect = (moduleId: ModuleType) => {
    setSelectedModule(moduleId);
    if (typeof window !== 'undefined') localStorage.setItem('selectedModule', moduleId);
    
    // Minimal delay for UI feedback, then redirect immediately
    const delay = availableModules.length === 1 ? 0 : 100;
    setTimeout(() => {
      if (moduleId === 'fsm') router.push('/fsm/select');
      else if (moduleId === 'finance') router.push('/finance/select');
    }, delay);
  };

  // Show loading state while initializing
  if (!mounted || isLoading || (!initialized && !selectedModule)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E17F70] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60 text-sm">Loading modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-4 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#E17F70]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#CE9F6B]/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#82A094]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E17F70]/50 to-transparent"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(225,127,112,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(225,127,112,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/kardex-only.png" alt="Kardex" width={140} height={56} className="mx-auto mb-6 brightness-0 invert" priority />
          
          {/* Welcome Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4">
            <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
            <span className="text-sm font-medium text-white/70">Welcome, {user?.name || 'User'}</span>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-1">Select Workspace</h1>
          <p className="text-white/50 text-sm">Choose a module to continue</p>
        </div>

        {/* Module Cards */}
        <div className="space-y-3">
          {availableModules.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleSelect(module.id)}
              onMouseEnter={() => setHoveredModule(module.id)}
              onMouseLeave={() => setHoveredModule(null)}
              disabled={selectedModule !== null}
              className={`
                relative w-full flex items-center gap-4 p-4 rounded-2xl
                bg-white/5 backdrop-blur-sm border border-white/10
                transition-all duration-300 text-left
                ${hoveredModule === module.id ? 'bg-white/10 border-white/20 scale-[1.02]' : ''}
                ${selectedModule === module.id ? 'opacity-60 scale-[0.98]' : ''}
                ${selectedModule && selectedModule !== module.id ? 'opacity-40' : ''}
                disabled:cursor-not-allowed
              `}
              style={{
                borderColor: hoveredModule === module.id ? `${module.color}40` : undefined,
                boxShadow: hoveredModule === module.id ? `0 10px 40px ${module.color}20` : undefined
              }}
            >
              {/* Left accent bar */}
              <div 
                className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-opacity ${hoveredModule === module.id ? 'opacity-100' : 'opacity-0'}`}
                style={{ backgroundColor: module.color }}
              />
              
              {/* Icon */}
              <div 
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all ${hoveredModule === module.id ? 'scale-110' : ''}`}
                style={{ 
                  background: `linear-gradient(135deg, ${module.color}, ${module.color}99)`,
                  boxShadow: `0 4px 20px ${module.color}40`
                }}
              >
                {module.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white">{module.title}</h2>
                <p className="text-xs text-white/40">{module.description}</p>
              </div>

              {/* Arrow */}
              <div 
                className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                  hoveredModule === module.id ? 'border-transparent' : 'border-white/10 bg-white/5'
                }`}
                style={{ backgroundColor: hoveredModule === module.id ? module.color : undefined }}
              >
                <ChevronRight className={`w-5 h-5 transition-all ${hoveredModule === module.id ? 'text-white translate-x-0.5' : 'text-white/40'}`} />
              </div>

              {/* Loading */}
              {selectedModule === module.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#1a1a2e]/80 backdrop-blur-sm">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: module.color, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/30 text-xs">© {new Date().getFullYear()} Kardex Remstar</p>
        </div>
      </div>
    </div>
  );
}
