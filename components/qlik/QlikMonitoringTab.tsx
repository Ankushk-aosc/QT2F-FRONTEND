"use client";

import React, { useMemo } from "react";
import { useQlikStore } from "@/stores/qlikStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function QlikMonitoringTab() {
  const { apps, processStates, activities } = useQlikStore();

  const activeApps = useMemo(() => {
    return apps.map((app) => {
      const states = processStates[app.id] || {};
      const steps = ["assessment", "parsing", "mapping", "reportGeneration"] as const;
      
      const completedCount = steps.filter((step) => {
        const s = states[step]?.status?.toLowerCase();
        return s === "completed" || s === "success" || s === "done";
      }).length;

      const hasFailed = steps.some((step) => {
        const s = states[step]?.status?.toLowerCase();
        return s === "failed" || s === "error";
      });

      const runningStep = steps.find((step) => states[step]?.status?.toLowerCase() === "running");

      const progress = (completedCount / steps.length) * 100;

      let status = "Pending";
      let statusColor: "default" | "success" | "warning" | "destructive" | "secondary" = "secondary";

      if (hasFailed) {
        status = "Failed";
        statusColor = "destructive";
      } else if (completedCount === steps.length) {
        status = "Completed";
        statusColor = "success";
      } else if (runningStep) {
        status = `Running ${runningStep.charAt(0).toUpperCase() + runningStep.slice(1)}`;
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
        runningStep,
        states,
      };
    });
  }, [apps, processStates]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>Qlik Sense Migrations Monitor</h2>
      {activeApps.length === 0 ? (
        <Card>
          <CardContent style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
            No Qlik Sense applications are currently loaded in the queue. Go to the Migration tab to select and run migrations.
          </CardContent>
        </Card>
      ) : (
        activeApps.map((app) => (
          <Card key={app.id}>
            <CardHeader style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <CardTitle>{app.name}</CardTitle>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  App ID: {app.id}
                </div>
              </div>
              <Badge variant={app.statusColor}>{app.status}</Badge>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ width: "100%", backgroundColor: "#e2e8f0", borderRadius: "9999px", height: "8px", overflow: "hidden" }}>
                <div
                  style={{
                    backgroundColor: app.statusColor === "destructive" ? "#ef4444" : app.statusColor === "success" ? "#22c55e" : "#3b82f6",
                    width: `${app.progress}%`,
                    height: "100%",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {app.runningStep && (
                <div style={{ backgroundColor: "#0f172a", borderRadius: "6px", padding: "12px", color: "#38bdf8", fontFamily: "monospace", fontSize: "12px", maxHeight: "150px", overflowY: "auto" }}>
                  <div style={{ color: "#94a3b8", marginBottom: "4px" }}>
                    &gt; Console log for {app.runningStep} agent:
                  </div>
                  {(activities[app.id]?.[app.runningStep] || []).length === 0 ? (
                    <div style={{ color: "#64748b" }}>Waiting for logs...</div>
                  ) : (
                    (activities[app.id]?.[app.runningStep] || []).map((log: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: "2px" }}>
                        [{new Date(log.timestamp || Date.now()).toLocaleTimeString()}] {log.action || log.message}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
