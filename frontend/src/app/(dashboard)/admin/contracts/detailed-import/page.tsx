'use client';

import DetailedContractImport from '@/components/contracts/DetailedContractImport';

export default function AdminDetailedImportPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <DetailedContractImport role="Admin" />
    </div>
  );
}
