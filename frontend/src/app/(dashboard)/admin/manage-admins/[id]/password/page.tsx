import React from 'react';
import { notFound } from 'next/navigation';
import { getAdminById } from '@/lib/server/admin';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import PasswordChangeClient from '@/components/admin/PasswordChangeClient';

interface PasswordChangePageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function PasswordChangePage({ params }: PasswordChangePageProps) {
  const { id } = await params;

  // Server-side data fetching
  const admin = await getAdminById(id);
  
  if (!admin) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#82A094] via-[#82A094] to-green-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Change Password</h1>
            <p className="text-[#A2B9AF]">
              Update password for {admin.name || admin.email}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Change Password"
          description={`Update password for ${admin.name || admin.email}`}
        />
      </div>

      {/* Password Change Client Component */}
      <PasswordChangeClient admin={admin} />
    </div>
  );
}