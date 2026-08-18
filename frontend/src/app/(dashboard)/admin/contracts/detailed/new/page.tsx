'use client';

import DetailedContractCreateForm from '@/components/contracts/DetailedContractCreateForm';

export default function AdminDetailedContractNewPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <DetailedContractCreateForm
        role="Admin"
        backUrl="/admin/contracts/detailed"
      />
    </div>
  );
}
