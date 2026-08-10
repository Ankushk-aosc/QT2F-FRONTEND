"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TransformationHistoryProps {
  folderName: string;
  backendToken?: string; // Add this
}

interface FabricTable {
  conversion_steps?: string[];
}

interface ValidationResult {
  confidence: string;
  reason: string;
  warning?: string;
}

export default function TransformationHistory({ folderName, backendToken }: TransformationHistoryProps) {
  const [fabricTables, setFabricTables] = useState<Record<string, FabricTable>>({});
  const [qlikQueries, setQlikQueries] = useState<Record<string, string>>({});
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [activeTab, setActiveTab] = useState<"qlik" | "fabric">("qlik");
  const [viewMode, setViewMode] = useState<"tabs" | "sideBySide">("tabs");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentDetails, setCurrentDetails] = useState<ValidationResult | null>(null);

  const normalize = (name: string): string => name.replace(/[_ ]/g, "").toUpperCase();

  // Load historical Qlik queries from HistoryResults
  const loadHistoricalQlikQueries = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("HistoryResults");
      if (!raw) return setQlikQueries({});

      const parsed = JSON.parse(raw);
      const tablesArray =
        parsed?.mapping?.table_details?.tables ||
        parsed?.mapping?.tableDetails?.tables ||
        parsed?.table_details?.tables ||
        [];

      if (!Array.isArray(tablesArray) || tablesArray.length === 0) return setQlikQueries({});

      const map: Record<string, string> = {};
      tablesArray.forEach((t: any) => {
        const tableName = t?.table_name || t?.tableName || "";
        const query = t?.loadScript || t?.query || "";
        if (tableName && query) {
          map[normalize(tableName)] = query.trim();
        }
      });
      setQlikQueries(map);
    } catch (e) {
      console.error("Failed to load historical Qlik queries:", e);
      setQlikQueries({});
    }
  }, []);

  // Fetch Fabric tables
  useEffect(() => {
    if (!backendToken) return;
    if (!folderName || folderName === "Unknown Folder") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    console.info(`backendtoken: ${backendToken}`)
    const fetchFabric = async () => {
      setLoading(true);
      try {
        
        const res = await fetch(
          `/api/fetch-tables?folder_name=${encodeURIComponent(folderName)}`,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${backendToken}`,
            },
          }
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!cancelled) setFabricTables(data.tables || {});
      } catch (err) {
        console.error("Fabric fetch error:", err);
        if (!cancelled) setFabricTables({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFabric();
    return () => {
      cancelled = true;
    };
  }, [folderName,backendToken]);

  // Load Qlik history
  useEffect(() => {
    loadHistoricalQlikQueries();
  }, [loadHistoricalQlikQueries]);

  // Auto-select first table
  useEffect(() => {
    if (selectedTable) return;
    const fabricNames = Object.keys(fabricTables);
    if (fabricNames.length === 0) return;
    setSelectedTable(fabricNames.sort()[0]);
  }, [fabricTables]);

  // Validate query when Fabric is visible
  const validateSelectedQuery = async () => {
    if (!selectedTable || validating || validationResults[selectedTable] || !backendToken) return;

    const steps = fabricTables[selectedTable]?.conversion_steps;
    if (!steps?.length) return;

    setValidating(true);
    try {
      const response = await fetch("/api/check-query", {
        method: "POST",
        headers: { "Content-Type": "application/json",
          "Authorization": `Bearer ${backendToken}`
         },
        body: JSON.stringify({ [selectedTable]: steps.join("\n") }),
      });

      if (!response.ok) throw new Error("Validation failed");
      const data = await response.json();

      if (data[selectedTable]) {
        setValidationResults((prev) => ({
          ...prev,
          [selectedTable]: data[selectedTable],
        }));
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if ((activeTab === "fabric" || viewMode === "sideBySide") && selectedTable) {
      validateSelectedQuery();
    }
  }, [activeTab, viewMode, selectedTable]);

  const hasQlikQuery = (name: string) => !!qlikQueries[normalize(name)];
  const getQlikQuery = (name: string) => qlikQueries[normalize(name)] || "";
  const hasFabricSteps = (name: string) => (fabricTables?.[name]?.conversion_steps?.length ?? 0) > 0;

  const getConfidenceColor = (conf: string) => {
    const num = parseInt(conf.replace("%", ""));
    if (num >= 90) return "bg-green-100 text-green-800 border-green-200";
    if (num >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const openDetails = useCallback((result: ValidationResult) => {
    setCurrentDetails(result);
    setDialogOpen(true);
  }, []);

  // Memoized content
  const QlikContent = useMemo(() => {
    const Component = React.memo(() => (
      <div>
        <h3 className="text-lg font-bold text-blue-700 mb-4">Qlik Load Script</h3>
        {hasQlikQuery(selectedTable) ? (
          <pre className="p-6 rounded-lg text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96 border bg-gray-50">
            {getQlikQuery(selectedTable)}
          </pre>
        ) : (
          <p className="text-red-600 font-medium">No original Qlik script found in history.</p>
        )}
      </div>
    ));
    Component.displayName = "QlikContent";
    return Component;
  }, [selectedTable]);

  const FabricContent = useMemo(() => {
    const Component = React.memo(() => {
        const result = validationResults[selectedTable];

        return (
          <div>
            <h3 className="text-lg font-bold text-green-700 mb-3">
              Fabric Transformation Steps
            </h3>

            {result && (
              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-medium text-gray-600">
                  Transformation Confidence:
                </span>
                <Badge className={`${getConfidenceColor(result.confidence)} font-semibold px-3 py-1`}>
                  {result.confidence}
                </Badge>
                <Button onClick={() => openDetails(result)} size="sm" variant="outline">
                  Details
                </Button>
              </div>
            )}

            {hasFabricSteps(selectedTable) ? (
              <pre className="p-6 rounded-lg text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96 border bg-gray-50">
                {fabricTables[selectedTable].conversion_steps!.join("\n")}
              </pre>
            ) : (
              <p className="text-muted-foreground">No transformation steps recorded.</p>
            )}

            {validating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating query...
              </div>
            )}
          </div>
        );
    });
    Component.displayName = "FabricContent";
    return Component;
  }, [selectedTable, validationResults, validating, fabricTables, openDetails]);

  const tableOptions = Array.from(
    new Set([
      ...Object.keys(fabricTables),
      ...Object.keys(qlikQueries)
        .map((norm) => Object.keys(fabricTables).find((n) => normalize(n) === norm))
        .filter(Boolean) as string[],
    ])
  ).sort();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Transformation History</CardTitle>
        <CardDescription>
          View past Qlik to Fabric conversions with AI-powered confidence scoring.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Loading history...</p>
        ) : tableOptions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No transformation history found.
          </p>
        ) : (
          <>
            <div className="mb-6">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full max-w-lg px-4 py-3 rounded-lg border border-gray-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Select a table
                </option>
                {tableOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                    {!hasQlikQuery(name) && " (no Qlik)"}
                    {!hasFabricSteps(name) && " (no Fabric)"}
                  </option>
                ))}
              </select>
            </div>

            {selectedTable && (
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setViewMode(viewMode === "sideBySide" ? "tabs" : "sideBySide")}
                    className="px-4 py-2 text-sm font-medium rounded-md border bg-white hover:bg-gray-50 transition"
                  >
                    {viewMode === "sideBySide" ? "Switch to Tabs" : "View Side by Side"}
                  </button>
                </div>

                {viewMode === "sideBySide" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <QlikContent />
                    <FabricContent />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex bg-gray-50 border-b">
                      <button
                        onClick={() => setActiveTab("qlik")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "qlik"
                            ? "border-blue-500 text-blue-700 bg-white"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Qlik Script
                      </button>
                      <button
                        onClick={() => setActiveTab("fabric")}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "fabric"
                            ? "border-green-500 text-green-700 bg-white"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Power BI M Query
                      </button>
                    </div>
                    <div className="p-6">
                      {activeTab === "qlik" ? <QlikContent /> : <FabricContent />}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>

      {/* Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validation Details — {selectedTable}</DialogTitle>
            <DialogDescription>AI-powered analysis of the M query</DialogDescription>
          </DialogHeader>
          {currentDetails && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center gap-3">
                <strong>Confidence Level:</strong>
                <Badge className={getConfidenceColor(currentDetails.confidence)} variant="outline">
                  {currentDetails.confidence}
                </Badge>
              </div>
              <div>
                <strong className="text-lg">Reason:</strong>
                <div className="mt-3 p-5 bg-muted rounded-lg text-sm whitespace-pre-wrap font-medium">
                  {currentDetails.reason}
                </div>
              </div>
              {currentDetails.warning && (
                <div>
                  <strong className="text-yellow-700 text-lg">Warning:</strong>
                  <div className="mt-3 p-5 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm whitespace-pre-wrap">
                    {currentDetails.warning}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}