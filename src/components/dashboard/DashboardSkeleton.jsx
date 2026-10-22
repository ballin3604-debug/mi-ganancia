import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-7 max-w-7xl mx-auto" aria-label="Cargando panel de control" aria-busy="true">
      <div className="space-y-3">
        <div className="mg-skeleton h-10 w-full rounded-2xl" />
        <div className="mg-skeleton h-24 w-full rounded-3xl" />
      </div>

      <div className="space-y-3">
        <div className="mg-skeleton h-3.5 w-40 rounded-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4">
          <div className="mg-skeleton h-40 sm:col-span-2 xl:col-span-5 rounded-3xl" />
          <div className="mg-skeleton h-40 sm:col-span-1 xl:col-span-4 rounded-3xl" />
          <div className="mg-skeleton h-40 sm:col-span-1 xl:col-span-3 rounded-3xl" />
        </div>
      </div>

      <div className="mg-grid-auto">
        <div className="mg-skeleton h-52 rounded-3xl" />
        <div className="mg-skeleton h-52 rounded-3xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="mg-skeleton h-64 rounded-3xl lg:col-span-3" />
        <div className="mg-skeleton h-64 rounded-3xl lg:col-span-2" />
      </div>

      <div className="mg-skeleton h-72 rounded-3xl" />
    </div>
  );
}
