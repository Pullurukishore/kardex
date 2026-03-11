'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, AlertCircle, CheckCircle, Key, Loader2, Delete, Fingerprint } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleBasedRedirect } from '@/lib/utils/navigation';

interface PinSession { sessionId: string; expiresAt: string; }
interface PinValidationResponse { success: boolean; message?: string; error?: string; sessionId?: string; expiresAt?: string; attemptsLeft?: number; lockedUntil?: string; }

const LOCAL_STORAGE_KEY = 'pinAccessSession';
const LOCKOUT_STORAGE_KEY = 'pinLockoutInfo';

const getLocalSession = (): PinSession | null => {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        const session = JSON.parse(data);
        if (session.expiresAt && new Date(session.expiresAt) > new Date()) return session;
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  } catch {}
  return null;
};

const setLocalSession = (session: PinSession) => {
  try { if (typeof window !== 'undefined') localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session)); } catch {}
};

const getLockoutInfo = () => {
  try {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(LOCKOUT_STORAGE_KEY);
      if (data) {
        const info = JSON.parse(data);
        if (info.lockedUntil && new Date(info.lockedUntil) > new Date()) return info;
        localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      }
    }
  } catch {}
  return null;
};

const setLockoutInfo = (info: any) => { try { if (typeof window !== 'undefined') localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(info)); } catch {} };
const clearLockoutInfo = () => { try { if (typeof window !== 'undefined') localStorage.removeItem(LOCKOUT_STORAGE_KEY); } catch {} };

export default function PinAccessPage() {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [shake, setShake] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState<string | null>(null);
  const [lockoutCountdown, setLockoutCountdown] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const router = useRouter();

  const keypadRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'delete']];
  
  // Determine redirect path based on user role and any module selection
  const getRedirectPath = () => {
    // Check for callbackUrl in the URL params first
    if (typeof window !== 'undefined') {
      const urlParams = new URL(window.location.href).searchParams;
      const callback = urlParams.get('callbackUrl');
      if (callback && callback.startsWith('/') && !callback.startsWith('/pin-access')) {
        return callback;
      }
    }

    // If not logged in at all, go straight to login
    if (!user) return '/auth/login';

    const selectedModule = localStorage.getItem('selectedModule');
    if (selectedModule === 'finance') return '/finance/select';
    if (selectedModule === 'fsm') return '/fsm/select';
    
    // Use role-based redirect
    return getRoleBasedRedirect(user?.role, user?.financeRole);
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const init = async () => {
      try {
        const localLockout = getLockoutInfo();
        if (localLockout) { setIsLocked(true); setLockoutTime(localLockout.lockedUntil); }
        const response = await apiClient.get('/auth/pin-status');
        if (response.data) {
          setAttemptsLeft(response.data.attemptsLeft || 5);
          if (response.data.lockedUntil && !localLockout) {
            setIsLocked(true); setLockoutTime(response.data.lockedUntil);
            setLockoutInfo({ isLocked: true, lockedUntil: response.data.lockedUntil, timestamp: Date.now() });
          }
        }
      } catch { const l = getLockoutInfo(); if (l) { setIsLocked(true); setLockoutTime(l.lockedUntil); } }
    };
    init();
  }, [mounted]);

  useEffect(() => {
    if (!isLocked || !lockoutTime) return;
    const interval = setInterval(() => {
      const left = new Date(lockoutTime).getTime() - Date.now();
      if (left <= 0) { setIsLocked(false); setLockoutTime(null); setLockoutCountdown(''); clearLockoutInfo(); }
      else { const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000); setLockoutCountdown(`${m}:${s.toString().padStart(2, '0')}`); }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockoutTime]);

  useEffect(() => {
    if (!mounted) return;
    const check = async () => {
      if (isLocked) { setChecking(false); return; }
      try {
        let valid = false;
        try { if (document.cookie.includes('pinSession=')) valid = true; } catch {}
        if (!valid && getLocalSession()?.sessionId) valid = true;
        if (valid) { 
          // User already has valid PIN session, redirect to module
          router.push(getRedirectPath()); 
          return; 
        }
        setChecking(false);
      } catch { setChecking(false); }
    };
    check();
  }, [router, isLocked, mounted]);

  const handleKeyPress = useCallback((key: string) => {
    if (loading || success || isLocked) return;
    setActiveKey(key); setTimeout(() => setActiveKey(null), 150);
    if (key === 'delete') { setPin(p => p.slice(0, -1)); setError(''); }
    else if (key && pin.length < 6) { setPin(p => p + key); setError(''); }
  }, [loading, success, isLocked, pin.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (loading || success || isLocked) return;
    if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
    else if (e.key === 'Backspace') handleKeyPress('delete');
    else if (e.key === 'Enter' && pin.length === 6) handleSubmit();
  }, [handleKeyPress, loading, success, isLocked, pin.length]);

  useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (loading || success || pin.length !== 6) return;
    setLoading(true); setError('');
    try {
      const res = await apiClient.post<PinValidationResponse>('/auth/validate-pin', { pin }, { headers: { 'X-Skip-Global-Error-Handler': 'true' } });
      // apiClient.post already returns response.data, so 'res' IS the response data directly
      const data = res as unknown as PinValidationResponse;
      if (data?.success) {
        setSuccess(true); clearLockoutInfo(); setIsLocked(false);
        if (data.sessionId && data.expiresAt) setLocalSession({ sessionId: data.sessionId, expiresAt: data.expiresAt });
        setTimeout(() => { 
          try { 
            if (!document.cookie.includes('pinSession=') && data.sessionId) apiClient.setPinSession(data.sessionId); 
          } catch {} 
          // Redirect to the appropriate module dashboard
          router.push(getRedirectPath()); 
        }, 500);
      } else { triggerError(data?.error || 'Invalid PIN'); if (typeof data?.attemptsLeft === 'number') setAttemptsLeft(data.attemptsLeft); }
    } catch (err: any) {
      let msg = 'Invalid PIN'; if (err.response?.data?.error) msg = err.response.data.error;
      if (err.response?.data?.attemptsLeft !== undefined) setAttemptsLeft(err.response.data.attemptsLeft);
      if (err.response?.data?.lockedUntil) { setIsLocked(true); setLockoutTime(err.response.data.lockedUntil); setLockoutInfo({ isLocked: true, lockedUntil: err.response.data.lockedUntil, timestamp: Date.now() }); }
      triggerError(msg);
    }
  };

  const triggerError = (msg: string) => { setError(msg); setShake(true); setPin(''); setLoading(false); setTimeout(() => setShake(false), 500); };

  if (!mounted || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-4">
        <div className="text-center p-8 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 max-w-sm w-full">
          <Image src="/kardex.png" alt="Kardex" width={140} height={56} className="mx-auto mb-6 brightness-0 invert" priority />
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094] animate-spin" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-2 rounded-full bg-[#1a1a2e]"></div>
            <Shield className="absolute inset-0 m-auto h-6 w-6 text-[#E17F70]" />
          </div>
          <p className="text-white/60 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] p-4 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#E17F70]/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#CE9F6B]/15 rounded-full blur-3xl"></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E17F70]/50 to-transparent"></div>
      </div>

      <div className={`relative bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden max-w-sm w-full transition-all ${shake ? 'animate-shake' : ''}`}>
        <div className="h-1 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094]"></div>

        <div className="pt-6 pb-4 px-6 text-center">
          <Image src="/kardex.png" alt="Kardex" width={120} height={48} className="mx-auto mb-4 brightness-0 invert" priority />
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] flex items-center justify-center shadow-lg shadow-[#E17F70]/30">
            <Fingerprint className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">PIN Access</h2>
          <p className="text-white/50 text-xs">Enter your 6-digit PIN</p>
        </div>

        <div className="px-6 pb-6 relative">
          {success && (
            <div className="absolute inset-0 bg-[#1a1a2e]/95 flex items-center justify-center z-20 rounded-b-3xl">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center animate-bounce">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <p className="text-white font-semibold">Access Granted!</p>
              </div>
            </div>
          )}

          {loading && !success && (
            <div className="absolute inset-0 bg-[#1a1a2e]/90 flex items-center justify-center z-20 rounded-b-3xl">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 relative">
                  <div className="absolute inset-0 rounded-full border-3 border-[#E17F70]/20"></div>
                  <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#E17F70] animate-spin"></div>
                </div>
                <p className="text-white/70 text-sm">Verifying...</p>
              </div>
            </div>
          )}

          {/* PIN Display */}
          <div className="flex justify-center gap-2 mb-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`w-10 h-12 rounded-lg flex items-center justify-center transition-all ${
                isLocked ? 'bg-[#9E3B47]/20 border border-[#9E3B47]/40'
                : pin.length > i ? 'bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] scale-105'
                : pin.length === i ? 'bg-white/10 border border-[#E17F70] animate-pulse'
                : 'bg-white/5 border border-white/20'
              }`}>
                {pin.length > i ? <div className="w-2.5 h-2.5 rounded-full bg-white"></div> : <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>}
              </div>
            ))}
          </div>

          {error && <Alert className="mb-3 bg-[#9E3B47]/20 border-[#9E3B47]/40 text-[#E17F70] rounded-lg py-2"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

          {isLocked && (
            <div className="mb-3 p-3 rounded-lg bg-[#9E3B47]/20 border border-[#9E3B47]/40 text-center">
              <div className="flex items-center justify-center gap-2 text-[#E17F70] mb-1"><Lock className="h-4 w-4" /><span className="font-semibold text-sm">Locked</span></div>
              {lockoutCountdown && <span className="text-2xl font-mono font-bold text-[#E17F70]">{lockoutCountdown}</span>}
            </div>
          )}

          {!isLocked && attemptsLeft < 5 && attemptsLeft > 0 && (
            <div className="mb-3 text-center">
              <span className="text-xs text-[#CE9F6B]"><AlertCircle className="h-3 w-3 inline mr-1" />{attemptsLeft} attempts left</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            {keypadRows.flat().map((key, i) => (
              <button key={i} disabled={loading || success || isLocked || key === ''} onClick={() => key && handleKeyPress(key)}
                className={`h-12 rounded-lg font-bold text-xl transition-all ${
                  key === '' ? 'invisible'
                  : key === 'delete' ? `bg-white/5 text-white/50 hover:bg-[#9E3B47]/30 hover:text-[#E17F70] active:scale-95 ${activeKey === key ? 'bg-[#9E3B47]/30 scale-95' : ''}`
                  : `bg-white/10 text-white hover:bg-[#E17F70]/20 active:scale-95 ${activeKey === key ? 'bg-[#E17F70]/30 scale-95' : ''}`
                } ${(loading || success || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {key === 'delete' ? <Delete className="h-5 w-5 mx-auto" /> : key}
              </button>
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={pin.length !== 6 || loading || success || isLocked}
            className={`w-full h-11 mt-4 font-bold rounded-lg transition-all ${
              pin.length === 6 && !loading && !success && !isLocked
                ? 'bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] text-white shadow-lg shadow-[#E17F70]/30 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {success ? <><CheckCircle className="h-4 w-4 mr-2" />Granted</>
            : loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying</>
            : isLocked ? <><Lock className="h-4 w-4 mr-2" />Locked</>
            : pin.length === 6 ? <><Key className="h-4 w-4 mr-2" />Continue</>
            : `${6 - pin.length} more`}
          </Button>
        </div>

        <div className="px-6 py-3 bg-white/5 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 text-xs text-white/40">
            <Shield className="h-3 w-3 text-[#82A094]" />
            <span>Enterprise-grade security</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); } 20%, 40%, 60%, 80% { transform: translateX(6px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
