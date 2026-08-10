"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import SummaryHistory from "./SummaryHistory";
import TransformationHistory from "./TransformationHistory";

// Utility function to clean timestamp from folder name
const removeTimestampFromFolderName = (folderName: string): string => {
  if (!folderName) return "Unknown";
  let cleanedName = folderName
    .replace(/_\d{8}_\d{6}/g, "") // Remove _YYYYMMDD_HHMMSS
    .replace(/_?\d{8}/g, "")       // Remove _YYYYMMDD
    .replace(/_?\d{4}-\d{2}-\d{2}/g, "") // Remove _YYYY-MM-DD
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
  return cleanedName.trim() || "Unknown";
};

interface ResultsViewProps {
  isLoading: boolean;
  backendToken:string;
}

const ReportGenerationResults = ({ isLoading, backendToken }: ResultsViewProps) => {
  const [activeTab, setActiveTab] = useState("summary");

  // Core data
  const [appName, setAppName] = useState<string>("Unknown");
  const [folderName, setFolderName] = useState<string>("Unknown");
  const [workspaceName, setWorkspaceName] = useState<string>("Unknown Workspace");

  // Report generation result
  const [reportMessage, setReportMessage] = useState<string>("Report Generated Successfully");
  const [reportLink, setReportLink] = useState<string>("");
  const [generationStatus, setGenerationStatus] = useState<"success" | "error" | "pending">("pending");

  // Links (optional, for future use)
  const [assessmentLinks, setAssessmentLinks] = useState<{ pdf: string; json: string }>({ pdf: "", json: "" });
  const [parsingLinks, setParsingLinks] = useState<{ pdf: string; json: string }>({ pdf: "", json: "" });
  const [mappingLinks, setMappingLinks] = useState<{ pdf: string; json: string }>({ pdf: "", json: "" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedAssessmentData = localStorage.getItem("HistoryResults");
        let fetchedAppName = "Unknown";
        let fetchedFolderName = "Unknown";
        let fetchedWorkspaceName = "Unknown Workspace";

        if (storedAssessmentData) {
          const assessmentData = JSON.parse(storedAssessmentData);
          const reportGeneration = assessmentData["report-generation"];
          const assessment = assessmentData.assessment;

          // Extract workspace name from destination_folder
          if (reportGeneration?.destination_folder) {
            const parts = reportGeneration.destination_folder.split("/");
            if (parts.length >= 3) {
              fetchedWorkspaceName = parts[parts.length - 2] || "Unknown Workspace";
            }
          }

          // Extract app name and folder name
          if (assessment?.report_name) {
            fetchedFolderName = assessment.report_name;
            fetchedAppName = removeTimestampFromFolderName(assessment.report_name);
          }

          // Set basic info
          setAppName(fetchedAppName);
          setFolderName(fetchedFolderName);
          setWorkspaceName(fetchedWorkspaceName);

          // Handle report generation status and message
          if (reportGeneration) {
            // Update status
            setGenerationStatus(reportGeneration.status === "error" ? "error" : "success");

            if (reportGeneration.status === "error") {
              // Show full error message
              setReportMessage(reportGeneration.message || "Report generation failed due to an unknown error.");
              setReportLink(""); // Clear any old link
            } else if (reportGeneration.status === "success" && reportGeneration.message) {
              // Success case: extract message and link
              const messageMatch = reportGeneration.message.match(/^(.*?)(?=\s*https?:\/\/)/i);
              const cleanMessage = messageMatch ? messageMatch[1].trim() : reportGeneration.message;
              setReportMessage(cleanMessage || "Report generated successfully.");

              const linkMatch = reportGeneration.message.match(/https?:\/\/[^\s]+/);
              setReportLink(linkMatch ? linkMatch[0] : "");
            } else {
              setReportMessage("Report generation completed.");
              setReportLink("");
            }
          }
        }

        // Optional: Load parsing/mapping links (not used in UI now but kept)
        const parsedReportData = localStorage.getItem("parsedReportData");
        if (parsedReportData) {
          const parsedData = JSON.parse(parsedReportData);
          setParsingLinks({
            pdf: parsedData?.sharepoint_upload?.pdf?.url || "",
            json: parsedData?.sharepoint_upload?.json?.url || "",
          });
        }

        const mappedReportData = localStorage.getItem("mappedReportData");
        if (mappedReportData) {
          const parsedData = JSON.parse(mappedReportData);
          setMappingLinks({
            pdf: parsedData?.pdf_upload?.url || "",
            json: parsedData?.json_upload?.url || "",
          });
        }
      } catch (error) {
        console.error("Error fetching report data:", error);
        setAppName("Unknown");
        setFolderName("Unknown");
        setWorkspaceName("Unknown Workspace");
        setReportMessage("Failed to load report information.");
        setReportLink("");
        setGenerationStatus("error");
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 container mx-auto py-10">
          <div className="h-64 animate-pulse flex items-center justify-center bg-gray-100 rounded-md">
            <p className="text-gray-500">Loading report information...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 container mx-auto py-10">
        <div className="flex items-center justify-between mb-8 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-red-600">
              Report Generation Results
            </h1>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="w-full break-words">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Application Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl whitespace-normal break-words">{appName}</div>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Target System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">Microsoft Fabric</div>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Generated Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl  ${
                  generationStatus === "error" ? "text-black" : "text-black"
                }`}
              >
                {generationStatus === "error" ? "Failed" : "Success"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transformation">Transformations</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6 pt-6">
            <SummaryHistory
              reportMessage={reportMessage}
              reportLink={reportLink}
              folderName={folderName}
              workspaceName={workspaceName}
            />
          </TabsContent>

          <TabsContent value="transformation" className="space-y-6 pt-6">
            <TransformationHistory folderName={folderName} backendToken={backendToken} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="w-full border-t bg-background py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground">
            © Vector Lab
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ReportGenerationResults;