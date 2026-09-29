'use client';

import { Suspense } from 'react';
import DetailedContractTracking from '@/components/contracts/DetailedContractTracking';

export default function AdminDetailedContractsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-[#9E3B47] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <div className="w-full p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
        <DetailedContractTracking role="Admin" />
      </div>
    </Suspense>
  );
}

