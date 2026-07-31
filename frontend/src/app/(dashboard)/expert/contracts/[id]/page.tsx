'use client';

import { use } from 'react';
import ContractDetails from '@/components/contracts/ContractDetails';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ExpertContractDetailPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  return <ContractDetails id={Number(unwrappedParams.id)} role="Expert Helpdesk" backUrl="/expert/contracts" />;
}
