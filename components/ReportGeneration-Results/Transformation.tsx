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
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TransformationProps {
  folderName: string;
  backendToken: string; // Required for auth
}

interface FabricTable {
  conversion_steps?: string[];
}

interface QlikTable {
  loadScript?: any;
  table_name?: string;
  query?: string;
}

interface ValidationResult {
  confidence: string;
  reason: string;
  warning?: string;
}

export default function Transformation({ folderName, backendToken }: TransformationProps) {
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

  // Sync status
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>("");

  const BASE_URL = process.env.NEXT_PUBLIC_CONVERSION_URL || "";

  /** ----------------------------
   *  FETCH SYNC STATUS (Authenticated)
   * ---------------------------- */
  const fetchSyncStatus = async () => {
    if (!folderName || folderName === "Unknown Folder" || !backendToken) {
      setSyncStatus("success");
      setSyncMessage("");
      return;
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_SQL_BASE_URL ;

      const response = await fetch(
        `${baseUrl}/run-history/by-folder/${encodeURIComponent(folderName)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${backendToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.warn("Sync status fetch failed:", response.status);
        setSyncStatus("success");
        return;
      }

      const data = await response.json();
      let runDetails: any = {};

      if (Array.isArray(data) && data.length > 0) {
        const sorted = data.sort(
          (a: any, b: any) =>
            new Date(b.timestamp || b.created_at).getTime() -
            new Date(a.timestamp || a.created_at).getTime()
        );
        runDetails = sorted[0];
      } else {
        runDetails = data || {};
      }

      setSyncStatus(runDetails.devops_fabric_sync_status || "success");
      setSyncMessage(runDetails.devops_fabric_sync_message || "");
    } catch (error) {
      console.error("Error fetching sync status:", error);
      setSyncStatus("success");
      setSyncMessage("");
    }
  };

  /** ----------------------------
   *  NORMALIZE TABLE NAME
   * ---------------------------- */
  const normalize = (name: string): string => {
    return name.replace(/[_ ]/g, "").toUpperCase();
  };

  /** ----------------------------
   *  EXTRACT QLIK TABLES FROM localStorage
   * ---------------------------- */
  const extractTables = (parsed: any): QlikTable[] => {
    if (!parsed) return [];

    const candidates = [
      parsed.table_details?.tables,
      parsed.mappedData?.table_details?.tables,
      parsed.tableDetails?.tables,
      parsed.parsedData?.table_details?.tables,
      parsed[0]?.table_details?.tables,
      parsed.table_details,
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (Array.isArray(c)) return c;
      if (typeof c === "object") return Object.values(c) as QlikTable[];
    }
    return [];
  };

 /** ----------------------------
 *  LOAD QLIK QUERIES (polling from localStorage)
 * ---------------------------- */
const loadQlikQueries = useCallback(() => {
  if (typeof window === "undefined") return;

  try {
    const possibleKeys = ["api_results", "mappedData", "mapped_data", "apiResults"];
    let raw: string | null = null;

    for (const key of possibleKeys) {
      const v = localStorage.getItem(key);
      if (v) {
        raw = v;
        break;
      }
    }

    if (!raw) return;

    const parsed = JSON.parse(raw);
    let appObj: any = parsed;

    // Case 1: parsed is an array of results
    if (Array.isArray(parsed)) {
      appObj =
        parsed.find(
          (a: any) =>
            a?.folderName === folderName ||
            a?.appId === folderName ||
            a?.appName === folderName
        ) || parsed[0];
    }
    // Case 2: parsed is an object that contains an array somewhere
    else {
      const nestedArray = Object.values(parsed).find(
        (v: any) =>
          Array.isArray(v) && v.length && (v[0].appId || v[0].appName)
      );

      if (nestedArray && Array.isArray(nestedArray)) {
        appObj =
          nestedArray.find(
            (a: any) =>
              a?.folderName === folderName ||
              a?.appId === folderName ||
              a?.appName === folderName
          ) || nestedArray[0];
      }
    }

    // Extract tables from the found app object
    const tables: QlikTable[] = extractTables(appObj);
    if (!tables.length) return;

    // Build normalized map of table → query
    const map: Record<string, string> = {};
    tables.forEach((t) => {
      const tableName = t?.table_name || "";
      const query = t?.query || t?.loadScript || "";
      if (tableName && query) {
        map[normalize(tableName)] = query.trim();
      }
    });

    setQlikQueries(map);
  } catch (e) {
    console.error("ERROR in loadQlikQueries:", e);
  }
}, [folderName]);

  /** ----------------------------
   *  FETCH FABRIC TABLES
   * ---------------------------- */
useEffect(() => {
  if (!folderName || folderName === "Unknown Folder") {
    setLoading(false);
    return;
  }

  let cancelled = false;

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/fetch/fetch-tables?folder_name=${encodeURIComponent(folderName)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${backendToken}`, // pass your token here
          },
        }
      );

      if (!res.ok) throw new Error(`Failed to fetch tables: ${res.status}`);

      const data = await res.json();

      if (!cancelled) {
        setFabricTables(data.tables || {});
      }
    } catch (err) {
      console.error("Error fetching Fabric tables:", err);
      if (!cancelled) setFabricTables({});
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  fetchTables();
  return () => {
    cancelled = true;
  };
}, [folderName, BASE_URL, backendToken]);


  /** ----------------------------
   *  FETCH SYNC STATUS
   * ---------------------------- */
  useEffect(() => {
    fetchSyncStatus();
  }, [folderName, backendToken]);

  /** ----------------------------
   *  POLL QLIK QUERIES
   * ---------------------------- */
  useEffect(() => {
    loadQlikQueries();
    const interval = setInterval(loadQlikQueries, 1500);
    return () => clearInterval(interval);
  }, [loadQlikQueries]);

  /** ----------------------------
   *  AUTO-SELECT FIRST TABLE
   * ---------------------------- */
  useEffect(() => {
    if (selectedTable) return;

    const fabricNames = Object.keys(fabricTables);
    if (!fabricNames.length) return;

    const firstWithQuery = fabricNames.find((name) => qlikQueries[normalize(name)]);
    setSelectedTable(firstWithQuery || fabricNames[0]);
  }, [fabricTables, qlikQueries, selectedTable]);

  /** ----------------------------
   *  VALIDATE QUERY ON FABRIC TAB
   * ---------------------------- */
  useEffect(() => {
    if (activeTab !== "fabric" || !selectedTable || validationResults[selectedTable]) return;
    validateSelectedQuery();
  }, [activeTab, selectedTable]);

  const validateSelectedQuery = async () => {
    if (!selectedTable || validating) return;

    const queryText = fabricTables[selectedTable]?.conversion_steps?.join("\n");
    if (!queryText) return;

    setValidating(true);
    try {
      const response = await fetch("/api/check-query", {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${backendToken}`,  // 🔥 Add this
},
        body: JSON.stringify({ [selectedTable]: queryText }),
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

  /** ----------------------------
   *  HELPERS
   * ---------------------------- */
  const hasQlikQuery = (table: string) => !!qlikQueries[normalize(table)];
  const getQlikQuery = (table: string) => qlikQueries[normalize(table)] || "";

  const getConfidenceColor = (conf: string) => {
    const num = parseInt(conf.replace("%", ""));
    if (num >= 90) return "bg-green-100 text-green-800 border-green-200";
    if (num >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  /** ----------------------------
   *  MEMOIZED CONTENT (no re-renders)
   * ---------------------------- */
  const QlikContent = useMemo(() => {
    const Component = React.memo(() => (
      <div>
        <h3 className="text-lg font-bold text-blue-700 mb-4">Qlik Load Script</h3>
        {hasQlikQuery(selectedTable) ? (
          <pre className="p-6 rounded-lg text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96 border bg-gray-50">
            {getQlikQuery(selectedTable)}
          </pre>
        ) : (
          <p className="text-red-600 font-medium">No Qlik query available for this table.</p>
        )}
      </div>
    ));
    Component.displayName = "QlikContent";
    return Component;
  }, [selectedTable, qlikQueries]);

  const FabricContent = useMemo(() => {
    const Component = React.memo(() => {
        const result = validationResults[selectedTable];

        const openDetails = () => {
          setCurrentDetails(result || null);
          setDialogOpen(true);
        };

        return (
          <div>
            <h3 className="text-lg font-bold text-green-700 mb-3">Fabric Transformation Steps</h3>

            {result && (
              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-medium text-gray-600">Confidence:</span>
                <Badge className={`${getConfidenceColor(result.confidence)} font-semibold`}>
                  {result.confidence}
                </Badge>
                <Button onClick={openDetails} size="sm" variant="outline">
                  Details
                </Button>
              </div>
            )}

            {fabricTables[selectedTable]?.conversion_steps?.length ? (
              <pre className="p-6 rounded-lg text-xs font-mono whitespace-pre-wrap break-all overflow-auto max-h-96 border bg-gray-50">
                {fabricTables[selectedTable].conversion_steps?.join("\n")}
              </pre>
            ) : (
              <p className="text-muted-foreground">No transformation steps available.</p>
            )}

            {validating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating query...
              </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Validation Details — {selectedTable}</DialogTitle>
                  <DialogDescription>AI analysis of the M query</DialogDescription>
                </DialogHeader>
                {currentDetails && (
                  <div className="space-y-6 mt-6">
                    <div className="flex items-center gap-3">
                      <strong>Confidence:</strong>
                      <Badge className={getConfidenceColor(currentDetails.confidence)}>
                        {currentDetails.confidence}
                      </Badge>
                    </div>
                    <div>
                      <strong className="text-lg">Reason:</strong>
                      <div className="mt-3 p-5 bg-muted rounded-lg text-sm whitespace-pre-wrap">
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
          </div>
        );
    });
    Component.displayName = "FabricContent";
    return Component;
  }, [selectedTable, fabricTables, validationResults, validating, dialogOpen]);

  /** ----------------------------
   *  RENDER
   * ---------------------------- */
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Data Transformation</CardTitle>
        <CardDescription>
          Select a Fabric table to view its corresponding Qlik load script and AI-validated M query.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sync Failure Alert */}
        {syncStatus === "deleted" && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Sync to Fabric Failed</p>
              <p className="text-sm text-red-700 mt-1">
                {syncMessage || "An unknown error occurred during sync."}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p>Loading transformation data...</p>
          </div>
        ) : (
          <>
            {/* Table Selector */}
            <div className="mb-6">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full max-w-2xl px-4 py-3 rounded-lg border border-gray-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Select a table
                </option>
                {Object.keys(fabricTables)
                  .sort()
                  .map((name) => (
                   <option key={name} value={name}>
  {name}
</option>

                  ))}
              </select>
            </div>

            {selectedTable ? (
              <>
                {/* View Mode Toggle */}
                <div className="flex justify-end mb-6">
                  <Button
                    variant="outline"
                    onClick={() => setViewMode(viewMode === "sideBySide" ? "tabs" : "sideBySide")}
                  >
                    {viewMode === "sideBySide" ? "Switch to Tabs" : "View Side by Side"}
                  </Button>
                </div>

                {/* Content */}
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
                        className={`px-8 py-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "qlik"
                            ? "border-blue-600 text-blue-700 bg-white"
                            : "border-transparent text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Qlik Script
                      </button>
                      <button
                        onClick={() => setActiveTab("fabric")}
                        className={`px-8 py-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === "fabric"
                            ? "border-green-600 text-green-700 bg-white"
                            : "border-transparent text-gray-600 hover:text-gray-800"
                        }`}
                      >
                        Power BI M Query
                      </button>
                    </div>
                    <div className="p-6 bg-white">
                      {activeTab === "qlik" ? <QlikContent /> : <FabricContent />}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg">No tables found or none loaded yet.</p>
                <p className="text-sm mt-2">Select an app and complete migration to see transformations.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}