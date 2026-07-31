'use client';

import ContractCreateForm from '@/components/contracts/ContractCreateForm';

export default function AdminContractCreatePage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractCreateForm role="Admin" backUrl="/admin/contracts" />
    </div>
  );
}
