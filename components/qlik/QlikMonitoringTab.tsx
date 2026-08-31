"use client";

import React, { useMemo, useState } from "react";
import { useQlikStore } from "@/stores/qlikStore";
import { useUIStore } from "@/stores/ui.store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Layers,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Terminal,
  Cpu,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Folder,
} from "lucide-react";

export function QlikMonitoringTab() {
  const { apps, selectedApps, processStates, activities, spaces, selectedSpaceId, isProcessing } = useQlikStore();
  const { setActiveTab } = useUIStore();
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const currentSpace = useMemo(() => {
    return spaces.find((s) => s.id === selectedSpaceId)?.name || "Current Space";
  }, [spaces, selectedSpaceId]);

  const activeApps = useMemo(() => {
    // Only display applications that are actively selected or have live/recorded migration activity
    const targetApps = apps.filter((app) => {
      if (selectedApps.includes(app.id)) return true;
      const states = processStates[app.id];
      if (states && Object.values(states).some((s: any) => s?.status && s.status !== "pending")) {
        return true;
      }
      return false;
    });

    return targetApps.map((app) => {
      const states = processStates[app.id] || {};
      const steps = [
        { id: "assessment", label: "Assessment" },
        { id: "parsing", label: "Parsing" },
        { id: "mapping", label: "Mapping" },
        { id: "reportGeneration", label: "Report Generation" },
      ] as const;

      const completedCount = steps.filter((step) => {
        const s = states[step.id]?.status?.toLowerCase();
        return s === "completed" || s === "success" || s === "done";
      }).length;

      const hasFailed = steps.some((step) => {
        const s = states[step.id]?.status?.toLowerCase();
        return s === "failed" || s === "error";
      });

      const runningStep = steps.find((step) => states[step.id]?.status?.toLowerCase() === "running");

      const progress = Math.round((completedCount / steps.length) * 100);

      let status = "Pending";
      let statusColor: "default" | "success" | "warning" | "destructive" | "secondary" = "secondary";

      if (hasFailed) {
        status = "Failed";
        statusColor = "destructive";
      } else if (completedCount === steps.length) {
        status = "Migration Completed";
        statusColor = "success";
      } else if (runningStep) {
        status = `Running ${runningStep.label}`;
        statusColor = "warning";
      } else if (completedCount > 0) {
        status = "In Progress";
        statusColor = "warning";
      }

      return {
        ...app,
        progress,
        status,
        statusColor,
        runningStep: runningStep?.id,
        runningStepLabel: runningStep?.label,
        states,
        steps,
      };
    });
  }, [apps, selectedApps, processStates]);

  const toggleLog = (appId: string) => {
    setExpandedLogs((prev) => ({ ...prev, [appId]: !prev[appId] }));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="text-primary" size={22} />
            <h1 className="text-xl font-bold text-foreground">Live Migration Monitor</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Monitoring active workspaces and running Qlik Sense applications in real time.
          </p>
        </div>

        {activeApps.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary">
              <Folder size={12} />
              Space: <span className="font-semibold">{currentSpace}</span>
            </Badge>
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold">
              {activeApps.length} Active {activeApps.length === 1 ? "App" : "Apps"}
            </Badge>
          </div>
        )}
      </div>

      {/* Empty State: No active/running apps */}
      {activeApps.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center shadow-card">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cpu size={32} />
          </div>
          <h2 className="text-lg font-bold text-foreground">No Migrations Currently Running</h2>
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            There are no active migrations in progress for this workspace. Select one or more applications in the
            Migration tab and click <strong className="text-foreground">Migrate</strong> to start live execution.
          </p>
          <Button
            onClick={() => setActiveTab("Migration")}
            className="mt-6 gap-2 bg-primary px-5 py-2 font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Play size={16} />
            Go to Migration Tab
          </Button>
        </Card>
      ) : (
        /* Active Running Applications List */
        <div className="flex flex-col gap-5">
          {activeApps.map((app) => {
            // Logs are never cleared out of the store once a run finishes --
            // only the render condition used to hide them once nothing was
            // "running" anymore, which made a completed run's terminal look
            // like it had been wiped. Once running stops, fall back to every
            // stage's accumulated logs instead of just the (now empty)
            // "current" step, so the terminal stays visible with its content
            // intact until the user navigates away and back.
            const appActivities = activities[app.id] || {};
            const hasAnyLogs = app.steps.some((step) => (appActivities[step.id]?.length ?? 0) > 0);
            // Respect an explicit user collapse/expand; otherwise default to
            // expanded whenever there's something to show.
            const isLogExpanded =
              app.id in expandedLogs ? expandedLogs[app.id] : !!app.runningStep || hasAnyLogs;
            const currentAgentLogs = app.runningStep
              ? appActivities[app.runningStep] || []
              : app.steps.flatMap((step) => appActivities[step.id] || []);

            return (
              <Card key={app.id} className="overflow-hidden border border-border bg-surface shadow-card">
                {/* App Card Header */}
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface-subtle/40 px-5 py-3.5">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold text-foreground">
                        {app.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        ID: {app.id.length > 18 ? `${app.id.slice(0, 18)}…` : app.id}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Badge variant={app.statusColor} className="px-2.5 py-1 text-xs font-semibold">
                      {app.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4 p-5">
                  {/* Progress Bar */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Overall Migration Progress</span>
                      <span className="font-semibold text-foreground">{app.progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${
                          app.statusColor === "destructive"
                            ? "bg-destructive"
                            : app.statusColor === "success"
                            ? "bg-success"
                            : "bg-primary"
                        }`}
                        style={{ width: `${app.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* 4-Stage Stepper */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {app.steps.map((step, idx) => {
                      const stepState = app.states[step.id];
                      const s = stepState?.status?.toLowerCase();
                      const isDone = s === "completed" || s === "success" || s === "done";
                      const isRunning = s === "running";
                      const isError = s === "failed" || s === "error";

                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-3 text-xs transition-colors ${
                            isRunning
                              ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                              : isDone
                              ? "border-success/30 bg-success/5 text-success font-medium"
                              : isError
                              ? "border-destructive/30 bg-destructive/5 text-destructive font-medium"
                              : "border-border bg-surface-subtle/30 text-muted-foreground"
                          }`}
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {isRunning ? (
                              <Spinner className="h-4 w-4 text-primary" />
                            ) : isDone ? (
                              <CheckCircle2 size={16} className="text-success" />
                            ) : isError ? (
                              <XCircle size={16} className="text-destructive" />
                            ) : (
                              <Clock size={16} className="text-muted-foreground/60" />
                            )}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="truncate text-[11px] font-semibold">{step.label}</span>
                            <span className="text-[10px] capitalize opacity-80">
                              {isRunning ? "In Progress" : isDone ? "Completed" : isError ? "Failed" : "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Streaming Agent Terminal -- stays visible (with everything
                      accumulated so far) after the run finishes, not just
                      while a stage is actively running. */}
                  {(app.runningStep || hasAnyLogs) && (
                    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-[#090d16] text-[#38bdf8] shadow-inner">
                      <div
                        onClick={() => toggleLog(app.id)}
                        className="flex cursor-pointer items-center justify-between border-b border-border/30 bg-[#0f172a] px-3.5 py-2 text-xs text-[#94a3b8]"
                      >
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-primary" />
                          <span className="font-semibold text-slate-200">
                            {app.runningStep
                              ? `Live Stream: ${app.runningStepLabel} Agent`
                              : "Agent Activity Log"}
                          </span>
                          {app.runningStep && (
                            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          {isLogExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {isLogExpanded && (
                        <div className="max-h-[160px] overflow-y-auto p-3 font-mono text-xs leading-relaxed">
                          {currentAgentLogs.length === 0 ? (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Spinner className="h-3 w-3" />
                              <span>Waiting for agent activity stream...</span>
                            </div>
                          ) : (
                            currentAgentLogs.map((log: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 py-0.5 text-slate-300">
                                <span className="text-slate-500">
                                  [{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]
                                </span>
                                <span>{log.action || log.message || JSON.stringify(log)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
