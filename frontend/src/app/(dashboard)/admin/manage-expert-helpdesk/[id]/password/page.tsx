import React from 'react';
import { getExpertHelpdeskById } from '@/lib/server/expert-helpdesk';
import ChangePasswordClient from '@/components/admin/ChangePasswordClient';
import { notFound } from 'next/navigation';

interface ChangePasswordPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage({ params }: ChangePasswordPageProps) {
  const { id } = await params;
  const expert = await getExpertHelpdeskById(parseInt(id));

  if (!expert) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ChangePasswordClient expert={expert} />
    </div>
  );
}
