'use client';

import CustomerContractTracking from '@/components/contracts/CustomerContractTracking';

export default function ExpertContractsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <CustomerContractTracking role="Expert Helpdesk" />
    </div>
  );
}
