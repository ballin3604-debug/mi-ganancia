import React from 'react';

export function ExpensesSkeleton() {
  return (
    <div className="space-y-4 mg-fade-in">
      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-28 mg-skeleton rounded-[22px]" />
        <div className="h-28 mg-skeleton rounded-[22px]" />
        <div className="h-28 mg-skeleton rounded-[22px]" />
      </div>

      {/* Categories Bar Skeleton */}
      <div className="h-32 mg-skeleton rounded-[22px]" />

      {/* Filter Bar Skeleton */}
      <div className="h-24 mg-skeleton rounded-[22px]" />

      {/* List Items Skeleton */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] p-4 space-y-3 shadow-xs">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--mg-separator)] last:border-none">
            <div className="w-10 h-10 mg-skeleton rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 mg-skeleton rounded-md" />
              <div className="h-3 w-1/2 mg-skeleton rounded-md" />
            </div>
            <div className="h-6 w-20 mg-skeleton rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
