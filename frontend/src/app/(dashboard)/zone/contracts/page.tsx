'use client';

import CustomerContractTracking from '@/components/contracts/CustomerContractTracking';

export default function ZoneContractsPage() {
  return (
    <div className="w-full animate-in fade-in duration-200">
      <CustomerContractTracking role="Zone User" />
    </div>
  );
}
