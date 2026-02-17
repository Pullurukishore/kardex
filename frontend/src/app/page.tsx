'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleBasedRedirect } from '@/lib/utils/navigation';
import { Loader2, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    // Update status text based on loading state
    if (isLoading) {
      setStatusText('Authenticating...');
    } else if (isAuthenticated && user) {
      setStatusText(`Welcome back, ${user.name || 'User'}!`);
      setProgress(100);
    } else {
      setStatusText('Redirecting to login...');
      setProgress(100);
    }
  }, [isLoading, isAuthenticated, user]);

  useEffect(() => {
    // Add a small delay to prevent conflicts with server-side redirects
    const redirectTimer = setTimeout(() => {
      // Only redirect after auth state is fully initialized
      if (!isLoading) {
        // PRIORITY: Check for PIN first as requested by USER
        // This ensures shared devices/kiosks go to PIN before Login
        const hasPinCookie = typeof document !== 'undefined' && document.cookie.split('; ').find(row => row.startsWith('pinSession='));
        const hasPinLocal = typeof window !== 'undefined' && localStorage.getItem('pinAccessSession');

        if (!hasPinCookie && !hasPinLocal) {
          if (typeof window !== 'undefined') {
            window.location.href = '/pin-access';
          }
          return;
        }

        if (isAuthenticated && user) {
          const redirectPath = getRoleBasedRedirect(user.role as any, user.financeRole as any);
          if (typeof window !== 'undefined') {
            window.location.href = redirectPath;
          }
        } else {
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
      }
    }, 500); // Small delay for smoother transition

    return () => clearTimeout(redirectTimer);
  }, [isLoading, isAuthenticated, user]);

  // Show loading spinner while determining authentication status
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#AEBFC3]/10 via-[#F8FAFB] to-[#96AEC2]/15 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating orbs with Kardex colors */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-kardex-blue-1/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-kardex-green-2/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-kardex-sand-2/5 to-kardex-green-1/5 rounded-full blur-3xl" />

        {/* Decorative dots */}
        <div className="absolute top-20 right-20 w-3 h-3 rounded-full bg-kardex-blue-1/40 animate-pulse" />
        <div className="absolute bottom-32 left-32 w-2 h-2 rounded-full bg-kardex-green-2/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/3 right-1/3 w-2 h-2 rounded-full bg-kardex-sand-2/40 animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: 'linear-gradient(rgba(150,174,194,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(150,174,194,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="max-w-lg w-full relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        {/* Main Card with Glass Effect */}
        <div className="relative">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-kardex-blue-1/20 via-kardex-green-2/20 to-kardex-sand-2/20 rounded-[2rem] blur-xl opacity-60" />

          <div className="relative bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-kardex-blue-1/20 border border-kardex-blue-1/20 p-10 overflow-hidden">
            {/* Decorative top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-kardex-blue-1 via-kardex-green-2 to-kardex-sand-2" />

            {/* Content */}
            <div className="relative">
              {/* Logo with enhanced presentation and shimmer loading */}
              <div className="mb-10 flex justify-center">
                <div className="relative w-[260px] h-[104px] flex items-center justify-center">
                  {/* Subtle shimmer background for logo placeholder */}
                  <div className="absolute inset-0 bg-kardex-silver-1/5 rounded-xl animate-pulse overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                  <Image
                    src="/kardex.png"
                    alt="Kardex Logo"
                    width={260}
                    height={104}
                    className="relative z-10 drop-shadow-md transition-opacity duration-500"
                    priority
                    onLoadingComplete={(img) => {
                      img.classList.remove('opacity-0');
                    }}
                  />
                </div>
              </div>

              {/* Elegant divider with icon */}
              <div className="relative mb-8">
                <div className="h-px bg-gradient-to-r from-transparent via-kardex-grey-1/50 to-transparent" />
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kardex-blue-1 to-kardex-blue-2 flex items-center justify-center shadow-lg shadow-kardex-blue-1/30">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="text-center mb-10">
                <h1 className="text-3xl font-extrabold tracking-tight text-kardex-blue-3 mb-3">
                  Ticket Management System
                </h1>
                <p className="text-kardex-grey-2 font-semibold tracking-wide uppercase text-xs">
                  Streamlined service management solutions
                </p>
              </div>

              {/* Loading Section */}
              <div className="space-y-6">
                {/* Status with animated icon */}
                <div className="flex items-center justify-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-kardex-blue-1/30 rounded-full blur-md animate-pulse" />
                    <div className="relative bg-gradient-to-br from-kardex-blue-2 to-kardex-blue-3 rounded-full p-2.5 shadow-lg shadow-kardex-blue-2/30">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  </div>
                  <span className="text-kardex-blue-3 font-bold text-lg tracking-tight">{statusText}</span>
                </div>

                {/* Enhanced Progress Bar */}
                <div className="relative">
                  <div className="h-3 bg-kardex-grey-1/20 rounded-full overflow-hidden shadow-inner">
                    {/* Animated progress fill */}
                    <div
                      className="h-full bg-gradient-to-r from-kardex-blue-1 via-kardex-green-2 to-kardex-blue-2 rounded-full transition-all duration-500 ease-out relative"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    >
                      {/* Shimmer effect on progress bar */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                    </div>
                  </div>

                  {/* Progress percentage */}
                  <div className="flex justify-between mt-2.5 text-xs font-bold text-kardex-grey-2 uppercase tracking-widest">
                    <span>Loading</span>
                    <span className="text-kardex-blue-2">{Math.round(Math.min(progress, 100))}%</span>
                  </div>
                </div>

                {/* Animated dots */}
                <div className="flex justify-center items-center gap-2 pt-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce shadow-sm"
                      style={{
                        background: i % 2 === 0 ? '#96AEC2' : '#82A094',
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex justify-center gap-3 mt-10 flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-full px-4 py-2 border border-kardex-blue-1/20 shadow-xl shadow-kardex-blue-1/5">
            <Shield className="w-4 h-4 text-kardex-blue-2" />
            <span className="text-kardex-blue-3 text-xs font-bold uppercase tracking-wider">Secure Access</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-full px-4 py-2 border border-kardex-sand-2/20 shadow-xl shadow-kardex-sand-2/5">
            <Zap className="w-4 h-4 text-kardex-sand-2" />
            <span className="text-kardex-blue-3 text-xs font-bold uppercase tracking-wider">Fast & Reliable</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md rounded-full px-4 py-2 border border-kardex-green-2/20 shadow-xl shadow-kardex-green-2/5">
            <ArrowRight className="w-4 h-4 text-kardex-green-2" />
            <span className="text-kardex-blue-3 text-xs font-bold uppercase tracking-wider">Auto Redirect</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-10 animate-in fade-in duration-1000 delay-500">
          <div className="inline-flex items-center gap-2.5 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-kardex-grey-1/20 shadow-lg">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kardex-green-2 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-kardex-green-2" />
            </div>
            <p className="text-kardex-grey-3 text-[10px] font-bold uppercase tracking-[0.2em]">
              Powered by intelligent automation
            </p>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .opacity-0 {
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
