'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Admin } from '@/lib/server/admin';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface AdminStats {
  total: number;
  active: number;
  inactive: number;
  recentlyActive: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminClientProps {
  initialAdmins: Admin[];
  initialStats: AdminStats;
  initialPagination: Pagination;
  searchParams: {
    search?: string;
    page?: string;
  };
}

export default function AdminClient({
  initialAdmins,
  initialStats,
  initialPagination,
  searchParams
}: AdminClientProps) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; admin: Admin | null }>({
    show: false,
    admin: null
  });
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDeleteClick = (admin: Admin) => {
    setDeleteConfirm({ show: true, admin });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.admin) return;

    const adminToDelete = deleteConfirm.admin;
    setDeleting(adminToDelete.id);

    try {
      await apiClient.delete(`/admin/${adminToDelete.id}`);

      toast.success(`Administrator "${adminToDelete.name || adminToDelete.email}" deleted successfully`);
      setDeleteConfirm({ show: false, admin: null });

      // Refresh the page to show updated data
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete administrator';
      toast.error(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, admin: null });
  };
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20 p-6 rounded-xl border border-[#96AEC2] shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-[#6F8A9D] rounded-lg">
              <div className="h-6 w-6 bg-white rounded"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#546A7A]">Total Admins</p>
              <p className="text-2xl font-bold text-[#546A7A]">{initialStats?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/20 p-6 rounded-xl border border-[#A2B9AF] shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-[#4F6A64] rounded-lg">
              <div className="h-6 w-6 bg-white rounded"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#4F6A64]">Active</p>
              <p className="text-2xl font-bold text-[#4F6A64]">{initialStats?.active || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#E17F70]/10 to-red-100 p-6 rounded-xl border border-[#E17F70] shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-[#9E3B47] rounded-lg">
              <div className="h-6 w-6 bg-white rounded"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#9E3B47]">Inactive</p>
              <p className="text-2xl font-bold text-[#75242D]">{initialStats?.inactive || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#6F8A9D]/10 to-[#6F8A9D]/20 p-6 rounded-xl border border-[#6F8A9D] shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-[#546A7A] rounded-lg">
              <div className="h-6 w-6 bg-white rounded"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#546A7A]">Recently Active</p>
              <p className="text-2xl font-bold text-[#546A7A]">{initialStats?.recentlyActive || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Administrators List */}
      <div className="bg-white rounded-xl shadow-sm border border-[#92A2A5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#92A2A5] bg-[#AEBFC3]/10">
          <div className="flex items-center">
            <div className="h-5 w-5 bg-[#5D6E73] rounded mr-2"></div>
            <h3 className="text-lg font-semibold text-[#546A7A]">Administrators</h3>
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-[#96AEC2]/20 text-[#546A7A] rounded-full">
              {initialAdmins?.length || 0}
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {initialAdmins?.length > 0 ? (
            initialAdmins.map((admin) => (
              <div key={admin.id} className="p-4 sm:p-6 hover:bg-[#AEBFC3]/10 transition-colors">
                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-full flex items-center justify-center shadow-lg">
                      <div className="h-5 w-5 bg-white rounded"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-[#546A7A] truncate">
                        {admin.name || 'Administrator'}
                      </h4>
                      <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                        <span className="mr-1">📧</span>
                        <span className="truncate">{admin.email}</span>
                      </div>
                      {admin.phone && (
                        <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                          <span className="mr-1">📱</span>
                          <span>{admin.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${admin.isActive
                        ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]'
                        : 'bg-[#E17F70]/20 text-[#75242D] border border-[#E17F70]'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${admin.isActive ? 'bg-[#82A094]' : 'bg-[#E17F70]'
                        }`}></div>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <div className="flex items-center space-x-1">
                      <Link
                        href={`/admin/manage-admins/${admin.id}/edit`}
                        className="p-3 text-[#979796] hover:text-[#546A7A] hover:bg-[#96AEC2]/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Edit Administrator"
                      >
                        ✏️
                      </Link>
                      <Link
                        href={`/admin/manage-admins/${admin.id}/password`}
                        className="p-3 text-[#979796] hover:text-[#4F6A64] hover:bg-[#A2B9AF]/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Change Password"
                      >
                        🔑
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(admin)}
                        disabled={deleting === admin.id}
                        className="p-3 text-[#979796] hover:text-[#9E3B47] hover:bg-[#E17F70]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Delete Administrator"
                      >
                        {deleting === admin.id ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-full flex items-center justify-center shadow-lg">
                      <div className="h-6 w-6 bg-white rounded"></div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-[#546A7A]">
                        {admin.name || 'Administrator'}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center text-sm text-[#5D6E73]">
                          <span className="mr-1">📧</span>
                          {admin.email}
                        </div>
                        {admin.phone && (
                          <div className="flex items-center text-sm text-[#5D6E73]">
                            <span className="mr-1">📱</span>
                            {admin.phone}
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${admin.isActive
                            ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]'
                            : 'bg-[#E17F70]/20 text-[#75242D] border border-[#E17F70]'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${admin.isActive ? 'bg-[#82A094]' : 'bg-[#E17F70]'
                            }`}></div>
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/manage-admins/${admin.id}/edit`}
                      className="p-2 text-[#979796] hover:text-[#546A7A] hover:bg-[#96AEC2]/10 rounded-lg transition-colors"
                      title="Edit Administrator"
                    >
                      ✏️
                    </Link>
                    <Link
                      href={`/admin/manage-admins/${admin.id}/password`}
                      className="p-2 text-[#979796] hover:text-[#4F6A64] hover:bg-[#A2B9AF]/10 rounded-lg transition-colors"
                      title="Change Password"
                    >
                      🔑
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(admin)}
                      disabled={deleting === admin.id}
                      className="p-2 text-[#979796] hover:text-[#9E3B47] hover:bg-[#E17F70]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Administrator"
                    >
                      {deleting === admin.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>

                {admin.lastActiveAt && (
                  <div className="mt-3 text-xs text-[#AEBFC3]0 sm:mt-3">
                    Last active: {new Date(admin.lastActiveAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="h-12 w-12 bg-[#92A2A5] rounded mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-[#546A7A] mb-2">No administrators found</h3>
              <p className="text-[#AEBFC3]0">Get started by adding your first administrator.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && deleteConfirm.admin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="h-12 w-12 bg-[#E17F70]/20 rounded-full flex items-center justify-center">
                  <span className="text-[#9E3B47] text-xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#546A7A]">Delete Administrator</h3>
                  <p className="text-sm text-[#5D6E73]">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-[#E17F70]/10 border border-[#E17F70] rounded-lg p-4 mb-6">
                <p className="text-sm text-[#75242D]">
                  <span className="font-medium">Are you sure you want to delete:</span>
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-[#75242D]">
                    {deleteConfirm.admin.name || 'Administrator'}
                  </p>
                  <p className="text-sm text-[#75242D]">{deleteConfirm.admin.email}</p>
                  {deleteConfirm.admin.phone && (
                    <p className="text-sm text-[#75242D]">{deleteConfirm.admin.phone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting !== null}
                  className="px-4 py-2 text-sm font-medium text-[#5D6E73] bg-white border border-[#92A2A5] rounded-lg hover:bg-[#AEBFC3]/10 focus:ring-2 focus:ring-[#E17F70] focus:border-[#9E3B47] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#9E3B47] border border-transparent rounded-lg hover:bg-[#75242D] focus:ring-2 focus:ring-[#E17F70] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {deleting !== null ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>Delete Administrator</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
