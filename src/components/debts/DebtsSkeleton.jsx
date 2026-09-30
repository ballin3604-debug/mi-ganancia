import React from 'react';

export function DebtsSkeleton() {
  return (
    <div className="space-y-4 mg-fade-in">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-28 mg-skeleton rounded-[22px]" />
        <div className="h-28 mg-skeleton rounded-[22px]" />
      </div>

      {/* Tabs & Search Skeleton */}
      <div className="h-12 mg-skeleton rounded-2xl" />
      <div className="h-12 mg-skeleton rounded-2xl" />

      {/* Debt Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 mg-skeleton rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}
