import React from 'react';

export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-base-200/70 p-4 animate-pulse">
      <div className="h-4 bg-base-300 rounded w-1/3 mb-2"></div>
      <div className="h-8 bg-base-300 rounded w-1/2 mb-2"></div>
      <div className="h-2 bg-base-300 rounded w-full"></div>
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-base-200/70 p-4 animate-pulse">
          <div className="h-4 bg-base-300 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-base-300 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="h-[280px] w-full rounded-xl bg-base-200/60 animate-pulse"></div>
  );
}

export default { SkeletonCard, SkeletonList, SkeletonChart };

