"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import AssessmentResults from "@/components/Assessment-Results/AssessmentResults";
import ParsingResults from "@/components/Parsing-Results/ParsingResults";
import MappingResults from "@/components/Mapping-Results/MappingResults";
import ReportGenerationResults from "@/components/ReportGeneration-Results/ReportGenerationResults";
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
    const baseUrl =
      process.env.NEXT_PUBLIC_SQL_BASE_URL ||
      "https://az-wa-sql-db-vl-deg0f6htd6bud2f3.australiaeast-01.azurewebsites.net";

    for (const proc of processes) {
      const state = processStates[dropdownAppId]?.[proc];
      if (state?.status === "failed" && !detailedErrors[proc]) {
        try {
          const res = await fetch(
            `${baseUrl}/run-history/by-folder/${encodeURIComponent(appResult.folderName)}`,
            {
              headers: {
                Authorization: `Bearer ${backendToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (res.ok) {
            const data = await res.json();
            const runDetails = data[0];

            const messageMap: Record<typeof proc, string> = {
              assessment: "assessment_message",
              parsing: "parsing_message",
              mapping: "mapping_message",
              reportGeneration: "report_generation_message",
            };

            let realError = runDetails?.error_message || runDetails?.message || state.error || "No detailed error available.";
            const key = messageMap[proc];
            if (key && runDetails[key]) {
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
    const errorMsg = detailedError || stateError;
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="font-semibold text-red-800 mb-2">{processToLabel(process)} Failed</h3>
        <pre className="text-sm text-red-600 whitespace-pre-wrap overflow-x-auto">{errorMsg}</pre>
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

  const renderResults = () => {
    if (!dropdownAppId || !apiResults.some((result) => result.appId === dropdownAppId)) {
      return <p className="text-lg text-muted-foreground">Please select an app to view results.</p>;
    }

    const appResult = apiResults.find((result) => result.appId === dropdownAppId);
    if (!appResult) {
      return <p className="text-lg text-muted-foreground">No results available for this app.</p>;
    }

    const assessmentState = processStates[dropdownAppId]?.assessment;
    const parsingState = processStates[dropdownAppId]?.parsing;
    const mappingState = processStates[dropdownAppId]?.mapping;
    const reportGenState = processStates[dropdownAppId]?.reportGeneration;

    return (
      <Tabs defaultValue="assessment" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="assessment">Assessment Results</TabsTrigger>
          <TabsTrigger value="parsing">Parsing Results</TabsTrigger>
          <TabsTrigger value="mapping">Mapping Results</TabsTrigger>
          <TabsTrigger value="reportGeneration">Report Generation Results</TabsTrigger>
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
            <ReportGenerationResults key={dropdownAppId} isLoading={false} appId={dropdownAppId} backendToken={backendToken} />
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
                <AccordionTrigger>Assessment Agent</AccordionTrigger>
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
                <AccordionTrigger>Parsing Agent</AccordionTrigger>
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
                <AccordionTrigger>Mapping Agent</AccordionTrigger>
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
                <AccordionTrigger>Report Generation Agent</AccordionTrigger>
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
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Processing Results</h2>
            <div className="mb-6">
              <Label htmlFor="appSelect">Select Application</Label>
              <div className="relative">
                <select
                  id="appSelect"
                  value={dropdownAppId || ""}
                  onChange={onDropdownChange}
                  className="w-full p-2 border rounded-md appearance-none bg-white"
                >
                  <option value="" disabled>
                    Select an application
                  </option>
                  {apiResults.map((result, index) => (
                    <option key={index} value={result.appId}>
                      {result.appName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4" />
              </div>
            </div>
            {renderResults()}
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}