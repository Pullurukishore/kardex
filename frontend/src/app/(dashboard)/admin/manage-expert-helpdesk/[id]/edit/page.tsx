import React from 'react';
import { getExpertHelpdeskById } from '@/lib/server/expert-helpdesk';
import EditExpertHelpdeskClient from '@/components/admin/EditExpertHelpdeskClient';
import { notFound } from 'next/navigation';

interface EditExpertHelpdeskPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function EditExpertHelpdeskPage({ params }: EditExpertHelpdeskPageProps) {
  const { id } = await params;
  const expert = await getExpertHelpdeskById(parseInt(id));

  if (!expert) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <EditExpertHelpdeskClient expert={expert} />
    </div>
  );
}
