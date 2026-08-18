'use client';

import { use } from 'react';
import DetailedContractDetails from '@/components/contracts/DetailedContractDetails';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminDetailedContractDetailPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <DetailedContractDetails
        id={Number(unwrappedParams.id)}
        role="Admin"
        backUrl="/admin/contracts/detailed"
      />
    </div>
  );
}
