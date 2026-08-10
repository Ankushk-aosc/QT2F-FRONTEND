"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface Dimension {
  name: string;
  expression: string;
  "Calculated Columns"?: string;
  dataType?: string;
  nature?: string;
  tables?: string[];
  confidence?: string;
  warning?: string;
  reason?: string;
}

interface UnmappedDimensionsProps {
  mappingData: any;
  backendToken: string;
  appId: string;
}

const validateDimensions = async (payload: any, backendToken: string): Promise<any> => {
  const response = await fetch("/api/check-dimensions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${backendToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error("Dimension validation failed");
  return response.json();
};

export default function CalculatedColumnComponent({
  mappingData,
  backendToken,
  appId,
}: UnmappedDimensionsProps) {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const API_RESULTS_KEY = "api_results";
    const storedApiResults = localStorage.getItem(API_RESULTS_KEY);

    if (!storedApiResults) {
      const fallback = (mappingData.dimensions?.dimensions || []) as Dimension[];
      setDimensions(fallback);
      return;
    }

    let apiResults: any[] = [];
    try {
      apiResults = JSON.parse(storedApiResults);
    } catch {
      const fallback = (mappingData.dimensions?.dimensions || []) as Dimension[];
      setDimensions(fallback);
      return;
    }

    const currentAppIndex = apiResults.findIndex((app: any) => app.appId === appId);
    if (currentAppIndex === -1) {
      const fallback = (mappingData.dimensions?.dimensions || []) as Dimension[];
      setDimensions(fallback);
      return;
    }

    const currentApp = apiResults[currentAppIndex];
    const storedDims = currentApp.mappedData?.dimensions?.dimensions as
      | Dimension[]
      | undefined;

    const hasConfidence = storedDims?.some((d: any) => d.confidence !== undefined);
    if (hasConfidence && storedDims) {
      setDimensions(storedDims);
      return;
    }

    if (!backendToken) {
      console.warn("Backend token missing — skipping dimension validation");
      setDimensions(storedDims || mappingData.dimensions?.dimensions || []);
      return;
    }

    const rawDimensions = (mappingData.dimensions?.dimensions || []) as Dimension[];

    const payload = {
      dimension_count:
        mappingData.dimensions?.dimension_count || rawDimensions.length,
      dimensions: rawDimensions.map((d) => ({
        name: d.name,
        expression: d.expression,
        dataType: d.dataType || d.nature || "unknown",
        tables: d.tables || [],
        "Calculated Columns": d["Calculated Columns"],
      })),
    };

    setLoading(true);

    validateDimensions(payload, backendToken)
      .then((apiData) => {
        if (!apiData.success || !apiData.dimensions) {
          throw new Error("Invalid API response");
        }

        const validatedDims: Dimension[] = apiData.dimensions.map((d: any) => ({
          ...d,
          confidence: d.confidence || "0%",
          warning: d.warning,
          reason: d.reason,
        }));

        const updatedMappedData = {
          ...currentApp.mappedData,
          dimensions: {
            dimension_count: apiData.dimension_count,
            dimensions: validatedDims,
          },
        };

        const updatedApp = { ...currentApp, mappedData: updatedMappedData };
        const updatedResults = [...apiResults];
        updatedResults[currentAppIndex] = updatedApp;

        localStorage.setItem(API_RESULTS_KEY, JSON.stringify(updatedResults));

        setDimensions(validatedDims);
      })
      .catch((err) => {
        console.error("Dimension validation error:", err);
        setDimensions(rawDimensions);
      })
      .finally(() => setLoading(false));
  }, [mappingData, backendToken, appId]);

  const getPercent = (confidence: string | undefined): number => {
    if (!confidence) return 0;
    const num = parseFloat(confidence.replace("%", ""));
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
  };

  const getLabel = (percent: number) => {
    if (percent < 60) return { text: "Poor", color: "text-red-700" };
    if (percent < 85) return { text: "Good", color: "text-yellow-700" };
    return { text: "Excellent", color: "text-green-700" };
  };

  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardContent className="p-0 relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-600">
                  Validating dimensions with AI...
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center py-3 px-4 border-x border-border">Field Name</th>
                  <th className="text-center py-3 px-4 border-x border-border">Qlik Expression</th>
                  <th className="text-center py-3 px-4 border-x border-border">Power BI</th>
                  <th className="text-center py-3 px-4 border-x border-border">Confidence</th>
                  <th className="text-center py-3 px-4 border-x border-border">Diagnostic Info</th>
                </tr>
                {/* <tr className="border-b border-border">
                  <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Name</th>
                  <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Expression</th>
                  <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">
                    Calculated Columns
                  </th>
                  <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">
                    Level %
                  </th>
                  <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">
                    Reason
                  </th>
                </tr> */}
              </thead>

              <tbody>
                {dimensions.length > 0 ? (
                  dimensions.map((dim, i) => {
                    const percent = getPercent(dim.confidence);
                    const displayValue = percent === 0 ? 100 : percent;
                    const label = getLabel(percent);

                    return (
                      <tr
                        key={i}
                        className="border-b border-border text-center text-sm hover:bg-muted/50 transition-colors"
                      >
                        <td className="border-x border-border py-2 px-1 max-w-[80px] truncate break-words whitespace-pre-wrap">
                          {dim.name}
                        </td>

                        <td className="border-x border-border py-2 px-1 max-w-[120px] truncate whitespace-pre-wrap">
                          {dim.expression || "—"}
                        </td>

                        <td className="border-x border-border py-2 px-1 max-w-[120px] truncate whitespace-pre-wrap">
                          {dim["Calculated Columns"] ? (
                            <span className="px-2 py-1 rounded">{dim["Calculated Columns"]}</span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>

                        <td className="border-x border-border text-center py-2 px-1 w-[100px]">
                          <div className="flex flex-col items-center justify-center">
                            <div style={{ width: 40, height: 40 }}>
                              <CircularProgressbar
                                value={displayValue}
                                text={percent.toString()}
                                styles={buildStyles({
                                  textSize: "28px",
                                  pathTransitionDuration: 0.8,
                                  pathColor:
                                    percent < 60
                                      ? "#ef4444"
                                      : percent < 85
                                      ? "#facc15"
                                      : "#22c55e",
                                  textColor: "#111827",
                                  trailColor: "#e5e7eb",
                                })}
                              />
                            </div>
                            <div className={`mt-1 text-[11px] font-semibold ${label.color}`}>
                              {label.text}
                            </div>
                            {dim.warning && (
                              <div className="mt-1 text-[10px] text-orange-600 italic max-w-[90px] text-center">
                                {dim.warning}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="border-x border-border text-center py-2 px-1">
                          {dim.reason ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Details
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-[500px] p-4">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                  {dim.reason}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-muted-foreground text-sm border-x border-border"
                    >
                      No dimensions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
