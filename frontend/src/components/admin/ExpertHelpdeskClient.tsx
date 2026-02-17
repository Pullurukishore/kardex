'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExpertHelpdesk } from '@/lib/server/expert-helpdesk';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, UserX, Zap, Pencil as Edit2, Lock, Trash2, Search } from 'lucide-react';

interface ExpertHelpdeskStats {
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

interface ExpertHelpdeskClientProps {
  initialExperts: ExpertHelpdesk[];
  initialStats: ExpertHelpdeskStats;
  initialPagination: Pagination;
  searchParams: {
    search?: string;
    page?: string;
  };
}

export default function ExpertHelpdeskClient({
  initialExperts,
  initialStats,
  initialPagination,
  searchParams
}: ExpertHelpdeskClientProps) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; expert: ExpertHelpdesk | null }>({
    show: false,
    expert: null
  });
  const [deleting, setDeleting] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.search || '');

  const handleDeleteClick = (expert: ExpertHelpdesk) => {
    setDeleteConfirm({ show: true, expert });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.expert) return;

    const expertToDelete = deleteConfirm.expert;
    setDeleting(expertToDelete.id);

    try {
      await apiClient.delete(`/admin/${expertToDelete.id}`);

      toast.success(`Expert Helpdesk "${expertToDelete.name || expertToDelete.email}" deleted successfully`);
      setDeleteConfirm({ show: false, expert: null });

      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete expert';
      toast.error(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, expert: null });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    router.push(`/admin/manage-expert-helpdesk?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-[#96AEC2]/10 to-[#96AEC2]/20 p-6 rounded-xl border border-[#96AEC2] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-[#6F8A9D] rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#546A7A]">Total Experts</p>
              <p className="text-2xl font-bold text-[#546A7A]">{initialStats?.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#A2B9AF]/10 to-[#A2B9AF]/20 p-6 rounded-xl border border-[#A2B9AF] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-[#4F6A64] rounded-lg">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#4F6A64]">Active</p>
              <p className="text-2xl font-bold text-[#4F6A64]">{initialStats?.active || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#E17F70]/10 to-red-100 p-6 rounded-xl border border-[#E17F70] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-[#9E3B47] rounded-lg">
              <UserX className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#9E3B47]">Inactive</p>
              <p className="text-2xl font-bold text-[#75242D]">{initialStats?.inactive || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#EEC1BF]/10 to-[#EEC1BF]/20 p-6 rounded-xl border border-[#CE9F6B]/50 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-[#976E44] rounded-lg">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-[#976E44]">Recently Active</p>
              <p className="text-2xl font-bold text-[#976E44]">{initialStats?.recentlyActive || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-[#92A2A5] p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#979796]" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#6F8A9D] text-white rounded-lg hover:bg-[#546A7A] transition-colors font-medium"
          >
            Search
          </button>
        </form>
      </div>

      {/* Expert Helpdesk List */}
      <div className="bg-white rounded-xl shadow-sm border border-[#92A2A5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#92A2A5] bg-[#AEBFC3]/10">
          <div className="flex items-center">
            <Zap className="h-5 w-5 text-[#546A7A] mr-2" />
            <h3 className="text-lg font-semibold text-[#546A7A]">Expert Helpdesk Users</h3>
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-[#96AEC2]/20 text-[#546A7A] rounded-full">
              {initialExperts?.length || 0}
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {initialExperts?.length > 0 ? (
            initialExperts.map((expert) => (
              <div key={expert.id} className="p-4 sm:p-6 hover:bg-[#AEBFC3]/10 transition-colors">
                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-[#546A7A] truncate">
                        {expert.name || 'Expert'}
                      </h4>
                      <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                        <span className="mr-1">📧</span>
                        <span className="truncate">{expert.email}</span>
                      </div>
                      {expert.phone && (
                        <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                          <span className="mr-1">📱</span>
                          <span>{expert.phone}</span>
                        </div>
                      )}
                      {expert.specialization && (
                        <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                          <span className="mr-1">🎯</span>
                          <span className="truncate">{expert.specialization}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expert.isActive
                        ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]'
                        : 'bg-[#E17F70]/20 text-[#75242D] border border-[#E17F70]'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${expert.isActive ? 'bg-[#82A094]' : 'bg-[#E17F70]'
                        }`}></div>
                      {expert.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <div className="flex items-center space-x-1">
                      <Link
                        href={`/admin/manage-expert-helpdesk/${expert.id}/edit`}
                        className="p-3 text-[#979796] hover:text-[#546A7A] hover:bg-[#96AEC2]/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Edit Expert"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/manage-expert-helpdesk/${expert.id}/password`}
                        className="p-3 text-[#979796] hover:text-[#4F6A64] hover:bg-[#A2B9AF]/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Change Password"
                      >
                        <Lock className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(expert)}
                        disabled={deleting === expert.id}
                        className="p-3 text-[#979796] hover:text-[#9E3B47] hover:bg-[#E17F70]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Delete Expert"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-[#546A7A]">
                        {expert.name || 'Expert'}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center text-sm text-[#5D6E73]">
                          <span className="mr-1">📧</span>
                          {expert.email}
                        </div>
                        {expert.phone && (
                          <div className="flex items-center text-sm text-[#5D6E73]">
                            <span className="mr-1">📱</span>
                            {expert.phone}
                          </div>
                        )}
                      </div>
                      {expert.specialization && (
                        <div className="flex items-center text-sm text-[#5D6E73] mt-1">
                          <span className="mr-1">🎯</span>
                          {expert.specialization}
                        </div>
                      )}
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expert.isActive
                            ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]'
                            : 'bg-[#E17F70]/20 text-[#75242D] border border-[#E17F70]'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${expert.isActive ? 'bg-[#82A094]' : 'bg-[#E17F70]'
                            }`}></div>
                          {expert.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/admin/manage-expert-helpdesk/${expert.id}/edit`}
                      className="p-2 text-[#979796] hover:text-[#546A7A] hover:bg-[#96AEC2]/10 rounded-lg transition-colors"
                      title="Edit Expert"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/manage-expert-helpdesk/${expert.id}/password`}
                      className="p-2 text-[#979796] hover:text-[#4F6A64] hover:bg-[#A2B9AF]/10 rounded-lg transition-colors"
                      title="Change Password"
                    >
                      <Lock className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(expert)}
                      disabled={deleting === expert.id}
                      className="p-2 text-[#979796] hover:text-[#9E3B47] hover:bg-[#E17F70]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Expert"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expert.lastActiveAt && (
                  <div className="mt-3 text-xs text-[#AEBFC3]0 sm:mt-3">
                    Last active: {new Date(expert.lastActiveAt).toLocaleDateString('en-US', {
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
              <Zap className="h-12 w-12 text-[#92A2A5] rounded mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#546A7A] mb-2">No expert helpdesk users found</h3>
              <p className="text-[#AEBFC3]0">Get started by adding your first expert helpdesk user.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && deleteConfirm.expert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="h-12 w-12 bg-[#E17F70]/20 rounded-full flex items-center justify-center">
                  <span className="text-[#9E3B47] text-xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#546A7A]">Delete Expert Helpdesk</h3>
                  <p className="text-sm text-[#5D6E73]">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-[#E17F70]/10 border border-[#E17F70] rounded-lg p-4 mb-6">
                <p className="text-sm text-[#75242D]">
                  <span className="font-medium">Are you sure you want to delete:</span>
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-[#75242D]">
                    {deleteConfirm.expert.name || 'Expert'}
                  </p>
                  <p className="text-sm text-[#75242D]">{deleteConfirm.expert.email}</p>
                  {deleteConfirm.expert.phone && (
                    <p className="text-sm text-[#75242D]">{deleteConfirm.expert.phone}</p>
                  )}
                  {deleteConfirm.expert.specialization && (
                    <p className="text-sm text-[#75242D]">Specialization: {deleteConfirm.expert.specialization}</p>
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
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Expert</span>
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
