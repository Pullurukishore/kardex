import React from 'react';
import { notFound } from 'next/navigation';
import { getAdminById } from '@/lib/server/admin';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import EditAdminClient from '@/components/admin/EditAdminClient';

interface EditAdminPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function EditAdminPage({ params }: EditAdminPageProps) {
  const { id } = await params;

  // Server-side data fetching
  const admin = await getAdminById(id);
  
  if (!admin) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Desktop Header with Gradient */}
      <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-blue-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Edit Administrator</h1>
            <p className="text-[#96AEC2]">
              Update administrator information and permissions for {admin.name || admin.email}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-16 w-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
              <span className="text-2xl">✏️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Edit Administrator"
          description={`Update information for ${admin.name || admin.email}`}
        />
      </div>

      {/* Edit Form Client Component */}
      <EditAdminClient admin={admin} />
    </div>
  );
}