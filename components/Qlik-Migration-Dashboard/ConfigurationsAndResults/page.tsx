"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle, Search, Code2, GitMerge, FileText, BarChart3, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import AssessmentResults from "@/components/Assessment-Results/AssessmentResults";
import ParsingResults from "@/components/Parsing-Results/ParsingResults";
import MappingResults from "@/components/Mapping-Results/MappingResults";
import ReportGenerationResults from "@/components/ReportGeneration-Results/ReportGenerationResults";
import { formatApiErrorMessage } from "@/lib/utils";
import { AssessmentData, MappedData, ParsedData, ReportGenerationData, AppProcessState } from "@/types/assessment";

interface ApiResult {
  appId: string;
  appName: string;
  folderName?: string;
  assessmentData?: AssessmentData;
  parsedData?: ParsedData;
  mappedData?: MappedData;
  reportGenData?: ReportGenerationData;
}

interface ConfigurationsAndResultsProps {
  isAssessmentTriggered: boolean;
  dropdownAppId: string;
  onDropdownChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  apiResults: ApiResult[];
  processStates: AppProcessState;
  backendToken: string;
}

export function ConfigurationsAndResults({
  isAssessmentTriggered,
  dropdownAppId,
  onDropdownChange,
  apiResults,
  processStates,
  backendToken,
}: ConfigurationsAndResultsProps) {
  const [detailedErrors, setDetailedErrors] = useState<Record<string, string>>({});

  const componentTypes = {
    assessment: [
      "File Type",
      "Total Pages",
      "Database Name",
      "Datasets and Fields",
      "Complexity",
      "Power BI Replicability",
      "Business Criticality",
      "Metric Documentation",
      "Dimensional Model",
      "Data Model",
      "Data Sensitivity",
      "KPI",
      "Unsupported Data Types",
      "Data Volume",
      "Migration Challenges",
      "Query Complexity",
      "Screenshots",
    ],
    parsing: ["Data Sources", "Tables/Entities", "Dimensions", "Filters", "Measures", "Renamed Fields"],
    mapping: ["Tables & Entities", "Fields", "Dimensions & Measures", "Filters & Calculations"],
    reportGeneration: ["Power BI Report", "Data Model", "Visualizations", "DAX Measures"],
  };

  // Clear detailed errors when app changes
  useEffect(() => {
    setDetailedErrors({});
  }, [dropdownAppId]);

useEffect(() => {
  const fetchDetailedErrors = async () => {
    if (!dropdownAppId || !backendToken) return;

    const appResult = apiResults.find((result) => result.appId === dropdownAppId);
    if (!appResult?.folderName) return;

    const processes = ["assessment", "parsing", "mapping", "reportGeneration"] as const;

    for (const proc of processes) {
      const state = processStates[dropdownAppId]?.[proc];
      if (state?.status === "failed" && !detailedErrors[proc]) {
        try {
          const res = await fetch(
            `/api/qlik/history-by-folder?folder=${encodeURIComponent(appResult.folderName)}`,
            {
              headers: {
                Authorization: `Bearer ${backendToken}`,
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const runDetails = Array.isArray(data) ? data[0] : (data || {});

            const messageMap: Record<typeof proc, string> = {
              assessment: "assessment_message",
              parsing: "parsing_message",
              mapping: "mapping_message",
              reportGeneration: "report_generation_message",
            };

            let realError = runDetails?.error_message || runDetails?.message || state.error || "No detailed error available.";
            const key = messageMap[proc];
            if (key && runDetails && runDetails[key]) {
              realError = runDetails[key];
            }

            setDetailedErrors((prev) => ({ ...prev, [proc]: realError }));
          } else {
            setDetailedErrors((prev) => ({
              ...prev,
              [proc]: state.error || "Failed to fetch detailed error from server.",
            }));
          }
        } catch (error) {
          console.error(`Failed to fetch error for ${proc}:`, error);
        }
      }
    }
  };

  fetchDetailedErrors();
}, [dropdownAppId, apiResults, processStates, backendToken]); // CORRECT deps // ← Added backendToken

  const renderErrorMessage = (process: string, stateError: string) => {
    const detailedError = detailedErrors[process];
    const rawError = detailedError || stateError;
    const cleanMsg = formatApiErrorMessage(rawError);

    return (
      <div className="p-5 bg-red-50/70 border border-red-200/80 rounded-xl shadow-sm text-left">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-red-900 text-sm">{processToLabel(process)} Notice</h4>
            <p className="text-sm text-red-700 leading-relaxed">{cleanMsg}</p>
          </div>
        </div>
      </div>
    );
  };

  const processToLabel = (process: string): string => {
    const map: Record<string, string> = {
      assessment: "Assessment",
      parsing: "Parsing",
      mapping: "Mapping",
      reportGeneration: "Report Generation",
    };
    return map[process] || process.charAt(0).toUpperCase() + process.slice(1);
  };

  const getStatusDot = (status?: string) => {
    if (!status || status === "pending") return <Clock size={12} className="text-slate-400" />;
    if (status === "running") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" style={{ animation: "pulseDot 1.5s infinite ease-in-out" }} />;
    if (status === "completed") return <CheckCircle2 size={12} className="text-emerald-500" />;
    if (status === "failed") return <XCircle size={12} className="text-rose-500" />;
    return null;
  };

  const renderResults = () => {
    if (!dropdownAppId || !apiResults.some((result) => result.appId === dropdownAppId)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <BarChart3 size={40} className="text-slate-300" />
          <p className="text-base font-medium text-slate-500">Select an application to view results</p>
          <p className="text-sm text-slate-400">Choose an app from the dropdown above to see assessment, parsing, mapping, and report generation results.</p>
        </div>
      );
    }

    const appResult = apiResults.find((result) => result.appId === dropdownAppId);
    if (!appResult) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Search size={40} className="text-slate-300" />
          <p className="text-base font-medium text-slate-500">No results available for this app</p>
        </div>
      );
    }

    const assessmentState = processStates[dropdownAppId]?.assessment;
    const parsingState = processStates[dropdownAppId]?.parsing;
    const mappingState = processStates[dropdownAppId]?.mapping;
    const reportGenState = processStates[dropdownAppId]?.reportGeneration;

    return (
      <Tabs defaultValue="assessment" className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="assessment" className="flex items-center gap-1.5">
            {getStatusDot(assessmentState?.status)}
            Assessment
          </TabsTrigger>
          <TabsTrigger value="parsing" className="flex items-center gap-1.5">
            {getStatusDot(parsingState?.status)}
            Parsing
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex items-center gap-1.5">
            {getStatusDot(mappingState?.status)}
            Mapping
          </TabsTrigger>
          <TabsTrigger value="reportGeneration" className="flex items-center gap-1.5">
            {getStatusDot(reportGenState?.status)}
            Report Generation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assessment">
          {assessmentState?.status === "failed" ? (
            renderErrorMessage("assessment", assessmentState.error || "Assessment failed")
          ) : appResult.assessmentData ? (
            <AssessmentResults key={dropdownAppId} assessmentItem={appResult as any} />
          ) : (
            <p className="text-lg text-muted-foreground">No assessment results available.</p>
          )}
        </TabsContent>
        <TabsContent value="parsing">
          {parsingState?.status === "failed" ? (
            renderErrorMessage("parsing", parsingState.error || "Parsing failed")
          ) : appResult.parsedData ? (
            <ParsingResults
              key={dropdownAppId}
              data={appResult.parsedData}
              appName={appResult.appName}
              reportType={appResult.parsedData?.report_type || "Unknown"}
              dataModel={appResult.parsedData?.structure?.data_model || "Unknown"}
            />
          ) : (
            <p className="text-lg text-muted-foreground">No parsing results available.</p>
          )}
        </TabsContent>
        <TabsContent value="mapping">
          {mappingState?.status === "failed" ? (
            renderErrorMessage("mapping", mappingState.error || "Mapping failed")
          ) : appResult.mappedData ? (
            <MappingResults key={dropdownAppId} appId={dropdownAppId}  backendToken={backendToken} mappingData={appResult.mappedData} />
          ) : (
            <p className="text-lg text-muted-foreground">No mapping results available.</p>
          )}
        </TabsContent>
        <TabsContent value="reportGeneration">
          {reportGenState?.status === "failed" ? (
            renderErrorMessage("reportGeneration", reportGenState.error || "Report Generation failed")
          ) : appResult.reportGenData ? (
            <ReportGenerationResults
              key={dropdownAppId}
              isLoading={false}
              appId={dropdownAppId}
              backendToken={backendToken}
              reportGenData={appResult.reportGenData}
              appName={appResult.appName}
              folderName={appResult.folderName}
            />
          ) : (
            <p className="text-lg text-muted-foreground">No report generation results available.</p>
          )}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Tabs defaultValue={isAssessmentTriggered ? "results" : "configurations"} className="w-full">
      <TabsList className="mb-4 flex flex-wrap">
        <TabsTrigger value="configurations">Configurations</TabsTrigger>
        <TabsTrigger value="results" disabled={!isAssessmentTriggered}>
          Results
        </TabsTrigger>
      </TabsList>
      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        <TabsContent value="configurations" className="mt-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Configurations</h2>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="assessment">
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Search size={16} className="text-blue-500" /> Assessment Agent</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardTitle>Assessment Configuration</CardTitle>
                      <CardDescription>Configure assessment parameters for selected applications</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {componentTypes.assessment.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <span className="text-lg">•</span>
                            <span>{type}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="parsing">
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Code2 size={16} className="text-emerald-500" /> Parsing Agent</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardTitle>Parsing Configuration</CardTitle>
                      <CardDescription>Configure parsing parameters for selected applications</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {componentTypes.parsing.map((item) => (
                          <div key={item} className="flex items-center space-x-2">
                            <span className="text-lg">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="mapping">
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><GitMerge size={16} className="text-amber-500" /> Mapping Agent</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardTitle>Mapping Configuration</CardTitle>
                      <CardDescription>Configure mapping parameters for selected applications</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {componentTypes.mapping.map((item) => (
                          <div key={item} className="flex items-center space-x-2">
                            <span className="text-lg">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="reportGeneration">
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><FileText size={16} className="text-purple-500" /> Report Generation Agent</span>
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardHeader>
                      <CardTitle>Report Generation Configuration</CardTitle>
                      <CardDescription>Configure report generation parameters for selected applications</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {componentTypes.reportGeneration.map((item) => (
                          <div key={item} className="flex items-center space-x-2">
                            <span className="text-lg">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </TabsContent>
        <TabsContent value="results" className="mt-0">
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold">Processing Results</h2>
            <div className="max-w-md">
              <CustomSelect
                label="Select Application"
                placeholder="Select an application to view results..."
                value={dropdownAppId || ""}
                options={apiResults.map((result) => ({
                  value: result.appId,
                  label: result.appName,
                }))}
                onChange={(val) => {
                  const syntheticEvent = {
                    target: { value: val },
                  } as unknown as React.ChangeEvent<HTMLSelectElement>;
                  onDropdownChange(syntheticEvent);
                }}
              />
            </div>
            {renderResults()}
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}