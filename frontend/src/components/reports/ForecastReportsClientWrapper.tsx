'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const ForecastReportsClient = dynamic(
  () => import('./ForecastReportsClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A7A]"></div>
      </div>
    )
  }
);

interface Zone {
  id: number;
  name: string;
}

export default function ForecastReportsClientWrapper({ zones }: { zones: Zone[] }) {
  return <ForecastReportsClient zones={zones} />;
}
