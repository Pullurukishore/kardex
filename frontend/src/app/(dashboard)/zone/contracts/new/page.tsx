'use client';

import ContractCreateForm from '@/components/contracts/ContractCreateForm';

export default function ZoneContractCreatePage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractCreateForm role="Zone User" backUrl="/zone/contracts" />
    </div>
  );
}
