'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Admin } from '@/lib/server/admin';
import { MobileCard, MobileForm, MobileFormRow, MobileButton } from '@/components/ui/mobile-responsive';
import { ArrowLeft, User, Lock, Eye, EyeOff, Save, X, Shield } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface PasswordChangeClientProps {
  admin: Admin;
}

export default function PasswordChangeClient({ admin }: PasswordChangeClientProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      toast.error('New passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      toast.error('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.post(`/admin/${admin.id}/reset-password`, {
        newPassword: formData.newPassword
      });

      // Backend returns { message: "Password reset successfully", newPassword: "..." }
      if (response.message && response.message.includes('successfully')) {
        setMessage({ type: 'success', text: 'Password changed successfully! Redirecting...' });
        toast.success('Password changed successfully!');
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });

        // Refresh the router cache and redirect back to admin list
        router.refresh();
        router.push('/admin/manage-admins');
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
    router.push('/admin/manage-admins');
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center space-x-3">
        <Link
          href="/admin/manage-admins"
          className="flex items-center space-x-2 text-[#5D6E73] hover:text-[#4F6A64] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Manage Admins</span>
        </Link>
      </div>

      {/* Admin Info Card */}
      <div className="bg-gradient-to-r from-[#A2B9AF]/10 to-[#82A094]/10 rounded-xl p-6 border border-[#A2B9AF]">
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-gradient-to-br from-[#82A094] to-[#4F6A64] rounded-full flex items-center justify-center shadow-lg">
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
          <div className="px-6 py-4 border-b border-[#92A2A5] bg-gradient-to-r from-[#AEBFC3]/10 to-[#A2B9AF]/10">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-[#4F6A64] rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#546A7A]">Change Password</h2>
                <p className="text-sm text-[#5D6E73]">Update administrator password securely</p>
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
              <div className="bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-[#546A7A]" />
                  <div className="text-sm text-[#546A7A]">
                    <p className="font-medium">Password Reset</p>
                    <p className="mt-1">
                      This will generate a new password for the administrator. They will need to use the new password to log in.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Lock className="h-4 w-4 text-[#4F6A64]" />
                  <span>New Password *</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="newPassword"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094] transition-colors bg-[#AEBFC3]/10 focus:bg-white"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#979796] hover:text-[#4F6A64] transition-colors"
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-[#AEBFC3]0 mt-2 flex items-center space-x-1">
                  <span>🔐</span>
                  <span>Password must be at least 6 characters long</span>
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Lock className="h-4 w-4 text-[#4F6A64]" />
                  <span>Confirm New Password *</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094] transition-colors bg-[#AEBFC3]/10 focus:bg-white"
                    required
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#979796] hover:text-[#4F6A64] transition-colors"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                  <p className="text-xs text-[#E17F70] mt-2 flex items-center space-x-1">
                    <span>❌</span>
                    <span>Passwords do not match</span>
                  </p>
                )}
                {formData.confirmPassword && formData.newPassword === formData.confirmPassword && formData.newPassword.length >= 6 && (
                  <p className="text-xs text-[#4F6A64] mt-2 flex items-center space-x-1">
                    <span>✅</span>
                    <span>Passwords match</span>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[#EEC1BF]/10 border border-[#CE9F6B] rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-[#976E44]" />
                <div className="text-sm text-[#976E44]">
                  <p className="font-medium">Security Notice</p>
                  <p className="mt-1">
                    The administrator will need to log in again with the new password after this change.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-[#92A2A5]">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-[#5D6E73] bg-white border border-[#92A2A5] rounded-lg hover:bg-[#AEBFC3]/10 focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094] transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                disabled={loading || formData.newPassword !== formData.confirmPassword || formData.newPassword.length < 6}
                className="flex items-center space-x-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-[#4F6A64] to-[#4F6A64] border border-transparent rounded-lg hover:from-green-700 hover:to-[#4F6A64] focus:ring-2 focus:ring-[#82A094] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Changing Password...' : 'Change Password'}</span>
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

            <div className="bg-[#96AEC2]/10 border border-[#96AEC2] rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-[#546A7A]" />
                <div className="text-sm text-[#546A7A]">
                  <p className="font-medium">Password Reset</p>
                  <p className="mt-1">
                    Generate a new password for the administrator.
                  </p>
                </div>
              </div>
            </div>

            <MobileForm>
              <MobileFormRow>
                <label htmlFor="mobile-newPassword" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Lock className="h-4 w-4 text-[#4F6A64]" />
                  <span>New Password *</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="mobile-newPassword"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094] transition-colors"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#979796] hover:text-[#4F6A64]"
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </MobileFormRow>

              <MobileFormRow>
                <label htmlFor="mobile-confirmPassword" className="flex items-center space-x-2 text-sm font-medium text-[#5D6E73] mb-2">
                  <Lock className="h-4 w-4 text-[#4F6A64]" />
                  <span>Confirm Password *</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="mobile-confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border border-[#92A2A5] rounded-lg focus:ring-2 focus:ring-[#82A094] focus:border-[#82A094] transition-colors"
                    required
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#979796] hover:text-[#4F6A64]"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                  <p className="text-xs text-[#E17F70] mt-2">Passwords do not match</p>
                )}
              </MobileFormRow>
            </MobileForm>

            <div className="bg-[#EEC1BF]/10 border border-[#CE9F6B] rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-[#976E44]" />
                <div className="text-sm text-[#976E44]">
                  <p className="font-medium">Security Notice</p>
                  <p className="mt-1">Admin will need to log in again with new password.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-3 pt-4">
              <MobileButton
                type="submit"
                disabled={loading || formData.newPassword !== formData.confirmPassword || formData.newPassword.length < 6}
                className="bg-gradient-to-r from-[#4F6A64] to-[#4F6A64] hover:from-green-700 hover:to-[#4F6A64] text-white shadow-lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Changing...' : 'Change Password'}
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
