"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertCircle, Clock, Search, ChevronDown, ChevronRight, RefreshCw, ChevronLeft, X } from "lucide-react";
import { isToday, isYesterday, isThisWeek, format, parseISO } from "date-fns";
import { getSqlBaseUrl, warnSqlBaseUrlMissing } from "@/lib/publicConfig";
import { useQlikToast } from "@/hooks/useQlikToast";
import AssessmentResults from "@/components/Assessment-Results/AssessmentResultsHistory";
import ParsingResults from "@/components/Parsing-Results/ParsingResultsHistory";
import MappingResults from "@/components/Mapping-Results/MappingResultsHistory";
import ReportGenerationResults from "@/components/ReportGeneration-Results/ReportGenerationResultsHistory";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { resolveUserEmail } from "@/lib/userEmail";
import { useAuthStore } from "@/stores/auth.store";
import { AssessmentData, MappedData, ParsedData, ReportGenerationData } from "@/types/assessment";

interface RunHistoryItem {
  id: string;
  application: string;
  folderName: string;
  status: "success" | "failed" | "in_progress";
  startTime: string;
  endTime?: string;
  duration?: string;
  sourceSpace: string;
  targetWorkspace: string;
  processedItems: number;
  errors: number;
  reportUrl?: string;
  unbuildingStatus?: string;
  assessmentStatus?: string;
  parsingStatus?: string;
  mappingStatus?: string;
  reportGenerationStatus?: string;
  unbuildingMessage?: string;
  assessmentMessage?: string;
  parsingMessage?: string;
  mappingMessage?: string;
  reportGenerationMessage?: string;
  timeoutMessage?: string;
}

interface TimeGroup {
  title: string;
  runs: RunHistoryItem[];
}

// Reusable Static Badge – No hover, no transition, same color always
const StaticBadge = ({ children, color }: { children: React.ReactNode; color: "green" | "red" | "blue" }) => {
  const colors = {
    green: "bg-green-500 text-white hover:bg-green-500 hover:text-white",
    red: "bg-red-500 text-white hover:bg-red-500 hover:text-white",
    blue: "bg-blue-500 text-white hover:bg-blue-500 hover:text-white",
  };

  return (
    <Badge className={`${colors[color]} transition-none text-xs font-medium px-2 py-0.5`}>
      {children}
    </Badge>
  );
};

const removeTimestampFromFolderName = (folderName: string): string => {
  if (!folderName) return "Unknown";
  let cleanedName = folderName
    .replace(/_?\d{8}_\d{6}/g, "")
    .replace(/_?\d{8}/g, "")
    .replace(/_?\d{4}-\d{2}-\d{2}/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
  return cleanedName.trim() || "Unknown";
};

interface AppRunResultsProps {
  folderName: string;
  appName: string;
  // NEW: for showing parsing/mapping errors from rundetails
  parsingStatus?: string;
  parsingMessage?: string;
  mappingStatus?: string;
  mappingMessage?: string;
  backendToken: string; // Add this
}

const AppRunResults: React.FC<AppRunResultsProps> = ({
  folderName,
  appName,
  parsingStatus,
  parsingMessage,
  mappingStatus,
  mappingMessage,
  backendToken,

}) => {
  const toast = useQlikToast();
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [parsingData, setParsingData] = useState<ParsedData | null>(null);
  const [mappingData, setMappingData] = useState<MappedData | null>(null);
  const [reportGenData, setReportGenData] = useState<ReportGenerationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const [assessmentJson, parsingJson, mappingJson, reportGenJson] = await Promise.all([
          fetchWithAuth<any>(`/api/qlik/history-results?type=assessment&folder=${encodeURIComponent(folderName)}`).catch(() => null),
          fetchWithAuth<any>(`/api/qlik/history-results?type=parsing&folder=${encodeURIComponent(folderName)}`).catch(() => null),
          fetchWithAuth<any>(`/api/qlik/history-results?type=mapping&folder=${encodeURIComponent(folderName)}`).catch(() => null),
          fetchWithAuth<any>(`/api/qlik/history-results?type=report-generation&folder=${encodeURIComponent(folderName)}`).catch(() => null),
        ]);

        setAssessmentData(assessmentJson ? (assessmentJson[0]?.assessment_result || assessmentJson?.assessment_result || assessmentJson) as AssessmentData : null);
        setParsingData(parsingJson ? (parsingJson[0]?.parsing_result || parsingJson?.parsing_result || parsingJson) as ParsedData : null);
        setMappingData(mappingJson ? (mappingJson[0]?.mapping_result || mappingJson?.mapping_result || mappingJson) as MappedData : null);
        setReportGenData(reportGenJson ? (reportGenJson[0]?.report_result || reportGenJson?.report_result || reportGenJson) as ReportGenerationData : null);

        const historyResults = {
          assessment: assessmentJson ? assessmentJson[0]?.assessment_result : null,
          parsing: parsingJson ? parsingJson[0]?.parsing_result : null,
          mapping: mappingJson ? mappingJson[0]?.mapping_result : null,
          "report-generation": reportGenJson ? reportGenJson[0]?.report_result : null,
        };

        localStorage.setItem("HistoryResults", JSON.stringify(historyResults));
      } catch (error) {
        console.error("Error fetching run results:", error);
        toast.error(`Failed to load results for ${folderName}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (folderName) fetchResults();
  }, [folderName]);

  if (isLoading) {
    return <p className="text-center">Loading results...</p>;
  }

  if (!assessmentData && !parsingData && !mappingData && !reportGenData) {
    return <p className="text-center text-red-500">No results available for {folderName}</p>;
  }

  console.log("mappingMessage:", mappingMessage);
  return (
    <div>
      <Tabs defaultValue="assessment" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="assessment">Assessment Results</TabsTrigger>
          <TabsTrigger value="parsing">Parsing Results</TabsTrigger>
          <TabsTrigger value="mapping">Mapping Results</TabsTrigger>
          <TabsTrigger value="reportGeneration">Report Generation Results</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment">
          {assessmentData ? (
            <AssessmentResults key={folderName} data={assessmentData} />
          ) : (
            <p className="text-lg text-muted-foreground">No assessment results available.</p>
          )}
        </TabsContent>

        <TabsContent value="parsing">
          {parsingData ? (
            <ParsingResults key={folderName} data={parsingData} />
          ) : parsingStatus &&
            ["failed", "error"].includes(parsingStatus.toLowerCase()) &&
            parsingMessage ? (
            <p className="text-sm text-red-600">
              <span className="font-semibold">Parsing:</span> {parsingMessage}
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">No parsing results available.</p>
          )}
        </TabsContent>

        <TabsContent value="mapping">
          {mappingStatus &&
          ["failed", "error", "partial_success"].includes(mappingStatus.toLowerCase()) &&
          mappingMessage ? (
            // 🔧 PRIORITIZE error / partial success over showing MappingResults
            <p className="text-sm text-red-600">
              <span className="font-semibold">Mapping:</span> {mappingMessage}
            </p>
          ) : mappingData ? (
            <MappingResults key={folderName} appId={folderName}  backendToken={backendToken} mappingData={mappingData} />
          ) : (
            <p className="text-lg text-muted-foreground">No mapping results available.</p>
          )}
        </TabsContent>

        <TabsContent value="reportGeneration">
          {reportGenData ? (
            <ReportGenerationResults key={folderName} isLoading={false} backendToken={backendToken}  />
          ) : (
            <p className="text-lg text-muted-foreground">No report generation results available.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const RunHistory: React.FC<{ backendToken: string }> = ({ backendToken }) => {
  const { accounts } = useMsal();
  const toast = useQlikToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(["today", "yesterday"]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RunHistoryItem | null>(null);

  const fetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const baseUrl = getSqlBaseUrl();

  const calculateDuration = (startTime?: string, endTime?: string): string | undefined => {
    if (!startTime || !endTime) return undefined;
    try {
      const start = parseISO(startTime);
      const end = parseISO(endTime);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs < 0) return undefined;
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    } catch {
      return undefined;
    }
  };

  const parseFolderTimestamp = (folderName: string): string | null => {
    const match = folderName.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    if (!match) return null;
    const [, yStr, mStr, dStr, hStr, minStr, sStr] = match;
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const hour = Number(hStr);
    const minute = Number(minStr);
    const second = Number(sStr);

    let offsetHours = 10;
    if (month >= 10 || month <= 3) {
      offsetHours = 11; // DST approximation
    }

    // Create a date assuming the components are UTC (naive)
    const naiveDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    // Adjust by subtracting the Sydney offset to get actual UTC timestamp
    const utcTimestamp = naiveDate.getTime() - (offsetHours * 60 * 60 * 1000);
    const correctDate = new Date(utcTimestamp);

    return correctDate.toISOString();
  };

  // Helper functions for Sydney time
  const getSydneyDateString = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const formatInSydneyTime = (isoString: string): string => {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });

    const parts = formatter.formatToParts(date);
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value || '';

    return `${month} ${day}, ${year} at ${hour}:${minute} ${dayPeriod}`;
  };

  const fetchRunHistory = useCallback(
    async (searchQuery: string = "") => {
      if (fetchingRef.current) return;
      if (abortControllerRef.current) abortControllerRef.current.abort();

      const userEmail =
        resolveUserEmail(accounts?.[0]) ||
        useAuthStore.getState().user?.email ||
        (typeof window !== "undefined" ? localStorage.getItem("user_email") || "" : "");

      if (!userEmail) {
        setRunHistory([]);
        return;
      }

      abortControllerRef.current = new AbortController();
      setIsLoading(true);

      try {
        const queryParams = new URLSearchParams();
        const trimmedSearchQuery = searchQuery.trim();
        if (trimmedSearchQuery) queryParams.append("app_name", trimmedSearchQuery);
        if (startDate) queryParams.append("start_date", `${startDate}T00:00:00Z`);
        if (endDate) queryParams.append("end_date", `${endDate}T23:59:59Z`);
        queryParams.append("page", page.toString());
        queryParams.append("page_size", pageSize.toString());

        const apiUrl = `/api/qlik/history?email=${encodeURIComponent(userEmail)}&${queryParams}`;
        const data = await fetchWithAuth<any>(apiUrl);

        if (!data || !Array.isArray(data)) {
          setRunHistory([]);
          setHasMore(false);
          if (trimmedSearchQuery) toast.info(`No results found for "${trimmedSearchQuery}"`);
          return;
        }

        if (data.length === 0) {
          setRunHistory([]);
          setHasMore(false);
          if (trimmedSearchQuery) toast.info(`No results found for "${trimmedSearchQuery}"`);
          return;
        }

        const formattedDataPromises = data.map(async (item: any) => {
          try {
            let status: "success" | "failed" | "in_progress" = "in_progress";
            let statusDetails: any = {};

            const folderIdentifier = item.folder_name || item.app_id || item.run_id;
            if (folderIdentifier) {
              try {
                const folderData = await fetchWithAuth<any>(
                  `/api/qlik/history-by-folder?folder=${encodeURIComponent(folderIdentifier)}`
                );

                if (folderData) {
                  const runDetails = Array.isArray(folderData) ? folderData[0] : folderData;

                  statusDetails = {
                    unbuildingStatus: runDetails?.unbuilding_status || item.unbuilding_status,
                    assessmentStatus: runDetails?.assessment_status || item.assessment_status,
                    parsingStatus: runDetails?.parsing_status || item.parsing_status,
                    mappingStatus: runDetails?.mapping_status || item.mapping_status,
                    reportGenerationStatus: runDetails?.report_generation_status || item.report_generation_status,
                    unbuildingMessage: runDetails?.unbuilding_message || item.unbuilding_message,
                    assessmentMessage: runDetails?.assessment_message || item.assessment_message,
                    parsingMessage: runDetails?.parsing_message || item.parsing_message,
                    mappingMessage: runDetails?.mapping_message || item.mapping_message,
                    reportGenerationMessage: runDetails?.report_generation_message || item.report_generation_message,
                  };

                  if (["failed", "error"].includes(runDetails?.unbuilding_status)) status = "failed";
                  else if (runDetails?.report_generation_status === "success") status = "success";
                  else if (
                    ["failed", "error"].includes(runDetails?.parsing_status) ||
                    ["failed", "error"].includes(runDetails?.mapping_status) ||
                    ["failed", "error"].includes(runDetails?.assessment_status) ||
                    ["failed", "error"].includes(runDetails?.report_generation_status)
                  ) {
                    status = "failed";
                  } else if (
                    runDetails?.unbuilding_status === "success" &&
                    runDetails?.assessment_status === "success" &&
                    runDetails?.parsing_status === "success" &&
                    runDetails?.mapping_status === "success" &&
                    runDetails?.report_generation_status === "success"
                  ) {
                    status = "success";
                  }
                }
              } catch {
                // Ignore folder detail fetch error
              }
            }

            const rawStatus = (item.status || "").toLowerCase();
            if (rawStatus.includes("completed") || rawStatus.includes("success")) {
              status = "success";
            } else if (rawStatus.includes("failed") || rawStatus.includes("error") || rawStatus.includes("cancelled")) {
              status = "failed";
            }

            const parsedStartTime = item.folder_name ? parseFolderTimestamp(item.folder_name) : null;
            const fallbackStartTime = item.start_time || item.start_date_time || item.timestamp || item.created_at || new Date().toISOString();
            const startTime = parsedStartTime || fallbackStartTime;

            // Timeout logic: If in_progress and >10 mins elapsed, mark as failed
            if (status === "in_progress") {
              const start = new Date(startTime);
              const elapsedMs = Date.now() - start.getTime();
              if (elapsedMs > 10 * 60 * 1000) {
                status = "failed";
                statusDetails.timeoutMessage = "Migration interrupted as the session was reset";
              }
            }

            const appName =
              item.app_name ||
              item.application ||
              item.project_name ||
              item.payload?.app_name ||
              item.payload?.project_name ||
              (item.folder_name ? removeTimestampFromFolderName(item.folder_name) : "") ||
              "Qlik Sense Application";

            return {
              id: item.id || item.run_id || `run-${Math.random().toString(36).substr(2, 9)}`,
              application: appName,
              folderName: item.folder_name || item.app_id || item.run_id || "",
              status,
              startTime,
              endTime: item.endTime || item.end_date_time,
              duration: item.time_duration || item.time_elapsed || calculateDuration(startTime, item.endTime || item.end_date_time),
              sourceSpace: item.source_space || item.workspace_name || item.space_name || item.payload?.space_name || "Qlik Cloud",
              targetWorkspace: item.target_workspace || item.fabric_workspace || item.payload?.fabric_workspace || "Microsoft Fabric",
              processedItems: item.total_apps || item.processed_items || item.processedItems || 1,
              errors: item.total_failed || item.error_count || item.errors || 0,
              reportUrl: item.report_url,
              ...statusDetails,
            } as RunHistoryItem;
          } catch (error: any) {
            if (error.name !== "AbortError") console.error("Error processing item:", error);
            return null;
          }
        });

        let formattedData = (await Promise.all(formattedDataPromises)).filter(Boolean) as RunHistoryItem[];
        formattedData.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        setRunHistory(formattedData);
        setHasMore(formattedData.length === pageSize);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          toast.error(`Failed to load run history: ${error.message}`);
          setRunHistory([]);
          setHasMore(false);
        }
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
      }
    },
    [accounts, startDate, endDate, page, pageSize, baseUrl]
  );

  const handleSearch = () => {
    setPage(1);
    fetchRunHistory(searchTerm);
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };
  const clearSearch = () => {
    setSearchTerm("");
    setPage(1);
    fetchRunHistory();
  };

  useEffect(() => {
    fetchRunHistory();
  }, []);

  useEffect(() => {
    fetchRunHistory(searchTerm);
  }, [page, pageSize]);

  // Auto-refersh funtion
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !fetchingRef.current) {
        setIsRefreshing(true);
        fetchRunHistory(searchTerm).finally(() => setIsRefreshing(false));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchRunHistory, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRunHistory(searchTerm);
    setIsRefreshing(false);
    toast.success("Run history refreshed");
  };

  const groupRunsByTime = (runs: RunHistoryItem[]): TimeGroup[] => {
    // Precompute Sydney date strings for comparisons
    const now = new Date();
    const todaySydney = getSydneyDateString(now);
    const yesterday = new Date(now.getTime() - 86400000); // 24 hours ago (handles DST approximately)
    const yesterdaySydney = getSydneyDateString(yesterday);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000); // Approx 7 days ago
    const sevenDaysAgoSydney = getSydneyDateString(sevenDaysAgo);

    const today: RunHistoryItem[] = [],
      yesterdayGroup: RunHistoryItem[] = [],
      thisWeek: RunHistoryItem[] = [],
      older: RunHistoryItem[] = [];

    runs.forEach((run) => {
      const runSydneyDateStr = getSydneyDateString(run.startTime);
      if (runSydneyDateStr === todaySydney) {
        today.push(run);
      } else if (runSydneyDateStr === yesterdaySydney) {
        yesterdayGroup.push(run);
      } else if (runSydneyDateStr >= sevenDaysAgoSydney) {
        thisWeek.push(run);
      } else {
        older.push(run);
      }
    });

    return [
      { title: "Today", runs: today },
      { title: "Yesterday", runs: yesterdayGroup },
      { title: "This Week", runs: thisWeek },
      { title: "Older", runs: older },
    ].filter((g) => g.runs.length > 0);
  };

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title.toLowerCase()) ? prev.filter((g) => g !== title.toLowerCase()) : [...prev, title.toLowerCase()]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const timeGroups = groupRunsByTime(runHistory);
  const isSearching = searchTerm.trim().length > 0;

  if (isLoading && runHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-lg text-gray-600">Fetching run history...</p>
        <p className="text-sm text-gray-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Migration History</h2>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 cursor-pointer"
                onClick={handleSearch}
              />
              <Input
                placeholder="Search by application name"
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 pr-8"
              />
              {isSearching && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={pageSize.toString()}
              onValueChange={(v: string) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              style={{ width: "140px" }}
            >
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="20">20 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </Select>
          </div>
        </Card>

        {isLoading && runHistory.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-3">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Updating history...</span>
          </div>
        )}

        <div className="space-y-4">
          {!isLoading && runHistory.length === 0 && (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 text-lg mb-2">
                {isSearching ? `No run history found for "${searchTerm}"` : "No run history available"}
              </p>
              <p className="text-sm text-gray-400">
                {isSearching ? "Try a different search term" : "Run a migration to see history here"}
              </p>
            </Card>
          )}

          {!isLoading &&
            runHistory.length > 0 &&
            timeGroups.map((group) => {
              const successfulRuns = group.runs.filter((r) => r.status === "success").length;
              const failedRuns = group.runs.filter((r) => r.status === "failed").length;
              const inProgressRuns = group.runs.filter((r) => r.status === "in_progress").length;

              return (
                <Card key={group.title} className="overflow-hidden">
                  <Collapsible
                    open={openGroups.includes(group.title.toLowerCase())}
                    onOpenChange={() => toggleGroup(group.title)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-wrap">
                          {openGroups.includes(group.title.toLowerCase()) ? (
                            <ChevronDown className="h-5 w-5 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-5 w-5 flex-shrink-0" />
                          )}
                          <h3 className="text-lg font-semibold">{group.title}</h3>
                          <Badge variant="outline" className="ml-2">
                            {group.runs.length} total
                          </Badge>
                          {successfulRuns > 0 && <StaticBadge color="green">{successfulRuns} success</StaticBadge>}
                          {failedRuns > 0 && <StaticBadge color="red">{failedRuns} failed</StaticBadge>}
                          {inProgressRuns > 0 && <StaticBadge color="blue">{inProgressRuns} in progress</StaticBadge>}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t">
                        <div className="divide-y divide-gray-100">
                          {group.runs.map((item) => (
                            <div key={item.id} className="p-4 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                  {getStatusIcon(item.status)}
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{item.application}</h4>
                                    <p className="text-sm text-gray-500">
                                      {formatInSydneyTime(item.startTime)}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">Folder: {item.folderName}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    {item.status === "success" && <StaticBadge color="green">Success</StaticBadge>}
                                    {item.status === "failed" && <StaticBadge color="red">Failed</StaticBadge>}
                                    {item.status === "in_progress" && (
                                      <StaticBadge color="blue">In Progress</StaticBadge>
                                    )}
                                    {item.duration && (
                                      <p className="text-xs text-gray-500 mt-1">{item.duration}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={item.status === "in_progress"}
                                    onClick={() => setSelectedRun(item)}
                                    className="flex-shrink-0"
                                  >
                                    {item.status === "in_progress" ? "Processing..." : "View Details"}
                                  </Button>
                                </div>
                              </div>

                              {(item.errors > 0 ||
                                item.unbuildingMessage ||
                                item.assessmentMessage ||
                                item.parsingMessage ||
                                item.mappingMessage ||
                                item.reportGenerationMessage ||
                                item.timeoutMessage) && (
                                <div className="mt-3 ml-8 space-y-1">
                                  {item.errors > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      {item.errors} errors
                                    </Badge>
                                  )}
                                  {item.timeoutMessage && (
                                    <p className="text-sm text-red-600">
                                      <span className="font-semibold">Timeout:</span> {item.timeoutMessage}
                                    </p>
                                  )}
                                  {item.unbuildingStatus &&
                                    ["failed", "error"].includes(item.unbuildingStatus) &&
                                    item.unbuildingMessage && (
                                      <p className="text-sm text-red-600">
                                        <span className="font-semibold">Unbuild:</span> {item.unbuildingMessage}
                                      </p>
                                    )}
                                  {item.assessmentStatus &&
                                    ["failed", "error"].includes(item.assessmentStatus) &&
                                    item.assessmentMessage && (
                                      <p className="text-sm text-red-600">
                                        <span className="font-semibold">Assessment:</span> {item.assessmentMessage}
                                      </p>
                                    )}
                                  {item.parsingStatus &&
                                    ["failed", "error"].includes(item.parsingStatus) &&
                                    item.parsingMessage && (
                                      <p className="text-sm text-red-600">
                                        <span className="font-semibold">Parsing:</span> {item.parsingMessage}
                                      </p>
                                    )}
                                  {item.mappingStatus &&
                                    ["failed", "error", "partial_success"].includes(
                                      item.mappingStatus.toLowerCase()
                                    ) &&
                                    item.mappingMessage && (
                                      <p className="text-sm text-red-600">
                                        <span className="font-semibold">Mapping:</span> {item.mappingMessage}
                                      </p>
                                    )}
                                  {item.reportGenerationStatus &&
                                    ["failed", "error"].includes(item.reportGenerationStatus) &&
                                    item.reportGenerationMessage && (
                                      <p className="text-sm text-red-600">
                                        <span className="font-semibold">Report Generation:</span>{" "}
                                        {item.reportGenerationMessage}
                                      </p>
                                    )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
        </div>

        <div className="flex justify-between items-center mt-6">
          <Button
            variant="outline"
            disabled={page === 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
          </Button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <Button variant="outline" disabled={!hasMore || isLoading} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedRun} onOpenChange={(open: boolean) => !open && setSelectedRun(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRun?.application} - Run Details</DialogTitle>
          </DialogHeader>
          {selectedRun && (
            <AppRunResults
              folderName={selectedRun.folderName}
              appName={selectedRun.application}
              parsingStatus={selectedRun.parsingStatus}
              parsingMessage={selectedRun.parsingMessage}
              mappingStatus={selectedRun.mappingStatus}
              mappingMessage={selectedRun.mappingMessage}
              backendToken={backendToken} // Pass it here
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};