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
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading finance user details...</div>
        </div>
      </div>
    );
  }

  if (!financeUser) {
    return (
      <div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-[#976E44]">Finance User Not Found</h1>
          <p className="text-[#5D6E73] mt-2">The requested finance user could not be found.</p>
          <Link href="/finance/ar/users" className="mt-4 inline-block">
            <Button className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B]">
              Back to Finance Users
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-6 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
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
                  className={financeUser.isActive 
                    ? 'bg-white/20 text-white border-white/30' 
                    : 'bg-gray-500/20 text-white/70 border-gray-400/30'
                  }
                >
                  {financeUser.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Badge 
                  variant="outline"
                  className="bg-white/10 text-white border-white/30 flex items-center gap-1"
                >
                  {getRoleIcon(financeUser.financeRole)}
                  {getFinanceRoleDisplayName(financeUser.financeRole)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/finance/ar/users">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Link href={`/finance/ar/users/${userId}/edit`}>
              <Button className="bg-white text-[#976E44] hover:bg-[#EEC1BF] hover:text-[#9E3B47]">
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
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-[#CE9F6B]/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl text-[#976E44]">
                <User className="h-6 w-6" />
                Personal Information
              </CardTitle>
              <CardDescription>Basic details and contact information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Full Name</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#CE9F6B]/20">
                    <User className="h-5 w-5 text-[#976E44]" />
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.name || 'Not provided'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Email Address</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#CE9F6B]/20">
                    <Mail className="h-5 w-5 text-[#CE9F6B]" />
                    <span className="font-medium text-[#546A7A] break-all">{financeUser.email}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Phone Number</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#CE9F6B]/20">
                    <Phone className="h-5 w-5 text-[#976E44]" />
                    <span className="font-medium text-[#546A7A]">
                      {financeUser.phone || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-[#E17F70]/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl text-[#9E3B47]">
                <Activity className="h-6 w-6" />
                Account Status & Activity
              </CardTitle>
              <CardDescription>Current status and recent activity information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Account Status</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E17F70]/20">
                    <div className={`h-3 w-3 rounded-full ${
                      financeUser.isActive ? 'bg-[#82A094]' : 'bg-[#979796]'
                    }`}></div>
                    <Badge 
                      variant={financeUser.isActive ? 'default' : 'secondary'}
                      className={financeUser.isActive 
                        ? 'bg-[#A2B9AF]/20 text-[#4F6A64] hover:bg-[#82A094]/30' 
                        : 'bg-[#AEBFC3]/20 text-[#5D6E73] hover:bg-[#92A2A5]/30'
                      }
                    >
                      {financeUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Finance Role</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E17F70]/20">
                    {getRoleIcon(financeUser.financeRole)}
                    <Badge variant="outline" className={getFinanceRoleBadgeColor(financeUser.financeRole)}>
                      {getFinanceRoleDisplayName(financeUser.financeRole)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Last Login</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E17F70]/20">
                    <Clock className="h-5 w-5 text-[#E17F70]" />
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
                  <label className="text-sm font-semibold text-[#5D6E73] uppercase tracking-wide">Account Created</label>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E17F70]/20">
                    <Calendar className="h-5 w-5 text-[#E17F70]" />
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
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-[#CE9F6B]/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-[#976E44]">
                <Activity className="h-5 w-5" />
                Quick Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-[#CE9F6B]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#CE9F6B]/20 rounded-lg flex items-center justify-center">
                      {getRoleIcon(financeUser.financeRole)}
                    </div>
                    <span className="text-sm font-medium text-[#5D6E73]">Role</span>
                  </div>
                  <Badge variant="outline" className={getFinanceRoleBadgeColor(financeUser.financeRole)}>
                    {getFinanceRoleDisplayName(financeUser.financeRole)}
                  </Badge>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-[#CE9F6B]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#A2B9AF]/20 rounded-lg flex items-center justify-center">
                      <Activity className="h-4 w-4 text-[#4F6A64]" />
                    </div>
                    <span className="text-sm font-medium text-[#5D6E73]">Status</span>
                  </div>
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
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-[#EEC1BF]/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-[#9E3B47]">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/finance/ar/users/${userId}/edit`} className="block">
                <Button variant="outline" className="w-full justify-start h-12 bg-white hover:bg-[#CE9F6B]/10 border-[#CE9F6B] hover:border-[#CE9F6B]">
                  <Pencil className="mr-3 h-5 w-5 text-[#976E44]" />
                  <div className="text-left">
                    <div className="font-medium text-[#976E44]">Edit Details</div>
                    <div className="text-xs text-[#5D6E73]">Update information</div>
                  </div>
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start h-12 bg-white hover:bg-[#E17F70]/10 border-[#E17F70] hover:border-[#E17F70] text-[#9E3B47] hover:text-[#75242D]"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Delete User</div>
                  <div className="text-xs opacity-70">Remove permanently</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-[#A2B9AF]/10">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-[#4F6A64]">
                <Mail className="h-5 w-5" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-white rounded-lg border border-[#A2B9AF]/20">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[#4F6A64]" />
                  <div>
                    <div className="text-xs text-[#5D6E73] uppercase tracking-wide">Email</div>
                    <div className="font-medium text-[#546A7A] text-sm break-all">{financeUser.email}</div>
                  </div>
                </div>
              </div>
              {financeUser.phone && (
                <div className="p-3 bg-white rounded-lg border border-[#A2B9AF]/20">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-[#4F6A64]" />
                    <div>
                      <div className="text-xs text-[#5D6E73] uppercase tracking-wide">Phone</div>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Finance User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {financeUser.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-[#9E3B47] text-white hover:bg-[#75242D]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
