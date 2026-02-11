'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleBasedRedirect } from '@/lib/utils/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, CheckCircle2, Mail, Lock, Shield, Eye, EyeOff, ArrowRight, Sparkles, ArrowLeft, Zap, Globe, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false).optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const moduleParam = searchParams.get('module');
  const moduleLabels: Record<string, string> = {
    fsm: 'Field Service Management',
    finance: 'Finance'
  };

  const getModuleBasedRedirect = (): string => {
    const selectedModule = moduleParam || localStorage.getItem('selectedModule');
    if (selectedModule === 'finance') return '/finance/select';
    if (selectedModule === 'fsm') return '/fsm/select';
    
    // Fall back to role-based redirection which respects module access
    return getRoleBasedRedirect(user?.role, user?.financeRole);
  };

  useEffect(() => {
    // Only redirect automatically if we didn't just perform a manual login 
    // and we are already authenticated. Manual login success is handled in onSubmit.
    if (isAuthenticated && user && !isLoading && !loginSuccess) {
      router.replace(getModuleBasedRedirect());
    }
  }, [isAuthenticated, user, isLoading, router, moduleParam, loginSuccess]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  useEffect(() => {
    const sessionExpired = sessionStorage.getItem('sessionExpired');
    if (sessionExpired === 'true') {
      toast({
        title: "Session Expired",
        description: 'Your session has expired. Please login again.',
        variant: "destructive",
        duration: 5000,
      });
      sessionStorage.removeItem('sessionExpired');
      sessionStorage.removeItem('sessionExpiredReason');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const savedEmail = localStorage.getItem('rememberedEmail');
      const savedPassword = localStorage.getItem('rememberedPassword');
      const wasRemembered = localStorage.getItem('wasRemembered') === 'true';
      if (savedEmail && savedPassword && wasRemembered) {
        form.reset({ email: savedEmail, password: savedPassword, rememberMe: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [form]);

  const onSubmit = async (values: LoginFormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await login(values.email, values.password, values.rememberMe);
      if (result.success && result.user) {
        if (values.rememberMe) {
          localStorage.setItem('rememberedEmail', values.email);
          localStorage.setItem('rememberedPassword', values.password);
          localStorage.setItem('wasRemembered', 'true');
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('wasRemembered');
        }
        
        // Mark login as successful
        setLoginSuccess(true);
        
        // Determine redirect path based on returned user (not React state which may have stale data)
        const loggedInUser = result.user;
        const selectedModule = moduleParam || localStorage.getItem('selectedModule');
        
        let redirectPath: string;
        if (selectedModule === 'finance') {
          redirectPath = '/finance/select';
        } else if (selectedModule === 'fsm') {
          redirectPath = '/fsm/select';
        } else {
          // Use the returned user's role for redirect
          redirectPath = getRoleBasedRedirect(loggedInUser.role, loggedInUser.financeRole);
        }
        
        // Quick delay to show the success animation, then redirect
        setTimeout(() => {
          router.replace(redirectPath);
        }, 500);
      } else {
        triggerError(result.error || "Invalid credentials");
      }
    } catch (error: any) {
      triggerError(error?.response?.data?.message || "Failed to log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerError = (message: string) => {
    setShake(true);
    toast({ title: "Login failed", description: message, variant: "destructive" });
    setTimeout(() => setShake(false), 500);
  };

  if (!mounted) return null;

  // Only show the full-page preparing dashboard if we are already authenticated 
  // and NOT in the middle of a successful login sequence (which has its own overlay)
  if (isAuthenticated && user && !isLoading && !loginSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a1a] via-[#0f1629] to-[#0a1628] p-4 overflow-hidden">
        {/* Animated Background Effects */}
        <div className="absolute inset-0">
          {/* Floating Gradient Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#E17F70]/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '3s' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#CE9F6B]/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#82A094]/10 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.5s' }}></div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(225,127,112,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(225,127,112,0.02)_1px,transparent_1px)] bg-[size:80px_80px]"></div>
          
          {/* Floating Particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-float"
              style={{
                width: Math.random() * 6 + 2,
                height: Math.random() * 6 + 2,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                background: i % 3 === 0 ? '#E17F70' : i % 3 === 1 ? '#CE9F6B' : '#82A094',
                opacity: Math.random() * 0.5 + 0.2,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${Math.random() * 15 + 10}s`
              }}
            />
          ))}
        </div>

        {/* Main Card */}
        <div className="relative">
          {/* Outer Glow Ring */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094] rounded-[2rem] opacity-30 blur-xl animate-pulse" style={{ animationDuration: '2s' }}></div>
          
          <div className="relative text-center p-12 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden min-w-[380px]">
            {/* Top Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E17F70] to-transparent"></div>
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
            
            {/* Corner Decorations */}
            <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-[#E17F70]/20 to-transparent rounded-full blur-2xl"></div>
            <div className="absolute bottom-4 left-4 w-20 h-20 bg-gradient-to-br from-[#82A094]/20 to-transparent rounded-full blur-2xl"></div>

            {/* Logo */}
            <div className="mb-10 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E17F70]/20 via-transparent to-[#82A094]/20 blur-xl rounded-full"></div>
              <Image src="/kardex.png" alt="Kardex" width={200} height={80} className="mx-auto brightness-0 invert relative z-10" priority />
            </div>
            
            {/* Animated Success Icon */}
            <div className="w-28 h-28 mx-auto mb-8 relative">
              {/* Outer Pulsing Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-[#E17F70]/30 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute -inset-4 rounded-full border border-[#CE9F6B]/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
              
              {/* Gradient Ring */}
              <div className="absolute inset-0 rounded-full p-1 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094]">
                <div className="w-full h-full rounded-full bg-[#0f1629]"></div>
              </div>
              
              {/* Spinning Gradient Overlay */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-conic from-[#E17F70] via-[#CE9F6B] via-[#82A094] to-[#E17F70] animate-spin opacity-40" style={{ animationDuration: '3s' }}></div>
              </div>
              
              {/* Inner Circle with Icon */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#0f1629] to-[#1a2438] flex items-center justify-center shadow-inner">
                <div className="relative">
                  <CheckCircle2 className="h-12 w-12 text-[#82A094] animate-bounce" style={{ animationDuration: '2s' }} />
                  <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-[#E17F70] animate-pulse" />
                </div>
              </div>
            </div>
            
            {/* Welcome Text */}
            <div className="space-y-3 mb-8">
              <h3 className="text-4xl font-bold bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                Welcome Back!
              </h3>
              <p className="text-lg text-white/60">
                Hello, <span className="text-[#E17F70] font-semibold">{user?.name || user?.email?.split('@')[0]}</span>
              </p>
            </div>
            
            {/* Loading Indicator */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#E17F70] to-[#CE9F6B] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-white/40 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#CE9F6B]" />
                Preparing your dashboard...
              </p>
            </div>
            
            {/* Bottom Security Badge */}
            <div className="mt-10 pt-6 border-t border-white/10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#82A094]/10 border border-[#82A094]/20">
                <Shield className="h-4 w-4 text-[#82A094]" />
                <span className="text-xs text-white/50">Secure Session Active</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional CSS for animations */}
        <style jsx global>{`
          @keyframes float {
            0%, 100% { transform: translateY(0) translateX(0); }
            25% { transform: translateY(-20px) translateX(10px); }
            50% { transform: translateY(-10px) translateX(-5px); }
            75% { transform: translateY(-25px) translateX(5px); }
          }
          .animate-float { animation: float 15s ease-in-out infinite; }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
          .bg-gradient-conic {
            background: conic-gradient(from 0deg, var(--tw-gradient-stops));
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] overflow-hidden">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E17F70]/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#CE9F6B]/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#82A094]/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(225,127,112,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(225,127,112,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
          
          {/* Floating Orbs */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-float"
              style={{
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                background: i % 3 === 0 ? '#E17F70' : i % 3 === 1 ? '#CE9F6B' : '#82A094',
                opacity: 0.6,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${Math.random() * 10 + 10}s`
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-lg">
          <div className="mb-12">
            <Image src="/kardex.png" alt="Kardex" width={220} height={88} className="brightness-0 invert drop-shadow-2xl" priority />
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Welcome to <br />
            <span className="bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094] bg-clip-text text-transparent">
              Service Management
            </span>
          </h1>
          
          <p className="text-xl text-white/60 mb-12 leading-relaxed">
            Manage service tickets, track offers, and streamline your finance operations.
          </p>

          {/* Feature Cards */}
          <div className="space-y-4">
            {[
              { icon: Zap, title: 'Field Service', desc: 'Tickets, customers & service zones', color: '#E17F70' },
              { icon: Shield, title: 'Finance Module', desc: 'AR, vendor bank accounts & invoices', color: '#CE9F6B' },
              { icon: Users, title: 'Offers & Targets', desc: 'Track sales funnel & forecasts', color: '#82A094' },
            ].map((feature, i) => (
              <div 
                key={i}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{feature.title}</h3>
                  <p className="text-white/50 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile Background Gradient */}
        <div className="absolute inset-0 lg:hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#E17F70]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#CE9F6B]/20 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Image src="/kardex.png" alt="Kardex" width={160} height={64} className="mx-auto brightness-0 invert" priority />
          </div>

          {/* Back Button */}
          {moduleParam && (
            <button
              onClick={() => router.push('/module-select')}
              className="group flex items-center gap-2 text-white/60 hover:text-[#E17F70] mb-6 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#E17F70]/50 group-hover:bg-[#E17F70]/10 transition-all">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="font-medium">Back to Modules</span>
            </button>
          )}

          {/* Login Card */}
          <div className={`relative bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden transition-all duration-500 ${shake ? 'animate-shake' : ''}`}>
            {/* Top Gradient Bar */}
            <div className="h-1 bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#82A094]"></div>
            
            {/* Glow Effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#E17F70]/30 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#CE9F6B]/30 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header */}
            <div className="pt-10 pb-6 px-8 text-center relative">
              {moduleParam && moduleLabels[moduleParam] && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 bg-gradient-to-r from-[#E17F70]/20 to-[#CE9F6B]/20 border border-[#E17F70]/30">
                  <Sparkles className="w-4 h-4 text-[#E17F70]" />
                  <span className="text-sm font-semibold text-[#E17F70]">{moduleLabels[moduleParam]}</span>
                </div>
              )}
              
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] shadow-xl shadow-[#E17F70]/30">
                <Lock className="h-8 w-8 text-white" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Sign In</h2>
              <p className="text-white/50 text-sm">Enter your credentials to continue</p>
            </div>

            {/* Form */}
            <div className="px-8 pb-8 relative">
              {/* Success Overlay */}
              {loginSuccess && (
                <div className="absolute inset-0 bg-[#1a1a2e]/95 backdrop-blur-md flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#82A094] to-[#4F6A64] flex items-center justify-center shadow-xl animate-bounce">
                      <CheckCircle2 className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Success!</h3>
                    <p className="text-[#82A094]">Redirecting...</p>
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {(isLoading || isSubmitting) && !loginSuccess && (
                <div className="absolute inset-0 bg-[#1a1a2e]/90 backdrop-blur-md flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-5">
                      <div className="absolute inset-0 rounded-full border-4 border-[#E17F70]/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#E17F70] animate-spin"></div>
                    </div>
                    <p className="text-white/80">{isSubmitting ? "Authenticating..." : "Loading..."}</p>
                  </div>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm font-medium">Email Address</FormLabel>
                        <FormControl>
                          <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
                            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors ${focusedField === 'email' ? 'text-[#E17F70]' : 'text-white/40'}`} />
                            <Input
                              {...field}
                              placeholder="you@example.com"
                              type="email"
                              className={`h-14 pl-12 pr-4 rounded-xl bg-white/5 border-2 text-white placeholder:text-white/30 transition-all duration-300 ${
                                focusedField === 'email'
                                  ? 'border-[#E17F70] bg-white/10 shadow-lg shadow-[#E17F70]/20'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                              disabled={isLoading || isSubmitting}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => { field.onBlur(); setFocusedField(null); }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[#E17F70] text-xs mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm font-medium">Password</FormLabel>
                        <FormControl>
                          <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                            <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors ${focusedField === 'password' ? 'text-[#E17F70]' : 'text-white/40'}`} />
                            <Input
                              {...field}
                              placeholder="••••••••"
                              type={showPassword ? "text" : "password"}
                              className={`h-14 pl-12 pr-12 rounded-xl bg-white/5 border-2 text-white placeholder:text-white/30 transition-all duration-300 ${
                                focusedField === 'password'
                                  ? 'border-[#E17F70] bg-white/10 shadow-lg shadow-[#E17F70]/20'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                              disabled={isLoading || isSubmitting}
                              onFocus={() => setFocusedField('password')}
                              onBlur={() => { field.onBlur(); setFocusedField(null); }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#E17F70] transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[#E17F70] text-xs mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <button
                            type="button"
                            onClick={() => field.onChange(!field.value)}
                            disabled={isLoading || isSubmitting}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                              field.value
                                ? 'bg-gradient-to-br from-[#E17F70] to-[#CE9F6B] border-transparent'
                                : 'border-white/30 hover:border-[#E17F70]'
                            }`}
                          >
                            {field.value && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </FormControl>
                        <FormLabel className="text-white/50 text-sm font-normal cursor-pointer">Keep me signed in</FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={isLoading || isSubmitting || loginSuccess}
                    className="w-full h-14 mt-4 font-bold text-lg rounded-xl bg-gradient-to-r from-[#E17F70] via-[#CE9F6B] to-[#E17F70] bg-[length:200%_100%] hover:bg-right text-white shadow-xl shadow-[#E17F70]/30 hover:shadow-2xl hover:shadow-[#E17F70]/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500"
                  >
                    {loginSuccess ? (
                      <span className="flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5" /> Welcome!</span>
                    ) : isLoading || isSubmitting ? (
                      <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Signing In...</span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">Sign In <ArrowRight className="h-5 w-5" /></span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-white/5 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                <Shield className="h-4 w-4 text-[#82A094]" />
                <span>Protected by enterprise-grade security</span>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center mt-8">
            <p className="text-white/30 text-xs">© {new Date().getFullYear()} Kardex Remstar. All rights reserved.</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-5px); }
          75% { transform: translateY(-25px) translateX(5px); }
        }
        .animate-float { animation: float 15s ease-in-out infinite; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
      `}</style>
    </div>
  );
}
