import React from 'react';
import { notFound } from 'next/navigation';
import { getExternalUserById } from '@/lib/server/external';
import { MobilePageHeader } from '@/components/ui/mobile-responsive';
import EditExternalUserClient from '@/components/admin/EditExternalUserClient';

interface EditExternalUserPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditExternalUserPage({ params }: EditExternalUserPageProps) {
  const { id } = await params;

  // Server-side data fetching
  try {
    const externalUser = await getExternalUserById(parseInt(id));
    
    if (!externalUser) {
      notFound();
    }

    return (
      <div className="space-y-6">
        {/* Desktop Header with Gradient */}
        <div className="hidden md:block relative overflow-hidden rounded-lg bg-gradient-to-r from-[#6F8A9D] via-[#6F8A9D] to-indigo-800 p-6 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Edit External User</h1>
              <p className="text-[#6F8A9D]">
                Update external user information and permissions for {externalUser.name || externalUser.email}
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
            title="Edit External User"
            description={`Update information for ${externalUser.name || externalUser.email}`}
          />
        </div>

        {/* Edit Form Client Component */}
        <EditExternalUserClient externalUser={externalUser} />
      </div>
    );
  } catch (error) {
    notFound();
  }
}