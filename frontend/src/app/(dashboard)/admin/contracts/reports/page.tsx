'use client';

import ContractReports from '@/components/contracts/ContractReports';

export default function AdminContractReportsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractReports role="Admin" />
    </div>
  );
}
