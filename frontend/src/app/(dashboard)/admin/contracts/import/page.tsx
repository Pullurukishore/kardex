'use client';

import ContractBulkImport from '@/components/contracts/ContractBulkImport';

export default function AdminContractsImportPage() {
  return (
    <div className="w-full animate-in fade-in duration-200">
      <ContractBulkImport role="Admin" />
    </div>
  );
}
