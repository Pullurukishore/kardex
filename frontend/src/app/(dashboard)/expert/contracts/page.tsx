'use client';

import CustomerContractTracking from '@/components/contracts/CustomerContractTracking';

export default function ExpertContractsPage() {
  return (
    <div className="w-full animate-in fade-in duration-200">
      <CustomerContractTracking role="Expert Helpdesk" />
    </div>
  );
}
