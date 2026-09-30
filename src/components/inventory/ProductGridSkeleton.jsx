import React from 'react';

export function ProductGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--mg-bg-surface)] rounded-[22px] border border-[var(--mg-border)] overflow-hidden shadow-xs p-3 space-y-3"
        >
          <div className="aspect-square w-full rounded-2xl mg-skeleton" />
          <div className="space-y-1.5">
            <div className="h-3.5 bg-gray-200 rounded-md w-3/4 mg-skeleton" />
            <div className="h-2.5 bg-gray-200 rounded-md w-1/2 mg-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}
