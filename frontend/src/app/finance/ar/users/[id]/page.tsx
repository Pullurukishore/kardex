'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Mail, 
  Shield, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  Activity, 
  Settings,
  Crown,
  Eye as ViewIcon,
  ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  getFinanceUser, 
  deleteFinanceUser,
  getFinanceRoleDisplayName,
  getFinanceRoleBadgeColor,
  type FinanceUser,
  type FinanceRoleType
} from '@/services/financeUser.service';

export default function FinanceUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [financeUser, setFinanceUser] = useState<FinanceUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const userId = parseInt(params.id as string);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const data = await getFinanceUser(userId);
        setFinanceUser(data);
      } catch (error) {
        toast.error('Failed to fetch finance user details');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const handleDelete = async () => {
    try {
      await deleteFinanceUser(userId);
      toast.success('Finance user deleted successfully');
      router.push('/finance/ar/users');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete finance user');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const getRoleIcon = (role: FinanceRoleType) => {
    switch (role) {
      case 'FINANCE_ADMIN':
        return <Crown className="h-5 w-5" />;
      case 'FINANCE_USER':
        return <User className="h-5 w-5" />;
      case 'FINANCE_VIEWER':
        return <ViewIcon className="h-5 w-5" />;
      case 'FINANCE_APPROVER':
        return <ClipboardCheck className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-[#AEBFC3]/30" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#CE9F6B] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <User className="absolute inset-0 m-auto w-6 h-6 text-[#976E44]" />
            </div>
            <p className="text-[#5D6E73] font-medium">Loading finance user details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!financeUser) {
    return (
      <div>
        <div className="text-center py-16">
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#E17F70]/20 to-[#9E3B47]/10 flex items-center justify-center mx-auto mb-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E17F70] via-[#9E3B47] to-[#75242D]" />
            <User className="w-12 h-12 text-[#E17F70]" />
          </div>
          <h1 className="text-2xl font-bold text-[#976E44] mb-2">Finance User Not Found</h1>
          <p className="text-[#5D6E73] mb-6">The requested finance user could not be found.</p>
          <Link href="/finance/ar/users" className="inline-block">
            <Button className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:shadow-lg hover:shadow-[#CE9F6B]/20 hover:-translate-y-0.5 active:scale-95 font-bold transition-all">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance Users
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-gradient-to-br from-[#CE9F6B]/10 to-[#976E44]/10 rounded-full blur-[8rem] opacity-50" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] bg-gradient-to-br from-[#82A094]/10 to-[#4F6A64]/10 rounded-full blur-[6rem] opacity-50" />
      </div>

      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-6 text-white shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#E17F70]" />
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 shadow-xl">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{financeUser.name || financeUser.email}</h1>
              <p className="text-white/80 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {financeUser.email}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Badge 
                  variant={financeUser.isActive ? 'default' : 'secondary'}
                  className={`border-2 font-bold ${financeUser.isActive 
                    ? 'bg-white/20 text-white border-white/30' 
                    : 'bg-gray-500/20 text-white/70 border-gray-400/30'
                  }`}
                >
                  {financeUser.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Badge 
                  variant="outline"
                  className="bg-white/10 text-white border-2 border-white/30 flex items-center gap-1 font-bold"
                >
                  {getRoleIcon(financeUser.financeRole)}
                  {getFinanceRoleDisplayName(financeUser.financeRole)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/finance/ar/users">
              <Button variant="outline" className="bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 hover:scale-105 transition-all font-bold">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Link href={`/finance/ar/users/${userId}/edit`}>
              <Button className="bg-white text-[#976E44] hover:bg-white/90 hover:scale-105 shadow-lg font-bold transition-all">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="mb-4">
          <Link href="/finance/ar/users">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Finance Users
            </Button>
          </Link>
        </div>
        <MobilePageHeader
          title={financeUser.name || financeUser.email}
          description={financeUser.name ? financeUser.email : undefined}
          action={
            <Link href={`/finance/ar/users/${userId}/edit`}>
              <Button size="sm" className="bg-[#CE9F6B] hover:bg-[#976E44] text-white">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="relative shadow-xl border-2 border-[#CE9F6B]/30 bg-gradient-to-br from-white to-[#CE9F6B]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70]" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#976E44] to-[#CE9F6B] shadow-lg shadow-[#CE9F6B]/20 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#976E44]" />
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-[#976E44]">Personal Information</CardTitle>
                  <CardDescription>Basic details and contact information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Full Name</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#CE9F6B]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#976E44] to-[#CE9F6B]">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.name || 'Not provided'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Email Address</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#CE9F6B]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#976E44] to-[#CE9F6B]">
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-[#546A7A] break-all">{financeUser.email}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Phone Number</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#CE9F6B]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#976E44] to-[#CE9F6B]">
                      <Phone className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.phone || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="relative shadow-xl border-2 border-[#E17F70]/30 bg-gradient-to-br from-white to-[#E17F70]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#CE9F6B]" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#9E3B47] to-[#E17F70] shadow-lg shadow-[#E17F70]/20 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#9E3B47]" />
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-[#9E3B47]">Account Status & Activity</CardTitle>
                  <CardDescription>Current status and recent activity information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Account Status</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#E17F70]/20 shadow-sm">
                    <div className={`h-3 w-3 rounded-full shadow-lg ${
                      financeUser.isActive ? 'bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-[#82A094]/30' : 'bg-[#979796]'
                    }`}></div>
                    <Badge 
                      variant={financeUser.isActive ? 'default' : 'secondary'}
                      className={`font-bold ${financeUser.isActive 
                        ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/20' 
                        : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
                      }`}
                    >
                      {financeUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Finance Role</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#E17F70]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#E17F70] to-[#9E3B47]">
                      {getRoleIcon(financeUser.financeRole)}
                    </div>
                    <Badge variant="outline" className={getFinanceRoleBadgeColor(financeUser.financeRole)}>
                      {getFinanceRoleDisplayName(financeUser.financeRole)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Last Login</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#E17F70]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#E17F70] to-[#9E3B47]">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.lastLoginAt 
                        ? new Date(financeUser.lastLoginAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#5D6E73] uppercase tracking-wider">Account Created</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#E17F70]/20 shadow-sm">
                    <div className="p-1 rounded bg-gradient-to-br from-[#E17F70] to-[#9E3B47]">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.createdAt 
                        ? new Date(financeUser.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Unknown'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Overview */}
          <Card className="relative shadow-xl border-2 border-[#CE9F6B]/30 bg-gradient-to-br from-white to-[#CE9F6B]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70]" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#976E44] to-[#CE9F6B] shadow-lg shadow-[#CE9F6B]/20 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#CE9F6B] via-white/40 to-[#976E44]" />
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg text-[#976E44]">Quick Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white rounded-xl border-2 border-[#CE9F6B]/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gradient-to-br from-[#976E44] to-[#CE9F6B] rounded-lg flex items-center justify-center shadow-lg shadow-[#CE9F6B]/20">
                      {getRoleIcon(financeUser.financeRole)}
                    </div>
                    <span className="text-sm font-bold text-[#5D6E73]">Role</span>
                  </div>
                  <Badge variant="outline" className={getFinanceRoleBadgeColor(financeUser.financeRole)}>
                    {getFinanceRoleDisplayName(financeUser.financeRole)}
                  </Badge>
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl border-2 border-[#CE9F6B]/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-lg flex items-center justify-center shadow-lg shadow-[#82A094]/20">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-[#5D6E73]">Status</span>
                  </div>
                  <Badge 
                    variant={financeUser.isActive ? 'default' : 'secondary'}
                    className={`font-bold ${financeUser.isActive 
                      ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white shadow-lg shadow-[#82A094]/20' 
                      : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
                    }`}
                  >
                    {financeUser.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="relative shadow-xl border-2 border-[#E17F70]/30 bg-gradient-to-br from-white to-[#E17F70]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#9E3B47] via-[#E17F70] to-[#CE9F6B]" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#9E3B47] to-[#E17F70] shadow-lg shadow-[#E17F70]/20 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E17F70] via-white/40 to-[#9E3B47]" />
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg text-[#9E3B47]">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/finance/ar/users/${userId}/edit`} className="block">
                <Button variant="outline" className="w-full justify-start h-12 bg-white hover:bg-[#CE9F6B]/10 border-2 border-[#CE9F6B]/40 hover:border-[#CE9F6B] hover:scale-[1.02] transition-all">
                  <div className="p-1 rounded bg-gradient-to-br from-[#976E44] to-[#CE9F6B] mr-3">
                    <Pencil className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-[#976E44]">Edit Details</div>
                    <div className="text-xs text-[#5D6E73]">Update information</div>
                  </div>
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start h-12 bg-white hover:bg-[#E17F70]/10 border-2 border-[#E17F70]/40 hover:border-[#E17F70] hover:scale-[1.02] transition-all"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <div className="p-1 rounded bg-gradient-to-br from-[#E17F70] to-[#9E3B47] mr-3">
                  <Trash2 className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-[#9E3B47]">Delete User</div>
                  <div className="text-xs text-[#5D6E73]">Remove permanently</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="relative shadow-xl border-2 border-[#82A094]/30 bg-gradient-to-br from-white to-[#A2B9AF]/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4F6A64] via-[#82A094] to-[#A2B9AF]" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-[#4F6A64] to-[#82A094] shadow-lg shadow-[#82A094]/20 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#82A094] via-white/40 to-[#4F6A64]" />
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg text-[#4F6A64]">Contact Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-white rounded-xl border-2 border-[#82A094]/20 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-1 rounded bg-gradient-to-br from-[#4F6A64] to-[#82A094]">
                    <Mail className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <div className="text-xs text-[#5D6E73] uppercase tracking-wider font-bold">Email</div>
                    <div className="font-medium text-[#546A7A] text-sm break-all">{financeUser.email}</div>
                  </div>
                </div>
              </div>
              {financeUser.phone && (
                <div className="p-3 bg-white rounded-xl border-2 border-[#82A094]/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded bg-gradient-to-br from-[#4F6A64] to-[#82A094]">
                      <Phone className="h-3 w-3 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-[#5D6E73] uppercase tracking-wider font-bold">Phone</div>
                      <div className="font-medium text-[#546A7A] text-sm">{financeUser.phone}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-2 border-[#E17F70]/30 shadow-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg shadow-[#E17F70]/20">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <AlertDialogTitle className="text-[#9E3B47]">Delete Finance User</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-[#5D6E73]">
              Are you sure you want to delete <span className="font-bold text-[#9E3B47]">{financeUser.email}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2 border-[#AEBFC3]/40 hover:bg-[#AEBFC3]/10 font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white font-bold shadow-lg shadow-[#E17F70]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
