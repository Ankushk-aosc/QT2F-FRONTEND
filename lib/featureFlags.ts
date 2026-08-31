/**
 * Feature Flags to temporarily enable/disable UI components.
 * Set to true to show, false to hide.
 *
 * Both used to be compiled booleans, so flipping either required a source
 * change and a redeploy despite the "temporarily disabled" comments implying
 * otherwise. They now read an optional NEXT_PUBLIC_* override, falling back
 * to today's value when unset -- the same pattern ENABLE_FULL_PROCESSING
 * uses in lib/env.ts.
 */

// TEMPORARILY DISABLED - ENABLE LATER (or set NEXT_PUBLIC_ENABLE_AZURE_DEVOPS=1)
export const ENABLE_AZURE_DEVOPS =
  process.env.NEXT_PUBLIC_ENABLE_AZURE_DEVOPS !== undefined
    ? process.env.NEXT_PUBLIC_ENABLE_AZURE_DEVOPS === "1"
    : false;

// TEMPORARILY DISABLED - ENABLE LATER (or set NEXT_PUBLIC_ENABLE_RERUN_VALIDATION=0)
export const ENABLE_RERUN_VALIDATION =
  process.env.NEXT_PUBLIC_ENABLE_RERUN_VALIDATION !== undefined
    ? process.env.NEXT_PUBLIC_ENABLE_RERUN_VALIDATION !== "0"
    : true;
