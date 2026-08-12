import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4 mg-fade-in" aria-label="Cargando panel de control">
      {/* Banner Skeleton */}
      <div className="mg-skeleton h-48 w-full rounded-[24px]" />

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mg-skeleton h-20 rounded-[20px]" />
        ))}
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="mg-skeleton h-24 rounded-2xl" />
        ))}
      </div>

      {/* Monthly Summary Skeleton */}
      <div className="mg-skeleton h-44 w-full rounded-2xl" />

      {/* Sales List Skeleton */}
      <div className="mg-skeleton h-64 w-full rounded-2xl" />
    </div>
  );
}
