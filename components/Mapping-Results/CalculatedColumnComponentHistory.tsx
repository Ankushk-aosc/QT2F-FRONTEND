"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

interface DimensionsData {
  dimension_count?: number;
  dimensions: Dimension[];
}

interface CalculatedColumnHistoryProps {
  mappingData: {
    dimensions?: DimensionsData;
  };
  backendToken: string;
}

// Fixed: added backendToken parameter
const validateDimensions = async (payload: any, backendToken: string): Promise<any> => {
  if (!backendToken) {
    console.warn("Backend token not available for calculated columns history validation");
    throw new Error("Authentication required");
  }
  const response = await fetch("/api/check-dimensions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${backendToken}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Dimension validation failed");
  return response.json();
};

export default function CalculatedColumnComponentHistory({
  mappingData,
  backendToken,
}: CalculatedColumnHistoryProps) {
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  useEffect(() => {
    const HISTORY_KEY = "HistoryResults";
    const stored = localStorage.getItem(HISTORY_KEY);

    // If no history → fallback to props
    if (!stored) {
      setDimensions(mappingData.dimensions?.dimensions || []);
      return;
    }

    let historyData: any;
    try {
      historyData = JSON.parse(stored);
    } catch {
      setDimensions(mappingData.dimensions?.dimensions || []);
      return;
    }

    const storedDims = historyData.mapping?.dimensions?.dimensions as Dimension[] | undefined;
    const rawDims = mappingData.dimensions?.dimensions || [];

    // Use cached validated data if available
    const hasConfidence = storedDims?.some((d: any) => d.confidence !== undefined);
    if (hasConfidence && storedDims) {
      setDimensions(storedDims);
      return;
    }

    // First-time validation
    const payload = {
      dimension_count: historyData.mapping?.dimensions?.dimension_count || rawDims.length,
      dimensions: rawDims.map((d: any) => ({
        name: d.name,
        expression: d.expression || d["Calculated Columns"] || "",
        dataType: d.dataType || d.nature || "unknown",
        tables: d.tables || [],
        "Calculated Columns": d["Calculated Columns"],
      })),
    };

    setLoading(true);
    validateDimensions(payload, backendToken)
      .then((apiData) => {
        if (!apiData.success || !apiData.dimensions) throw new Error("Invalid API response");

        const validatedDims: Dimension[] = apiData.dimensions.map((d: any) => ({
          ...d,
          confidence: d.confidence || "0%",
          warning: d.warning,
          reason: d.reason,
        }));

        // Persist validated data back to history
        const updatedMapping = {
          ...historyData.mapping,
          dimensions: {
            dimension_count: apiData.dimension_count,
            dimensions: validatedDims,
          },
        };

        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify({
            ...historyData,
            mapping: updatedMapping,
          })
        );

        setDimensions(validatedDims);
      })
      .catch((err) => {
        console.error("Calculated column history validation error:", err);
        setDimensions(rawDims);
      })
      .finally(() => setLoading(false));
  }, [mappingData, backendToken]);

  const getPercent = (c?: string) => {
    if (!c) return 0;
    const num = parseFloat(c.replace("%", ""));
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
  };

  const getLabel = (p: number) => {
    if (p < 60) return { text: "Poor", color: "text-red-700" };
    if (p < 85) return { text: "Good", color: "text-yellow-700" };
    return { text: "Excellent", color: "text-green-700" };
  };

  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardHeader>
          <CardTitle>Calculated Columns & Dimensions (History)</CardTitle>
          <CardDescription>
            Previously validated Qlik script-based fields mapped to Power BI calculated columns
          </CardDescription>
        </CardHeader>

        <CardContent className="relative">
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-600">
                  Validating dimensions with AI...
                </span>
              </div>
            </div>
          )}

          {/* No data → clean message */}
          {!loading && dimensions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No calculated columns or dimensions found in history.
            </p>
          )}

          {/* Has data → full table */}
          {!loading && dimensions.length > 0 && (
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
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Calculated Column</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Level %</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Reason</th>
                  </tr> */}
                </thead>
                <tbody>
                  {dimensions.map((dim, i) => {
                    const percent = getPercent(dim.confidence);
                    const displayValue = percent === 0 ? 100 : percent;
                    const label = getLabel(percent);

                    return (
                      <tr key={i} className="border-b border-border text-center text-sm hover:bg-muted/50">
                        <td className="border-x border-border py-2 px-1 max-w-[100px] truncate" title={dim.name}>
                          {dim.name}
                        </td>
                        <td className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap text-left">
                          {dim.expression || "—"}
                        </td>
                        <td className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap text-left">
                          {dim["Calculated Columns"] ? (
                            <span className="font-medium text-green-700">
                              {dim["Calculated Columns"]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="border-x border-border py-2 px-1 w-[110px]">
                          <div className="flex flex-col items-center">
                            <div style={{ width: 40, height: 40 }}>
                              <CircularProgressbar
                                value={displayValue}
                                text={percent.toString()}
                                styles={buildStyles({
                                  textSize: "28px",
                                  pathColor: percent < 60 ? "#ef4444" : percent < 85 ? "#facc15" : "#22c55e",
                                  textColor: "#111827",
                                  trailColor: "#e5e7eb",
                                })}
                              />
                            </div>
                            <div className={`mt-1 text-[11px] font-semibold ${label.color}`}>
                              {label.text}
                            </div>
                            {dim.warning && (
                              <div className="mt-1 text-[10px] text-orange-600 max-w-[100px]">
                                {dim.warning}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="border-x border-border py-2 px-1">
                          {dim.reason ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">Details</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-[500px] p-4">
                                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}