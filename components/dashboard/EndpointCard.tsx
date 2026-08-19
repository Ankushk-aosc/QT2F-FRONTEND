"use client";

import React from "react";
import { Settings, Server, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatusBadge, type DisplayStatus } from "./ConnectionStatusBadge";
import { cn } from "@/lib/utils";

export interface EndpointCardProps {
  /** "Source" or "Target". */
  role: string;
  /** Platform name, e.g. "Qlik Cloud". */
  name: string;
  status: DisplayStatus;
  /** The configured URL or workspace, shown only when there is one. */
  endpoint?: string;
  /** Opens this connector in Settings. Omitted when there is nothing to configure. */
  onConfigure?: () => void;
  /** Pickers — space/apps for the source, workspace for the target. */
  children?: React.ReactNode;
}

export function EndpointCard({
  role,
  name,
  status,
  endpoint,
  onConfigure,
  children,
}: EndpointCardProps) {
  const isSource = role.toLowerCase() === "source";

  return (
    <section
      className={cn(
        "flex-1 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs flex flex-col justify-between min-h-[320px] overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        isSource
          ? "border-blue-100 dark:border-blue-900/40"
          : "border-indigo-100 dark:border-indigo-900/40"
      )}
      aria-label={`${role}: ${name}`}
    >
      {/* Gradient accent bar */}
      <div
        className={cn(
          "h-1 w-full",
          isSource
            ? "bg-gradient-to-r from-blue-500 to-cyan-400"
            : "bg-gradient-to-r from-indigo-500 to-purple-400"
        )}
      />

      <div className="p-6 flex-1">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full font-mono",
                  isSource
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                )}
              >
                {isSource ? <Cloud size={10} /> : <Server size={10} />}
                {role}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <ConnectionStatusBadge status={status} />
              {endpoint && (
                <span
                  className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate max-w-[280px]"
                  title={endpoint}
                >
                  {endpoint}
                </span>
              )}
            </div>
          </div>

          {onConfigure && (
            <Button
              variant="outline"
              size="sm"
              onClick={onConfigure}
              className="rounded-xl border-slate-200 hover:bg-slate-50 dark:border-slate-700 shrink-0 text-xs gap-1.5 h-8 transition-all duration-150 hover:scale-[1.02]"
            >
              <Settings size={14} className="text-slate-500" />
              Configure
            </Button>
          )}
        </div>

        {children && <div className="pt-5 space-y-4">{children}</div>}
      </div>
    </section>
  );
}
