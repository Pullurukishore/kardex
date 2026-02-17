'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExpertHelpdesk } from '@/lib/server/expert-helpdesk';
import { ArrowLeft, Lock, Eye, EyeOff, Save, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface ChangePasswordClientProps {
  expert: ExpertHelpdesk;
}

export default function ChangePasswordClient({ expert }: ChangePasswordClientProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validatePassword = (password: string): { valid: boolean; error?: string } => {
    if (!password) {
      return { valid: false, error: 'Password is required' };
    }
    if (password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters' };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate passwords
    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.valid) {
      setMessage({ type: 'error', text: passwordValidation.error || 'Invalid password' });
      toast.error(passwordValidation.error || 'Invalid password');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post(`/admin/${expert.id}/reset-password`, {
        newPassword: formData.newPassword
      });

      if ((response as any).user || response.data || (response as any).success || (response as any).message || (response as any).newPassword) {
        setMessage({ type: 'success', text: 'Password changed successfully! Redirecting...' });
        toast.success('Password changed successfully!');

        setTimeout(() => {
          router.push('/admin/manage-expert-helpdesk');
        }, 1500);
      } else {
        throw new Error(response.message || 'Failed to change password');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to change password';
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
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white rounded-xl border border-[#92A2A5] shadow-sm">
        <div className="p-6 border-b border-[#92A2A5]">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-[#96AEC2]/20 rounded-lg flex items-center justify-center">
              <Lock className="h-5 w-5 text-[#546A7A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#546A7A]">Change Password</h2>
              <p className="text-sm text-[#5D6E73]">Update the password for this expert helpdesk user</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg border ${message.type === 'success'
              ? 'bg-[#A2B9AF]/10 border-[#A2B9AF] text-[#4F6A64]'
              : 'bg-[#E17F70]/10 border-[#E17F70] text-[#75242D]'
              }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* New Password Field */}
          <div>
            <label className="block text-sm font-medium text-[#546A7A] mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="Enter new password (minimum 6 characters)"
                className="w-full px-4 py-2 border border-[#92A2A5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEBFC3]0 hover:text-[#5D6E73] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {formData.newPassword && formData.newPassword.length < 6 && (
              <p className="text-xs text-[#9E3B47] mt-1">Password must be at least 6 characters</p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-[#546A7A] mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-[#92A2A5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#96AEC2] focus:border-transparent"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEBFC3]0 hover:text-[#5D6E73] transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
              <p className="text-xs text-[#9E3B47] mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg p-4">
            <p className="text-sm font-medium text-[#546A7A] mb-2">Password Requirements:</p>
            <ul className="text-xs text-[#546A7A] space-y-1">
              <li className={`flex items-center space-x-2 ${formData.newPassword.length >= 6 ? 'text-[#4F6A64]' : ''}`}>
                <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${formData.newPassword.length >= 6 ? 'bg-[#A2B9AF]/100 border-[#82A094]' : 'border-[#96AEC2]'}`}>
                  {formData.newPassword.length >= 6 && <span className="text-white text-xs">✓</span>}
                </span>
                <span>Minimum 6 characters</span>
              </li>
              <li className={`flex items-center space-x-2 ${formData.newPassword === formData.confirmPassword && formData.newPassword ? 'text-[#4F6A64]' : ''}`}>
                <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${formData.newPassword === formData.confirmPassword && formData.newPassword ? 'bg-[#A2B9AF]/100 border-[#82A094]' : 'border-[#96AEC2]'}`}>
                  {formData.newPassword === formData.confirmPassword && formData.newPassword && <span className="text-white text-xs">✓</span>}
                </span>
                <span>Passwords match</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !formData.newPassword || !formData.confirmPassword || formData.newPassword !== formData.confirmPassword}
              className="flex-1 bg-gradient-to-r from-[#546A7A] to-cyan-600 text-white py-2 rounded-lg font-medium hover:from-[#546A7A] hover:to-[#546A7A] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Changing Password...' : 'Change Password'}</span>
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-[#AEBFC3]/20 text-[#5D6E73] py-2 rounded-lg font-medium hover:bg-[#92A2A5]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
