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

interface Measure {
  name: string;
  qlik_expression?: string;
  dax_expression?: string;
  dataType?: string;
  formattext?: string;
  lineageTag?: string;
  istrue?: string;
  confidence?: string;
  reason?: string;
}

interface DaxMeasures {
  [table: string]: Measure[];
}

interface MeasuresProps {
  mappingData: {
    dax_measures?: DaxMeasures;
  };
  backendToken: string;
}

const validateMeasures = async (daxMeasures: DaxMeasures, backendToken: string): Promise<any> => {
  if (!backendToken) {
    console.warn("Backend token not available for measures history validation");
    throw new Error("Authentication required");
  }
  const response = await fetch("/api/check-measures", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${backendToken}` },
    body: JSON.stringify(daxMeasures),
  });
  if (!response.ok) {
    throw new Error(`Validation failed: ${response.statusText}`);
  }
  return response.json();
};

export default function MeasureComponentHistory({ mappingData, backendToken }: MeasuresProps) {
  const [loading, setLoading] = useState(false);
  const [measures, setMeasures] = useState<DaxMeasures>({});

  useEffect(() => {
    if (!backendToken) {
      console.warn("Backend token missing; skipping measures history validation");
      setMeasures(mappingData.dax_measures || {});
      return;
    }

    const HISTORY_KEY = "HistoryResults";
    const storedApiResults = localStorage.getItem(HISTORY_KEY);

    if (!storedApiResults) {
      setMeasures(mappingData.dax_measures || {});
      return;
    }

    let historyData: any;
    try {
      historyData = JSON.parse(storedApiResults);
    } catch {
      setMeasures(mappingData.dax_measures || {});
      return;
    }

    let daxMeasures = historyData.mapping?.dax_measures || mappingData.dax_measures || {};

    const hasConfidence = Object.values(daxMeasures).some((table: any) =>
      Array.isArray(table) && table.some((m: any) => m.confidence !== undefined)
    );

    if (hasConfidence) {
      setMeasures(daxMeasures);
      return;
    }

    setLoading(true);
    validateMeasures(daxMeasures, backendToken)
      .then((apiData) => {
        if (!apiData.success) throw new Error("API returned unsuccessful response");

        const updatedDaxMeasures: DaxMeasures = {};
        Object.entries(apiData).forEach(([key, value]) => {
          if (key === "success" || key === "validated_count") return;
          if (Array.isArray(value)) {
            updatedDaxMeasures[key] = value;
          }
        });

        const updatedMapping = {
          ...historyData.mapping,
          dax_measures: updatedDaxMeasures,
        };

        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify({
            ...historyData,
            mapping: updatedMapping,
          })
        );

        setMeasures(updatedDaxMeasures);
      })
      .catch((err) => {
        console.error("Validation API error:", err);
        setMeasures(daxMeasures);
      })
      .finally(() => setLoading(false));
  }, [mappingData, backendToken]);

  const flatMeasures = Object.entries(measures).flatMap(
    ([table, list]: [string, Measure[] | undefined]) =>
      Array.isArray(list)
        ? list.map((m) => ({
            table_name: table,
            field_name: m.name,
            qlik_measure: m.qlik_expression || "N/A",
            powerbi_measure: m.dax_expression || "N/A",
            confidence: m.confidence,
            reason: m.reason || "N/A",
          }))
        : []
  );

  const getPercent = (confidence: string | null | undefined): number => {
    if (!confidence) return 0;
    const num = parseFloat(confidence.replace("%", ""));
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
  };

  const getConfidenceLabel = (percent: number): { text: string; color: string } => {
    if (percent < 60) return { text: "Incorrect Translation - Needs Attention", color: "text-red-700" };
    if (percent < 85) return { text: "Need Attention", color: "text-yellow-700" };
    return { text: "Excellent", color: "text-green-700" };
  };

  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardHeader>
          <CardTitle>Measures Mapping</CardTitle>
          <CardDescription>
            Previously validated Qlik measures mapped to Power BI DAX with AI confidence scores
          </CardDescription>
        </CardHeader>

        <CardContent className="relative">
          {/* Loading State */}
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-blue-600">
                  Validating measures and calculating confidence...
                </span>
              </div>
            </div>
          )}

          {/* No Data → Clean Message */}
          {!loading && flatMeasures.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No measures found in history.
            </p>
          )}

          {/* Has Data → Full Table */}
          {!loading && flatMeasures.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse border border-border">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center py-3 px-4 border-x border-border">Table</th>
                    <th className="text-center py-3 px-4 border-x border-border">Field</th>
                    <th className="text-center py-3 px-4 border-x border-border">Qlik</th>
                    <th className="text-center py-3 px-4 border-x border-border">Power BI</th>
                    <th className="text-center py-3 px-4 border-x border-border">Confidence</th>
                    <th className="text-center py-3 px-4 border-x border-border">Diagnostic Info</th>
                  </tr>
                  {/* <tr className="border-b border-border">
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Name</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Name</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Measure</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Measure</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Level %</th>
                    <th className="text-center py-3 px-4 whitespace-nowrap border-x border-border">Reason</th>
                  </tr> */}
                </thead>
                <tbody>
                  {flatMeasures.map((m, i) => {
                    const percent = getPercent(m.confidence);
                    const displayValue = percent === 0 ? 100 : percent;
                    const label = getConfidenceLabel(percent);

                    return (
                      <tr key={i} className="border-b border-border text-center text-sm hover:bg-muted/50">
                        <td className="border-x border-border py-2 px-1 max-w-[100px] truncate" title={m.table_name}>
                          {m.table_name}
                        </td>
                        <td className="border-x border-border py-2 px-1 max-w-[100px]  truncate break-words whitespace-pre-wrap" title={m.field_name}>
                          {m.field_name}
                        </td>
                        <td className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap text-left leading-tight" title={m.qlik_measure}>
                          {m.qlik_measure}
                        </td>
                        <td className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap text-left leading-tight" title={m.powerbi_measure}>
                          {m.powerbi_measure}
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
                          </div>
                        </td>
                        <td className="border-x border-border py-2 px-1">
                          {m.reason && m.reason !== "N/A" ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">Details</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-[500px] p-4">
                                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                  {m.reason}
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