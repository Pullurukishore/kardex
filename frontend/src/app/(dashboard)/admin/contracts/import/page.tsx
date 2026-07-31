'use client';

import ContractBulkImport from '@/components/contracts/ContractBulkImport';

export default function AdminContractsImportPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
      <ContractBulkImport role="Admin" />
    </div>
  );
}
