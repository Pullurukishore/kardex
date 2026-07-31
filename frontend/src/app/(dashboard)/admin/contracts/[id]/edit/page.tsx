'use client';

import { use } from 'react';
import ContractEditForm from '@/components/contracts/ContractEditForm';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminContractEditPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const idNum = Number(unwrappedParams.id);
  
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractEditForm 
        id={idNum} 
        role="Admin" 
        backUrl={`/admin/contracts/${idNum}`} 
      />
    </div>
  );
}
