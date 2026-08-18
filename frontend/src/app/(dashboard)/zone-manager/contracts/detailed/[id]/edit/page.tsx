'use client';

import { use } from 'react';
import DetailedContractEditForm from '@/components/contracts/DetailedContractEditForm';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ZoneManagerDetailedContractEditPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <DetailedContractEditForm
        id={Number(unwrappedParams.id)}
        role="Zone Manager"
        backUrl={`/zone-manager/contracts/detailed/${unwrappedParams.id}`}
      />
    </div>
  );
}
