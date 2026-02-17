'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExpertHelpdesk } from '@/lib/server/expert-helpdesk';
import { ArrowLeft, User, Mail, Phone, Save, X, Zap, Lock } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface EditExpertHelpdeskClientProps {
  expert: ExpertHelpdesk;
}

export default function EditExpertHelpdeskClient({ expert }: EditExpertHelpdeskClientProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: expert.email || '',
    name: expert.name || '',
    phone: expert.phone || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      toast.error('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const updateData: any = {
        email: formData.email,
        name: formData.name,
        phone: formData.phone || null
      };

      const response = await apiClient.put(`/admin/${expert.id}`, updateData);

      if ((response as any).user || response.data) {
        setMessage({ type: 'success', text: 'Expert updated successfully! Redirecting...' });
        toast.success('Expert updated successfully!');

        router.refresh();
        router.push('/admin/manage-expert-helpdesk');
      } else {
        throw new Error(response.message || 'Failed to update expert');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update expert';
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
    router.push('/admin/manage-expert-helpdesk');
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center space-x-3">
        <Link
          href="/admin/manage-expert-helpdesk"
          className="flex items-center space-x-2 text-[#5D6E73] hover:text-[#546A7A] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Expert Helpdesk</span>
        </Link>
      </div>

      {/* Expert Info Card */}
      <div className="bg-gradient-to-r from-[#96AEC2]/10 to-[#96AEC2]/10 rounded-xl p-6 border border-[#96AEC2]">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-gradient-to-br from-[#6F8A9D] to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#546A7A]">{expert.name || 'Expert'}</h3>
            <p className="text-[#5D6E73]">{expert.email}</p>
            <div className="mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${expert.isActive
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
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-[#92A2A5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#92A2A5] bg-[#AEBFC3]/10">
          <h3 className="text-lg font-semibold text-[#546A7A]">Edit Expert Information</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg border ${message.type === 'success'
                ? 'bg-[#A2B9AF]/10 border-[#A2B9AF] text-[#4F6A64]'
                : 'bg-[#E17F70]/10 border-[#E17F70] text-[#75242D]'
              }`}>
              {message.text}
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-[#5D6E73] mb-2">
              <Mail className="inline h-4 w-4 mr-2" />
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
              placeholder="expert@example.com"
            />
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-[#5D6E73] mb-2">
              <User className="inline h-4 w-4 mr-2" />
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-[#5D6E73] mb-2">
              <Phone className="inline h-4 w-4 mr-2" />
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
              placeholder="+91 98765 43210"
            />
          </div>



          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-[#92A2A5]">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 text-[#5D6E73] bg-[#AEBFC3]/20 hover:bg-[#92A2A5]/30 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <Link
              href={`/admin/manage-expert-helpdesk/${expert.id}/password`}
              className="flex-1 px-4 py-2 text-[#5D6E73] bg-[#CE9F6B]/20 hover:bg-[#CE9F6B]/30 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-[#CE9F6B]"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-white bg-[#6F8A9D] hover:bg-[#546A7A] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Update Expert
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
