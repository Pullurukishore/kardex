'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Receipt, Building2, ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';

interface SubModuleCard {
  id: 'ar' | 'bank-accounts';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  disabled?: boolean;
}

export default function FinanceSelectPage() {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const subModules: SubModuleCard[] = ([
    {
      id: 'ar',
      title: 'Accounts Receivable',
      description: 'Manage invoices, track payments, and handle collections efficiently',
      icon: <Receipt className="w-8 h-8" />,
      color: '#E17F70',
      features: ['Dashboard', 'Invoices', 'Payments', 'Reports'],
    },
    {
      id: 'bank-accounts',
      title: 'Vendor Accounts',
      description: 'Vendor management, requests, and verification',
      icon: <Building2 className="w-8 h-8" />,
      color: '#CE9F6B',
      features: ['Vendors', 'Requests', 'New Vendor', 'Activities'],
    }
  ] as SubModuleCard[]).filter(m => {
    if (!user) return true;
    
    // Finance Admin has access to both modules
    if (user.financeRole === FinanceRole.FINANCE_ADMIN) return true;

    // Check AR Module access
    if (m.id === 'ar') {
      // If arRole is explicitly null, don't show the AR module
      if (user.arRole === null) return false;
      
      // Fallback check: Finance Approver cannot see Accounts Receivable unless explicitly granted
      if (user.financeRole === FinanceRole.FINANCE_APPROVER && !user.arRole) {
        return false;
      }
    }

    // Check Vendor Module access
    if (m.id === 'bank-accounts') {
      // If vendorRole is explicitly null, don't show the Vendor module
      if (user.vendorRole === null) return false;
    }

    return true;
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Ensure localStorage is set when this page is accessed directly
    const selectedMod = localStorage.getItem('selectedModule');
    if (!selectedMod) {
      // User came directly to this page (e.g., from login redirect) - set the module
      localStorage.setItem('selectedModule', 'finance');
    } else if (selectedMod !== 'finance') {
      // User selected a different module, redirect
      router.push('/module-select');
    }
  }, [router, mounted]);

  const handleSubModuleSelect = (subModuleId: string) => {
    const module = subModules.find(m => m.id === subModuleId);
    if (module?.disabled) return;
    setSelectedModule(subModuleId);
    if (typeof window !== 'undefined') localStorage.setItem('selectedSubModule', subModuleId);
    // Minimal delay for UI feedback
    setTimeout(() => {
      if (subModuleId === 'ar') router.push('/finance/ar/dashboard');
      else router.push('/finance/bank-accounts');
    }, 100);
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
          <div className="w-12 h-12 border-4 border-[#CE9F6B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#CE9F6B]/50 to-transparent"></div>
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Back Button */}
        <button onClick={handleBack} className="group flex items-center gap-3 text-white/50 hover:text-[#CE9F6B] mb-8 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#CE9F6B]/50 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Back to Modules</span>
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <Image src="/kardex.png" alt="Kardex" width={180} height={72} className="mx-auto mb-6 brightness-0 invert" priority />
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#CE9F6B]/10 border border-[#CE9F6B]/25 mb-4">
            <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
            <span className="text-sm font-semibold text-[#CE9F6B]">Finance Module</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Select Your Workspace</h1>
          <p className="text-white/50">Choose your area of focus</p>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {subModules.map((module) => (
            <button
              key={module.id}
              onClick={() => handleSubModuleSelect(module.id)}
              onMouseEnter={() => setHoveredModule(module.id)}
              onMouseLeave={() => setHoveredModule(null)}
              disabled={selectedModule !== null || module.disabled}
              className={`
                relative w-full flex items-center gap-5 p-6 rounded-2xl
                bg-white/5 backdrop-blur-sm border border-white/10
                transition-all duration-300 text-left
                ${hoveredModule === module.id && !module.disabled ? 'bg-white/10 scale-[1.02]' : ''}
                ${selectedModule === module.id ? 'opacity-60 scale-[0.98]' : ''}
                ${selectedModule && selectedModule !== module.id ? 'opacity-40' : ''}
                ${module.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={{
                borderColor: hoveredModule === module.id && !module.disabled ? `${module.color}50` : undefined,
                boxShadow: hoveredModule === module.id && !module.disabled ? `0 15px 50px ${module.color}25` : undefined
              }}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full transition-opacity ${hoveredModule === module.id && !module.disabled ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundColor: module.color }} />
              
              {/* Icon */}
              <div 
                className={`w-16 h-16 rounded-xl flex items-center justify-center text-white transition-all ${hoveredModule === module.id && !module.disabled ? 'scale-110' : ''}`}
                style={{ background: `linear-gradient(135deg, ${module.color}, ${module.color}99)`, boxShadow: `0 8px 25px ${module.color}50` }}
              >
                {module.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">{module.title}</h2>
                <p className="text-sm text-white/50 mb-3">{module.description}</p>
                <div className="flex flex-wrap gap-2">
                  {module.features.map((f, i) => (
                    <span key={i} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: `${module.color}20`, color: module.color }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${hoveredModule === module.id && !module.disabled ? 'border-transparent' : 'border-white/10'}`}
                style={{ backgroundColor: hoveredModule === module.id && !module.disabled ? module.color : 'transparent' }}>
                <ChevronRight className={`w-6 h-6 transition-all ${hoveredModule === module.id && !module.disabled ? 'text-white translate-x-0.5' : 'text-white/40'}`} />
              </div>

              {/* Loading */}
              {selectedModule === module.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#1a1a2e]/80">
                  <div className="flex gap-2">
                    {[0, 1, 2].map(i => <div key={i} className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: module.color, animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-white/30 text-sm">© {new Date().getFullYear()} Kardex Remstar. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
