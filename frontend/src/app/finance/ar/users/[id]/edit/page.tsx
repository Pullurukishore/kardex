'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  Shield, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Crown,
  Eye as ViewIcon,
  X,
  ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { toast } from 'sonner';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  getFinanceUser, 
  updateFinanceUser,
  getFinanceRoleDisplayName,
  type FinanceUser,
  type FinanceRoleType
} from '@/services/financeUser.service';

const updateFinanceUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
  financeRole: z.enum(['FINANCE_ADMIN', 'FINANCE_USER', 'FINANCE_VIEWER', 'FINANCE_APPROVER']),
  isActive: z.boolean(),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UpdateFinanceUserForm = z.infer<typeof updateFinanceUserSchema>;

const financeRoles: { value: FinanceRoleType; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'FINANCE_ADMIN', 
    label: 'Finance Admin', 
    description: 'Full access to all finance features',
    icon: <Crown className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_USER', 
    label: 'Finance User', 
    description: 'Can view and edit finance data',
    icon: <User className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_VIEWER', 
    label: 'Finance Viewer', 
    description: 'Read-only access',
    icon: <ViewIcon className="h-5 w-5" />
  },
  { 
    value: 'FINANCE_APPROVER', 
    label: 'Finance Approver', 
    description: 'Can only review and approve payment batches',
    icon: <ClipboardCheck className="h-5 w-5" />
  },
];

export default function EditFinanceUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = parseInt(params.id as string);
  
  const [financeUser, setFinanceUser] = useState<FinanceUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<FinanceRoleType>('FINANCE_USER');

  const form = useForm<UpdateFinanceUserForm>({
    resolver: zodResolver(updateFinanceUserSchema),
    defaultValues: {
      email: '',
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      financeRole: 'FINANCE_USER',
      isActive: true,
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const data = await getFinanceUser(userId);
        setFinanceUser(data);
        setSelectedRole(data.financeRole);
        
        form.reset({
          email: data.email || '',
          name: data.name || '',
          phone: data.phone || '',
          password: '',
          confirmPassword: '',
          financeRole: data.financeRole,
          isActive: data.isActive,
        });
      } catch (error) {
        toast.error('Failed to load finance user');
        setFinanceUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId, form]);

  const handleRoleSelect = (role: FinanceRoleType) => {
    setSelectedRole(role);
    form.setValue('financeRole', role, { shouldValidate: true });
  };

  const onSubmit = async (data: UpdateFinanceUserForm) => {
    try {
      setLoading(true);
      
      const loadingToastId = toast.loading('Updating finance user...');
      
      try {
        await updateFinanceUser(userId, {
          email: data.email,
          name: data.name,
          phone: data.phone || undefined,
          password: data.password && data.password.length > 0 ? data.password : undefined,
          financeRole: data.financeRole,
          isActive: data.isActive,
        });
        
        toast.dismiss(loadingToastId);
        toast.success('Finance user updated successfully! Redirecting...');
        
        router.refresh();
        setTimeout(() => {
          router.push('/finance/ar/users');
        }, 1000);
      } catch (apiError) {
        toast.dismiss(loadingToastId);
        throw apiError;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update finance user');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#CE9F6B]"></div>
      </div>
    );
  }

  if (!financeUser) {
    return (
      <div>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-[#976E44]">Finance user not found</h2>
          <p className="text-[#5D6E73] mt-2">The requested finance user could not be loaded.</p>
          <Button 
            className="mt-4 bg-gradient-to-r from-[#976E44] to-[#CE9F6B]" 
            onClick={() => router.push('/finance/ar/users')}
          >
            Back to Finance Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-6 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/finance/ar/users')}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance Users
            </Button>
            <Badge 
              variant={financeUser.isActive ? 'default' : 'secondary'}
              className={financeUser.isActive 
                ? 'bg-white/20 text-white hover:bg-white/30' 
                : 'bg-gray-500/20 text-white/70 hover:bg-gray-500/30'
              }
            >
              {financeUser.isActive ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Inactive
                </>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
              {(financeUser.name || financeUser.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Edit Finance User</h1>
              <p className="text-white/80 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {financeUser.name || financeUser.email} - Finance Management
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/finance/ar/users')}
            className="text-[#5D6E73] hover:text-[#976E44]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Badge 
            variant={financeUser.isActive ? 'default' : 'secondary'}
            className={financeUser.isActive 
              ? 'bg-[#A2B9AF]/20 text-[#4F6A64]' 
              : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
            }
          >
            {financeUser.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <MobilePageHeader
          title="Edit Finance User"
          description={`${financeUser.name || financeUser.email}`}
        />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* User Profile Edit Card */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-[#CE9F6B]/5 to-[#E17F70]/5">
            <CardHeader className="bg-gradient-to-r from-[#CE9F6B]/10 to-[#E17F70]/10 rounded-t-lg border-b border-[#CE9F6B]/20">
              <CardTitle className="text-[#976E44] flex items-center gap-2">
                <User className="h-5 w-5" />
                User Profile
              </CardTitle>
              <CardDescription>
                Update the finance user's profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#976E44]" />
                      Email Address *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        {...field}
                        className="focus:ring-2 focus:ring-[#CE9F6B] border-[#CE9F6B]/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name and Phone Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[#976E44]" />
                        Full Name *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter full name"
                          {...field}
                          className="focus:ring-2 focus:ring-[#CE9F6B] border-[#CE9F6B]/30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[#976E44]" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="Enter phone number"
                          {...field}
                          className="focus:ring-2 focus:ring-[#CE9F6B] border-[#CE9F6B]/30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#E17F70]" />
                        New Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Leave blank to keep current password"
                            {...field}
                            className="focus:ring-2 focus:ring-[#CE9F6B] pr-12 border-[#CE9F6B]/30"
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
                      </FormControl>
                      <FormDescription className="text-xs text-[#5D6E73]">
                        Leave blank to keep the current password
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#E17F70]" />
                        Confirm New Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm new password"
                            {...field}
                            className="focus:ring-2 focus:ring-[#CE9F6B] pr-12 border-[#CE9F6B]/30"
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status Toggle */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-[#CE9F6B]/20">
                    <div className="h-10 w-10 rounded-full bg-[#CE9F6B]/20 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-[#976E44]" />
                    </div>
                    <div className="flex-1">
                      <FormLabel className="text-sm font-medium text-[#976E44]">Account Status</FormLabel>
                      <FormDescription className="text-xs text-[#5D6E73]">
                        {field.value ? 'User can access the finance module' : 'User is disabled'}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-[#82A094]"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Role Selection Card */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-[#E17F70]/5 to-[#CE9F6B]/5">
            <CardHeader className="bg-gradient-to-r from-[#E17F70]/10 to-[#CE9F6B]/10 rounded-t-lg border-b border-[#E17F70]/20">
              <CardTitle className="text-[#9E3B47] flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Finance Role
              </CardTitle>
              <CardDescription>
                Change the role and permissions for this user
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <FormField
                control={form.control}
                name="financeRole"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {financeRoles.map((role) => (
                        <div
                          key={role.value}
                          onClick={() => handleRoleSelect(role.value)}
                          className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedRole === role.value
                              ? 'border-[#E17F70] bg-[#E17F70]/10 shadow-sm ring-2 ring-[#E17F70]/30'
                              : 'border-[#CE9F6B]/30 bg-white hover:border-[#CE9F6B]'
                          }`}
                        >
                          <div className="flex flex-col items-center text-center gap-2">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                              selectedRole === role.value
                                ? 'bg-gradient-to-r from-[#9E3B47] to-[#E17F70] text-white'
                                : 'bg-[#CE9F6B]/20 text-[#976E44]'
                            }`}>
                              {role.icon}
                            </div>
                            <div>
                              <h4 className="font-semibold text-[#976E44] text-sm">{role.label}</h4>
                              <p className="text-xs text-[#5D6E73] mt-1">{role.description}</p>
                            </div>
                          </div>
                          
                          {selectedRole === role.value && (
                            <div className="absolute top-2 right-2">
                              <div className="h-5 w-5 rounded-full bg-[#E17F70] flex items-center justify-center">
                                <CheckCircle className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#CE9F6B]/20">
            <div className="flex items-center gap-2 text-sm text-[#5D6E73]">
              <Crown className="h-4 w-4 text-[#976E44]" />
              <span>
                Role: {getFinanceRoleDisplayName(selectedRole)}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Link href="/finance/ar/users">
                <Button 
                  type="button" 
                  variant="outline"
                  className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B] shadow-lg min-w-[120px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
