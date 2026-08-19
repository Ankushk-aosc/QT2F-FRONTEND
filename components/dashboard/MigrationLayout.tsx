"use client";

import React from "react";
import { ArrowRight, Sparkles, AlertCircle, Zap } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface MigrationLayoutProps {
  source: React.ReactNode;
  target: React.ReactNode;
  /** Shown above the cards when the pipeline reports a failure. */
  error?: string | null;
  /** Disables the action and explains why, e.g. "Select at least one application." */
  blockedReason?: string;
  actionLabel: string;
  onAction: () => void;
  busy?: boolean;
}

export function MigrationLayout({
  source,
  target,
  error,
  blockedReason,
  actionLabel,
  onAction,
  busy = false,
}: MigrationLayoutProps) {
  const disabled = busy || Boolean(blockedReason);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full py-4">
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-rose-200 bg-rose-50/80 dark:bg-rose-950/40">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <AlertDescription className="text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col lg:flex-row items-stretch gap-0 relative">
        <div className="flex-1 w-full">{source}</div>

        {/* Animated connection indicator */}
        <div className="shrink-0 flex items-center justify-center z-10 py-2 lg:py-0 lg:px-2">
          <div className="flex items-center gap-1.5 rotate-90 lg:rotate-0">
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
              style={{ animation: "pulseDot 1.5s infinite ease-in-out 0s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-500"
              style={{ animation: "pulseDot 1.5s infinite ease-in-out 0.2s" }}
            />
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-800 shadow-lg flex items-center justify-center text-blue-600 dark:text-blue-400 transition-transform">
              <ArrowRight size={18} className="stroke-[2.5]" />
            </div>
            <span
              className="w-1.5 h-1.5 rounded-full bg-indigo-500"
              style={{ animation: "pulseDot 1.5s infinite ease-in-out 0.4s" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              style={{ animation: "pulseDot 1.5s infinite ease-in-out 0.6s" }}
            />
          </div>
        </div>

        <div className="flex-1 w-full">{target}</div>
      </div>

      <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-3 text-center">
        <Button
          size="lg"
          onClick={onAction}
          disabled={disabled}
          className={cn(
            "px-10 py-4 h-auto rounded-xl font-bold text-sm text-white shadow-lg transition-all duration-200",
            disabled
              ? "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-200 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700 hover:shadow-blue-500/30 hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]"
          )}
        >
          {busy ? (
            <div className="flex items-center gap-2.5">
              <Spinner size="extra-small" />
              <span>Migrating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4" />
              <span>{actionLabel}</span>
            </div>
          )}
        </Button>

        {blockedReason && !busy && (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium max-w-md" style={{ animation: "fadeInUp 0.3s ease-out" }}>
            {blockedReason}
          </p>
        )}
      </div>
    </div>
  );
}
