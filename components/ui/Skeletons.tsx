"use client";

import React from "react";
import {
  makeStyles,
  tokens,
  Skeleton,
  SkeletonItem,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    width: "100%",
  },
  row: {
    display: "flex",
    gap: "16px",
    width: "100%",
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: 1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

/** Generic card skeleton shown while a content panel is loading */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      <Skeleton>
        <SkeletonItem shape="rectangle" size={20} style={{ width: "45%" }} />
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonItem key={i} shape="rectangle" size={16} style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </Skeleton>
    </div>
  );
}

/** Full-page skeleton for the dashboard Migration tab */
export function MigrationTabSkeleton() {
  const styles = useStyles();
  return (
    <div className={styles.container}>
      {/* Header bar */}
      <div className={styles.card}>
        <Skeleton>
          <SkeletonItem shape="rectangle" size={28} style={{ width: "30%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "55%" }} />
        </Skeleton>
      </div>
      {/* Two stat cards */}
      <div className={styles.row}>
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
      </div>
      {/* Main content panel */}
      <div className={styles.card} style={{ minHeight: "320px" }}>
        <Skeleton>
          <SkeletonItem shape="rectangle" size={20} style={{ width: "25%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "100%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "90%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "95%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "80%" }} />
          <SkeletonItem shape="rectangle" size={16} style={{ width: "88%" }} />
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
        <Skeleton key={i}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <SkeletonItem shape="circle" size={32} />
            <SkeletonItem shape="rectangle" size={16} style={{ flex: 1 }} />
            <SkeletonItem shape="rectangle" size={16} style={{ width: "80px" }} />
          </div>
        </Skeleton>
      ))}
    </div>
  );
}
