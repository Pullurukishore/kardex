'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Admin } from '@/lib/server/admin';
import { MobileCard, MobileForm, MobileFormRow, MobileButton } from '@/components/ui/mobile-responsive';
import { ArrowLeft, User, Mail, Phone, Lock, Save, X } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface EditAdminClientProps {
  admin: Admin;
}

export default function EditAdminClient({ admin }: EditAdminClientProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: admin.email || '',
    name: admin.name || '',
    phone: admin.phone || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updateData: any = { ...formData };

      const response = await apiClient.put(`/admin/${admin.id}`, updateData);

      // Backend returns { user: userData } on success (200 OK means success)
      // The API client wraps the response, so we check for the user data
      if ((response as any).user || response.data) {
        setMessage({ type: 'success', text: 'Administrator updated successfully! Redirecting...' });
        toast.success('Administrator updated successfully!');

        // Refresh the router cache and redirect back to admin list
        router.refresh();
        router.push('/admin/manage-admins');
      } else {
        throw new Error(response.message || 'Failed to update admin');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update admin';
      setMessage({
        type: 'error',
        text: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/manage-admins');
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center space-x-3">
        <Link
          href="/admin/manage-admins"
          className="flex items-center space-x-2 text-[#5D6E73] hover:text-[#546A7A] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Manage Admins</span>
        </Link>
      </div>

      {/* Admin Info Card */}
      <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#6F8A9D]/10 rounded-xl p-6 border border-[#96AEC2]">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-gradient-to-br from-[#6F8A9D] to-[#546A7A] rounded-full flex items-center justify-center shadow-lg">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#546A7A]">{admin.name || 'Administrator'}</h3>
            <p className="text-[#5D6E73]">{admin.email}</p>
            <div className="mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${admin.isActive
                  ? 'bg-[#A2B9AF]/20 text-[#4F6A64] border border-[#A2B9AF]'
                  : 'bg-[#E17F70]/20 text-[#75242D] border border-[#E17F70]'
                }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${admin.isActive ? 'bg-[#82A094]' : 'bg-[#E17F70]'
                  }`}></div>
                {admin.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Form */}
      <div className="hidden md:block max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-[#92A2A5] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#92A2A5] bg-gradient-to-r from-[#AEBFC3]/10 to-[#96AEC2]/10">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-[#6F8A9D] rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#546A7A]">Edit Administrator</h2>
                <p className="text-sm text-[#5D6E73]">Update administrator information and settings</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {message && (
              <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success'
                  ? 'bg-[#A2B9AF]/10 text-[#4F6A64] border border-[#A2B9AF]'
                  : 'bg-[#E17F70]/10 text-[#75242D] border border-[#E17F70]'
                }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${message.type === 'success' ? 'bg-[#82A094]/30' : 'bg-[#E17F70]/30'
                  }`}>
                  {message.type === 'success' ? '✓' : '⚠'}
                </div>
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Mail className="h-4 w-4 text-[#546A7A]" />
                  <span>Email Address *</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors bg-[#AEBFC3]/10 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <User className="h-4 w-4 text-[#546A7A]" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors bg-[#AEBFC3]/10 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Phone className="h-4 w-4 text-[#546A7A]" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors bg-[#AEBFC3]/10 focus:bg-white"
                  placeholder="+1234567890"
                />
              </div>

            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-[#92A2A5]">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-[#5D6E73] bg-white border border-[#92A2A5] rounded-lg hover:bg-[#AEBFC3]/10 focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-[#546A7A] to-[#546A7A] border border-transparent rounded-lg hover:from-[#546A7A] hover:to-[#546A7A] focus:ring-2 focus:ring-[#96AEC2] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Updating...' : 'Update Administrator'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Form */}
      <div className="md:hidden">
        <MobileCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success'
                  ? 'bg-[#A2B9AF]/10 text-[#4F6A64] border border-[#A2B9AF]'
                  : 'bg-[#E17F70]/10 text-[#75242D] border border-[#E17F70]'
                }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${message.type === 'success' ? 'bg-[#82A094]/30' : 'bg-[#E17F70]/30'
                  }`}>
                  {message.type === 'success' ? '✓' : '⚠'}
                </div>
                <span className="font-medium text-sm">{message.text}</span>
              </div>
            )}

            <MobileForm>
              <MobileFormRow>
                <label htmlFor="mobile-email" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Mail className="h-4 w-4 text-[#546A7A]" />
                  <span>Email Address *</span>
                </label>
                <input
                  type="email"
                  id="mobile-email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors"
                  required
                />
              </MobileFormRow>

              <MobileFormRow>
                <label htmlFor="mobile-name" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <User className="h-4 w-4 text-[#546A7A]" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  id="mobile-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors"
                  required
                />
              </MobileFormRow>

              <MobileFormRow>
                <label htmlFor="mobile-phone" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Phone className="h-4 w-4 text-[#546A7A]" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  id="mobile-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-[#6F8A9D] transition-colors"
                  placeholder="+1234567890"
                />
              </MobileFormRow>

            </MobileForm>

            <div className="flex flex-col space-y-3 pt-4">
              <MobileButton
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-[#546A7A] to-[#546A7A] hover:from-[#546A7A] hover:to-[#546A7A] text-white shadow-lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Update Administrator'}
              </MobileButton>
              <MobileButton
                type="button"
                onClick={handleCancel}
                variant="secondary"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </MobileButton>
            </div>
          </form>
        </MobileCard>
      </div>
    </div>
  );
}
