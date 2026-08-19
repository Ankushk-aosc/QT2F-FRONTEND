"use client";

import React from "react";
import { Skeleton, SkeletonItem } from "@/components/ui/skeleton";

/** Generic card skeleton shown while a content panel is loading */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ui-skeleton-card">
      <Skeleton style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <SkeletonItem shape="square" size={20} style={{ width: "45%" }} />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonItem key={i} size={16} style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </Skeleton>
    </div>
  );
}

/** Full-page skeleton for the dashboard Migration tab */
export function MigrationTabSkeleton() {
  return (
    <div className="ui-skeleton-container">
      {/* Header bar */}
      <div className="ui-skeleton-card">
        <Skeleton style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonItem size={28} style={{ width: "30%" }} />
          <SkeletonItem size={16} style={{ width: "55%" }} />
        </Skeleton>
      </div>
      {/* Two stat cards */}
      <div className="ui-skeleton-row">
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
      </div>
      {/* Main content panel */}
      <div className="ui-skeleton-card" style={{ minHeight: "320px" }}>
        <Skeleton style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SkeletonItem size={20} style={{ width: "25%" }} />
          <SkeletonItem size={16} style={{ width: "100%" }} />
          <SkeletonItem size={16} style={{ width: "90%" }} />
          <SkeletonItem size={16} style={{ width: "95%" }} />
          <SkeletonItem size={16} style={{ width: "80%" }} />
          <SkeletonItem size={16} style={{ width: "88%" }} />
        </Skeleton>
      </div>
    </div>
  );
}

/** Slim inline skeleton for small data rows (e.g. history list items) */
export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 0" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <SkeletonItem shape="circle" size={32} />
          <SkeletonItem size={16} style={{ flex: 1 }} />
          <SkeletonItem size={16} style={{ width: "80px" }} />
        </div>
      ))}
    </div>
  );
}
