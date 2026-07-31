'use client';

import { use } from 'react';
import ContractDetails from '@/components/contracts/ContractDetails';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminContractDetailPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  return <ContractDetails id={Number(unwrappedParams.id)} role="Admin" backUrl="/admin/contracts" />;
}
