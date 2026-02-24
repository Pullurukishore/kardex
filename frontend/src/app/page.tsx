'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleBasedRedirect } from '@/lib/utils/navigation';
import { Loader2, Shield, Zap, ArrowRight, Sparkles, Activity, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing...');
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showFooter, setShowFooter] = useState(false);

  // Mount animation sequence
  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setShowContent(true), 300);
    const t2 = setTimeout(() => setShowFeatures(true), 800);
    const t3 = setTimeout(() => setShowFooter(true), 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 12;
      });
    }, 250);
    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
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
    const redirectTimer = setTimeout(() => {
      if (!isLoading) {
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
    }, 500);
    return () => clearTimeout(redirectTimer);
  }, [isLoading, isAuthenticated, user]);

  const progressPercent = Math.round(Math.min(progress, 100));
  const isComplete = progress >= 100;

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(160deg, #546A7A 0%, #3d5261 25%, #2d3f4d 50%, #546A7A 75%, #6F8A9D 100%)',
      }}
    >
      {/* === ANIMATED BACKGROUND LAYER === */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial glow from center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(150,174,194,0.15) 0%, rgba(130,160,148,0.08) 40%, transparent 70%)',
          }}
        />

        {/* Orbiting ring 1 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
          style={{ animation: 'orbit-spin 20s linear infinite' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
            style={{ background: '#96AEC2', boxShadow: '0 0 20px rgba(150,174,194,0.6)' }}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ background: '#82A094', boxShadow: '0 0 15px rgba(130,160,148,0.5)' }}
          />
        </div>

        {/* Orbiting ring 2 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px]"
          style={{ animation: 'orbit-spin 30s linear infinite reverse' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
            style={{ background: '#CE9F6B', boxShadow: '0 0 15px rgba(206,159,107,0.4)' }}
          />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: '#AEBFC3', boxShadow: '0 0 10px rgba(174,191,195,0.4)' }}
          />
        </div>

        {/* Floating geometric shapes */}
        <div className="absolute top-[15%] left-[10%] w-16 h-16 border border-[#96AEC2]/20 rounded-lg"
          style={{ animation: 'float-shape 8s ease-in-out infinite', transform: 'rotate(45deg)' }}
        />
        <div className="absolute bottom-[20%] right-[12%] w-12 h-12 border border-[#82A094]/20 rounded-full"
          style={{ animation: 'float-shape 10s ease-in-out infinite 2s' }}
        />
        <div className="absolute top-[60%] left-[8%] w-8 h-8 border border-[#CE9F6B]/15 rounded-md"
          style={{ animation: 'float-shape 12s ease-in-out infinite 4s', transform: 'rotate(30deg)' }}
        />
        <div className="absolute top-[25%] right-[15%] w-10 h-10 border border-[#AEBFC3]/15 rounded-lg"
          style={{ animation: 'float-shape 9s ease-in-out infinite 1s', transform: 'rotate(60deg)' }}
        />

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(150,174,194,1) 1px, transparent 1px), linear-gradient(90deg, rgba(150,174,194,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* === MAIN CONTENT === */}
      <div className={`max-w-xl w-full relative z-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Main Card */}
        <div className="relative">
          {/* Card glow */}
          <div className="absolute -inset-[2px] rounded-[2rem] opacity-60"
            style={{
              background: 'linear-gradient(135deg, rgba(150,174,194,0.3), rgba(130,160,148,0.2), rgba(206,159,107,0.15))',
              filter: 'blur(20px)',
            }}
          />

          <div className="relative rounded-[2rem] overflow-hidden border border-white/10"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Top accent bar */}
            <div className="h-[3px]"
              style={{ background: 'linear-gradient(90deg, #96AEC2, #82A094, #CE9F6B, #96AEC2)' }}
            />

            <div className="p-10 sm:p-12">
              {/* Logo Section */}
              <div className={`mb-8 flex justify-center transition-all duration-700 delay-200 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="relative">
                  {/* Logo halo */}
                  <div className="absolute -inset-4 rounded-2xl"
                    style={{
                      background: 'radial-gradient(ellipse, rgba(150,174,194,0.15) 0%, transparent 70%)',
                    }}
                  />
                  <div className="relative bg-white/95 rounded-2xl p-5 shadow-lg"
                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' }}
                  >
                    <Image
                      src="/kardex.png"
                      alt="Kardex Logo"
                      width={220}
                      height={88}
                      className="relative z-10 drop-shadow-sm"
                      priority
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className={`relative mb-8 transition-all duration-700 delay-400 ${showContent ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`}>
                <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(150,174,194,0.4), rgba(130,160,148,0.4), transparent)' }} />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3"
                  style={{ background: 'rgba(84,106,122,0.3)', backdropFilter: 'blur(10px)' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #96AEC2, #6F8A9D)',
                      boxShadow: '0 4px 15px rgba(150,174,194,0.4)',
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className={`text-center mb-10 transition-all duration-700 delay-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
                >
                  Service Management
                </h1>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #CE9F6B)' }} />
                  <p className="text-xs font-bold uppercase tracking-[0.25em]"
                    style={{ color: '#CE9F6B' }}
                  >
                    Ticket Management System
                  </p>
                  <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, #CE9F6B, transparent)' }} />
                </div>
                <p className="text-sm" style={{ color: 'rgba(174,191,195,0.8)' }}>
                  Streamlined service management solutions
                </p>
              </div>

              {/* Loading Section */}
              <div className={`space-y-6 transition-all duration-700 delay-600 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                {/* Status */}
                <div className="flex items-center justify-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: isComplete ? 'rgba(130,160,148,0.3)' : 'rgba(150,174,194,0.3)' }}
                    />
                    <div className="relative rounded-full p-2.5"
                      style={{
                        background: isComplete
                          ? 'linear-gradient(135deg, #82A094, #4F6A64)'
                          : 'linear-gradient(135deg, #96AEC2, #6F8A9D)',
                        boxShadow: isComplete
                          ? '0 4px 20px rgba(130,160,148,0.4)'
                          : '0 4px 20px rgba(150,174,194,0.4)',
                      }}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      )}
                    </div>
                  </div>
                  <span className="text-white font-semibold text-lg tracking-tight">
                    {statusText}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-2.5 rounded-full overflow-hidden"
                    style={{
                      background: 'rgba(150,174,194,0.15)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        background: isComplete
                          ? 'linear-gradient(90deg, #82A094, #A2B9AF)'
                          : 'linear-gradient(90deg, #96AEC2, #82A094, #CE9F6B)',
                        boxShadow: isComplete
                          ? '0 0 12px rgba(130,160,148,0.5)'
                          : '0 0 12px rgba(150,174,194,0.4)',
                      }}
                    >
                      {/* Shimmer on progress */}
                      <div className="absolute inset-0 animate-shimmer"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Progress labels */}
                  <div className="flex justify-between mt-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: 'rgba(174,191,195,0.6)' }}
                    >
                      Loading
                    </span>
                    <span className="text-[10px] font-bold tracking-wider"
                      style={{ color: isComplete ? '#82A094' : '#96AEC2' }}
                    >
                      {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Animated Dots */}
                <div className="flex justify-center items-center gap-2 pt-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{
                        background: ['#96AEC2', '#82A094', '#CE9F6B', '#A2B9AF', '#AEBFC3'][i],
                        animationDelay: `${i * 0.12}s`,
                        boxShadow: `0 0 6px ${['rgba(150,174,194,0.4)', 'rgba(130,160,148,0.4)', 'rgba(206,159,107,0.4)', 'rgba(162,185,175,0.4)', 'rgba(174,191,195,0.3)'][i]}`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className={`flex justify-center gap-3 mt-8 flex-wrap transition-all duration-700 ${showFeatures ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {[
            { icon: Shield, label: 'Secure Access', color: '#96AEC2', delay: '0ms' },
            { icon: Zap, label: 'Fast & Reliable', color: '#CE9F6B', delay: '100ms' },
            { icon: Activity, label: 'Real-time', color: '#82A094', delay: '200ms' },
          ].map(({ icon: Icon, label, color, delay }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 border transition-all duration-300 hover:scale-105 cursor-default"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                borderColor: `${color}33`,
                boxShadow: `0 4px 15px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.05)`,
                animationDelay: delay,
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-white/90 text-[11px] font-bold uppercase tracking-wider">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`text-center mt-8 transition-all duration-700 ${showFooter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(150,174,194,0.15)',
            }}
          >
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: '#82A094' }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: '#82A094' }}
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(174,191,195,0.5)' }}
            >
              Powered by intelligent automation
            </p>
          </div>
        </div>
      </div>

      {/* === CSS ANIMATIONS === */}
      <style jsx global>{`
        @keyframes orbit-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes float-shape {
          0%, 100% { transform: translateY(0) rotate(var(--rotation, 45deg)); opacity: 0.3; }
          50%      { transform: translateY(-20px) rotate(calc(var(--rotation, 45deg) + 10deg)); opacity: 0.6; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
