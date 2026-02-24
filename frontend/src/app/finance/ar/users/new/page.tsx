'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  CheckCircle, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  UserPlus, 
  Eye, 
  EyeOff,
  Sparkles,
  Users,
  Crown,
  Eye as ViewIcon,
  ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MobileContainer, MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  createFinanceUser, 
  getFinanceRoleDisplayName,
  type FinanceRoleType 
} from '@/services/financeUser.service';

const createFinanceUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  financeRole: z.enum(['FINANCE_ADMIN', 'FINANCE_USER', 'FINANCE_VIEWER', 'FINANCE_APPROVER']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateFinanceUserForm = z.infer<typeof createFinanceUserSchema>;

const financeRoles: { value: FinanceRoleType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'FINANCE_ADMIN', 
    label: 'Finance Admin', 
    description: 'Full access to all finance features including user management',
    icon: <Crown className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_USER', 
    label: 'Finance User', 
    description: 'Can view and edit invoices, customers, and reports',
    icon: <User className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_VIEWER', 
    label: 'Finance Viewer', 
    description: 'Read-only access to finance data and reports',
    icon: <ViewIcon className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_APPROVER', 
    label: 'Finance Approver', 
    description: 'Can only review and approve payment batches',
    icon: <ClipboardCheck className="h-5 w-5" />
  },
];

export default function NewFinanceUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<FinanceRoleType>('FINANCE_USER');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateFinanceUserForm>({
    resolver: zodResolver(createFinanceUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      financeRole: 'FINANCE_USER',
    },
  });

  const handleRoleSelect = (role: FinanceRoleType) => {
    setSelectedRole(role);
    setValue('financeRole', role, { shouldValidate: true });
  };

  const onSubmit = async (data: CreateFinanceUserForm) => {
    try {
      setLoading(true);

      await createFinanceUser({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        financeRole: data.financeRole,
      });

      toast.success('Finance user created successfully');
      setCreated(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create finance user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (created) {
      const timeoutId = setTimeout(() => {
        router.push('/finance/ar/users');
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [created, router]);

  const handleImmediateRedirect = () => {
    router.push('/finance/ar/users');
  };

  if (created) {
    return (
      <MobileContainer>
        <div className="max-w-lg mx-auto py-12">
          <Card className="text-center shadow-2xl border-0 bg-gradient-to-br from-[#CE9F6B]/10 to-[#E17F70]/20">
            <CardHeader className="pb-4">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-[#976E44] to-[#CE9F6B] flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[#E17F70] flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-[#976E44]">Finance User Created Successfully!</CardTitle>
              <CardDescription className="text-[#5D6E73] mt-2">
                The new finance user has been added to the system and will be redirected automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button 
                  onClick={handleImmediateRedirect}
                  className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B] shadow-lg"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Go to Finance Users
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-8 text-white mb-8 shadow-2xl">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <Link href="/finance/ar/users">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-white hover:bg-white/20 hover:text-white border border-white/30"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Finance Users
              </Button>
            </Link>
            <Badge className="bg-white/20 text-white hover:bg-white/30 border-white/30">
              <UserPlus className="mr-1 h-3 w-3" />
              New Finance User
            </Badge>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
              <Shield className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2">Create New Finance User</h1>
              <p className="text-white/80 flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Add a new user to the finance module
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/finance/ar/users">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[#5D6E73] hover:text-[#976E44]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <Badge className="bg-[#CE9F6B]/20 text-[#976E44]">
            <UserPlus className="mr-1 h-3 w-3" />
            New
          </Badge>
        </div>
        <MobilePageHeader
          title="Create Finance User"
          description="Add a new user to the finance module"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* User Profile Card */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-[#CE9F6B]/5 to-[#E17F70]/5 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#CE9F6B]/10 to-[#E17F70]/10 border-b border-[#CE9F6B]/20">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#976E44] to-[#CE9F6B] flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-[#976E44]">User Profile</CardTitle>
                <CardDescription className="text-[#5D6E73]">
                  Enter the basic profile details for the new finance user
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {/* Name and Email Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <User className="h-4 w-4 text-[#976E44]" />
                  Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter user's full name"
                  {...register('name')}
                  className={`h-12 text-base transition-all duration-200 ${
                    errors.name 
                      ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50' 
                      : 'border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20'
                  }`}
                />
                {errors.name && (
                  <p className="text-sm text-[#9E3B47] flex items-center gap-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Mail className="h-4 w-4 text-[#976E44]" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  {...register('email')}
                  className={`h-12 text-base transition-all duration-200 ${
                    errors.email 
                      ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50' 
                      : 'border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20'
                  }`}
                />
                {errors.email && (
                  <p className="text-sm text-[#9E3B47] flex items-center gap-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-3">
              <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                <Phone className="h-4 w-4 text-[#976E44]" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number (optional)"
                {...register('phone')}
                className="h-12 text-base border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20"
              />
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Shield className="h-4 w-4 text-[#E17F70]" />
                  Password *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter a strong password"
                    {...register('password')}
                    className={`h-12 text-base pr-12 transition-all duration-200 ${
                      errors.password 
                        ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50' 
                        : 'border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20'
                    }`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#CE9F6B]/20"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-[#5D6E73]">
                  Password must be at least 6 characters long
                </p>
                {errors.password && (
                  <p className="text-sm text-[#9E3B47]">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-semibold text-[#5D6E73]">
                  <Shield className="h-4 w-4 text-[#E17F70]" />
                  Confirm Password *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm the password"
                    {...register('confirmPassword')}
                    className={`h-12 text-base pr-12 transition-all duration-200 ${
                      errors.confirmPassword 
                        ? 'border-[#9E3B47] focus:border-[#9E3B47] focus:ring-[#E17F70]/50' 
                        : 'border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20'
                    }`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-[#CE9F6B]/20"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-[#9E3B47]">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role Selection Card */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-[#E17F70]/5 to-[#CE9F6B]/5 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#E17F70]/10 to-[#CE9F6B]/10 border-b border-[#E17F70]/20">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-[#9E3B47] to-[#E17F70] flex items-center justify-center shadow-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-[#9E3B47]">Finance Role</CardTitle>
                <CardDescription className="text-[#5D6E73]">
                  Select the role and permissions for this user
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {financeRoles.map((role) => (
                <div
                  key={role.value}
                  onClick={() => handleRoleSelect(role.value)}
                  className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    selectedRole === role.value
                      ? 'border-[#E17F70] bg-[#E17F70]/10 shadow-md ring-2 ring-[#E17F70]/30'
                      : 'border-[#CE9F6B]/30 bg-white hover:border-[#CE9F6B] hover:bg-[#CE9F6B]/5'
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                      selectedRole === role.value
                        ? 'bg-gradient-to-r from-[#9E3B47] to-[#E17F70] text-white'
                        : 'bg-[#CE9F6B]/20 text-[#976E44]'
                    }`}>
                      {role.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#976E44]">{role.label}</h4>
                      <p className="text-xs text-[#5D6E73] mt-1">{role.description}</p>
                    </div>
                  </div>
                  
                  {selectedRole === role.value && (
                    <div className="absolute top-3 right-3">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-r from-[#9E3B47] to-[#E17F70] flex items-center justify-center shadow-lg">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {errors.financeRole && (
              <p className="text-sm text-[#9E3B47] mt-4">
                {errors.financeRole.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-[#CE9F6B]/20">
          <div className="flex items-center gap-3 text-sm text-[#5D6E73]">
            <div className="h-8 w-8 rounded-lg bg-[#CE9F6B]/20 flex items-center justify-center">
              <Crown className="h-4 w-4 text-[#976E44]" />
            </div>
            <span className="font-medium">
              Role: {getFinanceRoleDisplayName(selectedRole)}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/finance/ar/users">
              <Button 
                type="button" 
                variant="outline"
                className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10 h-12 px-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B] shadow-lg h-12 px-8 min-w-[180px]"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Finance User
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </MobileContainer>
  );
}
