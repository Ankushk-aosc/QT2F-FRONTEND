"use client";
 
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Summary from "./Summary";
import Transformation from "./Transformation";
 
interface ResultsViewProps {
  isLoading: boolean;
  appId?: string;
  backendToken?: string;
  reportGenData?: any;
  appName?: string;
  folderName?: string;
  workspaceName?: string;
}
 
export default function ReportGenerationResults({
  isLoading,
  appId,
  backendToken,
  reportGenData: propReportGenData,
  appName: propAppName,
  folderName: propFolderName,
  workspaceName: propWorkspaceName,
}: ResultsViewProps) {
  const [activeTab, setActiveTab] = useState("summary");
  const [appName, setAppName] = useState<string>(propAppName || "Unknown Application");
  const [folderName, setFolderName] = useState<string>(propFolderName || "Unknown Folder");
  const [workspaceName, setWorkspaceName] = useState<string>(propWorkspaceName || "Fabric Workspace");
  const [reportMessage, setReportMessage] = useState<string>("Report Generated Successfully");
  const [reportLink, setReportLink] = useState<string>("");
  const [Reportname, setReportname] = useState<string>(propAppName || "Unknown Report");
 
  useEffect(() => {
    if (propAppName) setAppName(propAppName);
    if (propFolderName) setFolderName(propFolderName);
    if (propWorkspaceName) setWorkspaceName(propWorkspaceName);
    if (propReportGenData) {
      if (propReportGenData.output?.content_summary) {
        setReportMessage(propReportGenData.output.content_summary);
      }
      if (propReportGenData.output?.file_name) {
        setReportname(propReportGenData.output.file_name);
      }
    }
    if (!appId && !propReportGenData) return;
 
    const stored = localStorage.getItem("api_results");
    let selectedApp: any = null;
 
    if (stored) {
      try {
        const apiArray = JSON.parse(stored);
        if (Array.isArray(apiArray)) {
          selectedApp = apiArray.find((a: any) => a.appId === appId);
        }
      } catch (e) {
        console.error("Failed to parse api_results", e);
      }
    }
 
    if (selectedApp) {
      // ✅ Application name
      setAppName(selectedApp.appName || "Unknown Application");
 
      // ✅ Report name (for UI)
      setReportname(selectedApp.appName || "Unknown Report");
 
      // ✅ Folder name (for API)
      setFolderName(selectedApp.folderName || "Unknown Folder");
 
      // ✅ Optional message
      const msg = selectedApp.assessmentData?.log_assessment_completion?.message;
      if (msg) setReportMessage(msg);
 
      // ✅ Extract report link from reportGenData message
      const reportGen = selectedApp.reportGenData;
      if (reportGen && reportGen.message) {
        const urlMatch = reportGen.message.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          setReportLink(urlMatch[0]);
        }
      }
    }
 
    // ✅ Workspace name
    const ws = localStorage.getItem("selected_workspace");
    if (ws) {
      try {
        const parsed = JSON.parse(ws);
        setWorkspaceName(parsed.displayName || "Workspace not available");
      } catch (e) {
        console.error("Workspace parse error", e);
      }
    }
  }, [appId]);
 
  // 🌀 Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 container py-10">
          <div className="h-64 animate-pulse flex items-center justify-center bg-gray-100 rounded-md">
            <p className="text-gray-500">Loading report information...</p>
          </div>
        </main>
      </div>
    );
  }
 
  // 🧩 Main UI
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 container py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-red-600">
            Report Generation Results
          </h1>
        </div>
 
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Application Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl ">{appName}</div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Workspace Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{workspaceName}</div>
            </CardContent>
          </Card>
 
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Generated Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl ">Success</div>
            </CardContent>
          </Card>
        </div>
 
        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="transformation">Transformations</TabsTrigger>
          </TabsList>
 
          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6 pt-6">
            <Summary
              reportMessage={reportMessage}
              reportLink={reportLink}
              appName={Reportname}
              workspaceName={workspaceName}
              folderName={folderName}
            />
          </TabsContent>
          
 
          {/* Transformation Tab */}
          <TabsContent value="transformation" className="space-y-6 pt-6">
            <Transformation folderName={folderName || ""} backendToken={backendToken || ""} />
          </TabsContent>
        </Tabs>
      </main>
 
      {/* Footer */}
      <footer className="w-full border-t bg-background py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground">
            © Vector Lab
          </p>
        </div>
      </footer>
    </div>
  );
}