'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Users, 
  UserCheck, 
  UserX, 
  Shield,
  Search,
  RefreshCw,
  Pencil,
  Eye,
  Trash2,
  Crown,
  User,
  Eye as ViewIcon,
  ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  getFinanceUsers, 
  deleteFinanceUser,
  getFinanceRoleDisplayName,
  getFinanceRoleBadgeColor,
  type FinanceUser,
  type FinanceRoleType
} from '@/services/financeUser.service';

export default function FinanceUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [users, setUsers] = useState<FinanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    regularUsers: 0,
    viewers: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<FinanceUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getFinanceUsers({
        page: currentPage,
        limit: 30,
        search: searchQuery || undefined,
      });

      if (response.success) {
        setUsers(response.data || []);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
        }
        if (response.stats) {
          setStats(response.stats);
        }
      }
    } catch (error) {
      console.error('Error fetching finance users:', error);
      toast.error('Failed to fetch finance users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleDeleteClick = (user: FinanceUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      await deleteFinanceUser(userToDelete.id);
      toast.success('Finance user deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete finance user');
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const getRoleIcon = (role: FinanceRoleType) => {
    switch (role) {
      case 'FINANCE_ADMIN':
        return <Crown className="h-3 w-3" />;
      case 'FINANCE_USER':
        return <User className="h-3 w-3" />;
      case 'FINANCE_VIEWER':
        return <ViewIcon className="h-3 w-3" />;
      case 'FINANCE_APPROVER':
        return <ClipboardCheck className="h-3 w-3" />;
      default:
        return <Shield className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient - Kardex Coral & Sand */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#976E44] via-[#CE9F6B] to-[#E17F70] p-6 text-white">
        <div className="absolute inset-0 bg-black/5"></div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 drop-shadow-md">Finance Users</h1>
            <p className="text-white/90">
              Manage finance module users and their permissions
            </p>
          </div>
          <Link href="/finance/ar/users/new">
            <Button className="bg-white text-[#976E44] hover:bg-[#EEC1BF] hover:text-[#9E3B47] shadow-lg font-semibold">
              <Plus className="mr-2 h-4 w-4" />
              Add Finance User
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Finance Users"
          description="Manage finance module users"
          action={
            <Link href="/finance/ar/users/new">
              <Button className="bg-[#CE9F6B] hover:bg-[#976E44] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </Link>
          }
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-[#CE9F6B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-[#976E44] to-[#CE9F6B] flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#5D6E73]">Total Users</p>
                <p className="text-2xl font-bold text-[#976E44]">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-[#A2B9AF]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-[#4F6A64] to-[#82A094] flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#5D6E73]">Active</p>
                <p className="text-2xl font-bold text-[#4F6A64]">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-[#E17F70]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-[#9E3B47] to-[#E17F70] flex items-center justify-center">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#5D6E73]">Admins</p>
                <p className="text-2xl font-bold text-[#9E3B47]">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-[#96AEC2]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] flex items-center justify-center">
                <UserX className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#5D6E73]">Inactive</p>
                <p className="text-2xl font-bold text-[#546A7A]">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5D6E73]" />
              <Input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-[#CE9F6B]/30 focus:border-[#CE9F6B] focus:ring-[#CE9F6B]/20"
              />
            </div>
            <Button 
              type="submit"
              className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B] text-white"
            >
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
                fetchUsers();
              }}
              className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-[#CE9F6B]/20">
          <CardTitle className="text-[#976E44]">Finance Users</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${users.length} users found`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-[#CE9F6B]" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-20 w-20 rounded-full bg-[#CE9F6B]/10 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-[#CE9F6B]" />
              </div>
              <h3 className="text-lg font-semibold text-[#976E44] mb-2">No Finance Users Found</h3>
              <p className="text-[#5D6E73] mb-6">
                {searchQuery ? 'No users match your search criteria' : 'Get started by adding your first finance user'}
              </p>
              <Link href="/finance/ar/users/new">
                <Button className="bg-gradient-to-r from-[#976E44] to-[#CE9F6B] hover:from-[#865E38] hover:to-[#B88F5B] text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Finance User
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table - Hidden on mobile */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#CE9F6B]/5 hover:bg-[#CE9F6B]/10">
                      <TableHead className="text-[#976E44] font-semibold">User</TableHead>
                      <TableHead className="text-[#976E44] font-semibold">Role</TableHead>
                      <TableHead className="text-[#976E44] font-semibold">Status</TableHead>
                      <TableHead className="text-[#976E44] font-semibold">Last Login</TableHead>
                      <TableHead className="text-[#976E44] font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow 
                        key={user.id} 
                        className="hover:bg-[#CE9F6B]/5 cursor-pointer"
                        onClick={() => router.push(`/finance/ar/users/${user.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-[#976E44] to-[#CE9F6B] flex items-center justify-center text-white font-semibold">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#546A7A]">{user.name || 'No name'}</p>
                              <p className="text-sm text-[#5D6E73]">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${getFinanceRoleBadgeColor(user.financeRole)} flex items-center gap-1 w-fit`}
                          >
                            {getRoleIcon(user.financeRole)}
                            {getFinanceRoleDisplayName(user.financeRole)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.isActive ? 'default' : 'secondary'}
                            className={user.isActive 
                              ? 'bg-[#A2B9AF]/20 text-[#4F6A64] hover:bg-[#82A094]/30' 
                              : 'bg-[#AEBFC3]/20 text-[#5D6E73] hover:bg-[#92A2A5]/30'
                            }
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[#5D6E73]">
                          {user.lastLoginAt 
                            ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/finance/ar/users/${user.id}`}>
                              <Button variant="ghost" size="sm" className="text-[#546A7A] hover:text-[#976E44] hover:bg-[#CE9F6B]/10">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/finance/ar/users/${user.id}/edit`}>
                              <Button variant="ghost" size="sm" className="text-[#546A7A] hover:text-[#976E44] hover:bg-[#CE9F6B]/10">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-[#9E3B47] hover:text-[#75242D] hover:bg-[#E17F70]/10"
                              onClick={() => handleDeleteClick(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => router.push(`/finance/ar/users/${user.id}`)}
                    className="bg-white rounded-xl border border-[#CE9F6B]/20 p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-r from-[#976E44] to-[#CE9F6B] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#546A7A] truncate">{user.name || 'No name'}</p>
                        <p className="text-sm text-[#5D6E73] truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={`${getFinanceRoleBadgeColor(user.financeRole)} flex items-center gap-1 text-xs`}
                          >
                            {getRoleIcon(user.financeRole)}
                            {getFinanceRoleDisplayName(user.financeRole)}
                          </Badge>
                          <Badge 
                            variant={user.isActive ? 'default' : 'secondary'}
                            className={`text-xs ${user.isActive 
                              ? 'bg-[#A2B9AF]/20 text-[#4F6A64]' 
                              : 'bg-[#AEBFC3]/20 text-[#5D6E73]'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10"
          >
            Previous
          </Button>
          <span className="text-sm text-[#5D6E73]">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="border-[#CE9F6B] text-[#976E44] hover:bg-[#CE9F6B]/10"
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Finance User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.name || userToDelete?.email}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
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
