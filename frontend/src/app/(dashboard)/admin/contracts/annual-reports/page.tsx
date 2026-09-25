'use client';

import AnnualContractReportsWrapper from '@/components/contracts/AnnualContractReportsWrapper';

export default function AdminAnnualContractReportsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <AnnualContractReportsWrapper role="Admin" />
    </div>
  );
}
