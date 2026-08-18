'use client';

import DetailedContractTracking from '@/components/contracts/DetailedContractTracking';

export default function ZoneManagerDetailedContractsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <DetailedContractTracking role="Zone Manager" />
    </div>
  );
}
