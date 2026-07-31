'use client';

import ContractsDashboard from '@/components/contracts/ContractsDashboard';

export default function ZoneContractsDashboardPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractsDashboard role="Zone User" view="dashboard" />
    </div>
  );
}
