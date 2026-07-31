'use client';

import { use } from 'react';
import ContractDetails from '@/components/contracts/ContractDetails';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ZoneContractDetailPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  return <ContractDetails id={Number(unwrappedParams.id)} role="Zone User" backUrl="/zone/contracts" />;
}
