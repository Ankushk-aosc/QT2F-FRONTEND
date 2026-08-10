"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useQlikToast } from "@/hooks/useQlikToast";
import { jsPDF } from "jspdf";
import Summary from "./Summary";
import Volumetrics from "./Volumetrics";
import DetailedAnalysis from "./DetailedAnalysis";
import Challenges from "./Challenges";
import { AssessmentData, MappedAssessmentData } from "./types";

// Clean folder name from timestamp
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

// Map raw assessment data
const mapAssessmentData = (data: AssessmentData): MappedAssessmentData => {
  if (!data || !data.results || !Array.isArray(data.results)) {
    console.error("Invalid assessment data:", data);
    return {
      appName: "Unknown Application",
      report_name: "Error Loading Data",
      file_type: "Unknown",
      KPI: 0,
      page_count: 0,
      database_name: "Unknown",
      complexity: "Unknown",
      business_criticality: "Unknown",
      documentation_quality: "Unknown",
      dimensional_model: "Unknown",
      data_sensitivity: "Unknown",
      data_volume: "Unknown",
      migration_challenges: "Unknown",
      query_complexity: "Unknown",
      unsupported_data_types: "Unknown",
      powerbi_replicability: {
        details: ["Error loading assessment data"],
        recommendation: "Please try again",
      },
      screenshots: "[]",
      data_model: "Unknown",
      datasets: [],
      assessments: {
        complexity: ["Error loading complexity data"],
        powerbi: ["Error loading Power BI data"],
        criticality: ["Error loading criticality data"],
        documentation: ["Error loading documentation data"],
        dimensional: ["Error loading dimensional model data"],
        sensitivity: ["Error loading sensitivity data"],
        data_volume: ["Error loading data volume data"],
        migration_challenges: ["Error loading migration challenges data"],
        query_complexity: ["Error loading query complexity data"],
        unsupported_data_types: ["Error loading unsupported data types data"],
        screenshots: ["Error loading screenshots"],
        KPI: ["Error loading KPI data"],
        page_count: ["Error loading page count data"],
        data_model: ["Error loading data model data"],
      },
      sharepoint_upload: data.sharepoint_upload,
      upload_messages: data.upload_messages || [],
    };
  }

  const getResult = (category: string): any =>
    data.results.find((item) => item.category.toLowerCase() === category.toLowerCase()) || { category, value: "Unknown" };

  const safeString = (value: any, defaultValue: string): string => {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "object" && value !== null) {
      return (
        value.recommendation ||
        value.priority ||
        value.quality ||
        value.model_type ||
        value.stats ||
        value.structure ||
        value.level ||
        value.status ||
        defaultValue
      ) as string;
    }
    return defaultValue;
  };

  const safeDetails = (value: any, defaultDetails: string[]): string[] => {
    if (typeof value === "object" && value !== null && "details" in value) {
      return Array.isArray(value.details) ? value.details : defaultDetails;
    }
    return defaultDetails;
  };

  const parseDatasets = () => {
    const datasetsResult = getResult("Datasets and Fields").value;
    const defaultDatasets = [{ name: "Unknown Dataset", fields: 0, keys: 0 }];

    if (typeof datasetsResult !== "string" || !datasetsResult.trim()) {
      return defaultDatasets;
    }

    try {
      const datasetEntries: { name: string; fields: number; keys: number }[] = [];
      const datasetStrings = datasetsResult.split(/;(?![^(]*\))/).filter(Boolean);

      for (let datasetStr of datasetStrings) {
        datasetStr = datasetStr.trim();
        if (!datasetStr) continue;

        const datasetMatch = datasetStr.match(/^([^\s(]+)\s*\((.*)\)$/);
        if (!datasetMatch) continue;

        const name = datasetMatch[1].trim();
        const fieldsStr = datasetMatch[2].trim();

        if (!fieldsStr) {
          datasetEntries.push({ name, fields: 0, keys: 0 });
          continue;
        }

        const fieldEntries: { name: string; type: string; isKey: boolean }[] = [];
        const fieldStrings = fieldsStr.split(/,(?![^(]*\))/).filter(Boolean);

        for (const fieldStr of fieldStrings) {
          const trimmedFieldStr = fieldStr.trim();
          const fieldMatch = trimmedFieldStr.match(/(\w+)\s*\(\(['"]([^'"]+)['"],\s*(true|false)\)\)/);

          if (fieldMatch) {
            fieldEntries.push({
              name: fieldMatch[1].trim(),
              type: fieldMatch[2].trim(),
              isKey: fieldMatch[3].toLowerCase() === "true",
            });
          } else {
            const nameMatch = trimmedFieldStr.match(/^(\w+)/);
            const fieldName = nameMatch ? nameMatch[1].trim() : `UnknownField_${fieldEntries.length + 1}`;
            fieldEntries.push({ name: fieldName, type: "Unknown", isKey: false });
          }
        }

        const fieldCount = fieldEntries.length;
        const keyCount = fieldEntries.filter((f) => f.isKey).length;
        datasetEntries.push({ name, fields: fieldCount, keys: keyCount });
      }

      return datasetEntries.length > 0 ? datasetEntries : defaultDatasets;
    } catch (error) {
      console.error("Error parsing datasets:", error);
      return defaultDatasets;
    }
  };

  const getDatabaseName = (): string => {
    const dbResult = getResult("Database Name").value;
    if (Array.isArray(dbResult) && dbResult.length > 0) {
      const primaryDb = dbResult[0];
      if (primaryDb.driver && typeof primaryDb.driver === "string" && primaryDb.driver.trim()) {
        return primaryDb.driver;
      }
      if (primaryDb.name && typeof primaryDb.name === "string" && primaryDb.name.trim()) {
        return primaryDb.name;
      }
    }
    return "Unknown";
  };

  const powerBiResult = getResult("Power BI Replicability").value;
  const powerBiData = typeof powerBiResult === "object" && powerBiResult !== null
    ? {
        details: safeDetails(powerBiResult, ["No Power BI details"]),
        recommendation: safeString(powerBiResult, "Unknown"),
      }
    : { details: ["No Power BI details"], recommendation: "Unknown" };

  const screenshotsResult = getResult("Screenshots").value;
  const screenshotsData =
    typeof screenshotsResult === "object" && screenshotsResult !== null && "screenshots" in screenshotsResult
      ? JSON.stringify(screenshotsResult.screenshots || [])
      : "[]";

  const dataModelResult = getResult("Data Model").value;
  const dataModelData = typeof dataModelResult === "object" && dataModelResult !== null ? safeString(dataModelResult, "Unknown") : "Unknown";

  const dataModelDetails = (() => {
    if (typeof dataModelResult !== "object" || dataModelResult === null) {
      return ["No data model details"];
    }
    const details = safeDetails(dataModelResult, ["No data model details"]);
    const structure = safeString(dataModelResult, "Unknown");
    const stats = dataModelResult.stats ? String(dataModelResult.stats) : "No stats available";
    return [...details, `Structure: ${structure}`, `Stats: ${stats}`];
  })();

  const kpiResult = getResult("KPIs").value;
  const kpiCount =
    typeof kpiResult === "object" && kpiResult !== null && "kpi_count" in kpiResult
      ? Number(kpiResult.kpi_count) || 0
      : typeof kpiResult === "number"
      ? kpiResult
      : 0;

  return {
    report_name: data.report_name || "Unknown Report",
    file_type: safeString(getResult("File Type").value, "Unknown"),
    KPI: kpiCount,
    page_count: Number(getResult("Total Pages").value) || 0,
    database_name: getDatabaseName(),
    complexity: safeString(getResult("Complexity").value, "Unknown"),
    business_criticality: safeString(getResult("Business Criticality").value, "Unknown"),
    documentation_quality: safeString(getResult("Metric Documentation").value, "Unknown"),
    dimensional_model: safeString(getResult("Dimensional Model").value, "Unknown"),
    data_sensitivity: safeString(getResult("Data Sensitivity").value, "Unknown"),
    data_volume: safeString(getResult("Data Volume").value, "Unknown"),
    migration_challenges: safeString(getResult("Migration Challenges").value, "Unknown"),
    query_complexity: safeString(getResult("Query Complexity").value, "Unknown"),
    unsupported_data_types: safeString(getResult("Unsupported Data Types").value, "Unknown"),
    powerbi_replicability: powerBiData,
    screenshots: screenshotsData,
    data_model: dataModelData,
    datasets: parseDatasets(),
    assessments: {
      complexity: safeDetails(getResult("Complexity").value, ["No complexity details"]),
      powerbi: safeDetails(getResult("Power BI Replicability").value, ["No Power BI details"]),
      criticality: safeDetails(getResult("Business Criticality").value, ["No criticality details"]),
      documentation: safeDetails(getResult("Metric Documentation").value, ["No documentation details"]),
      dimensional: safeDetails(getResult("Dimensional Model").value, ["No dimensional model details"]),
      sensitivity: safeDetails(getResult("Data Sensitivity").value, ["No sensitivity details"]),
      data_volume: safeDetails(getResult("Data Volume").value, ["No data volume details"]),
      migration_challenges: safeDetails(getResult("Migration Challenges").value, ["No migration challenges details"]),
      query_complexity: safeDetails(getResult("Query Complexity").value, ["No query complexity details"]),
      unsupported_data_types: safeDetails(getResult("Unsupported Data Types").value, ["No unsupported data types details"]),
      screenshots: safeDetails(getResult("Screenshots").value, ["No screenshots available"]),
      KPI: [`KPI Count: ${kpiCount}`],
      page_count: [`Page Count: ${Number(getResult("Total Pages").value) || 0}`],
      data_model: dataModelDetails,
    },
    sharepoint_upload: data.sharepoint_upload,
    upload_messages: data.upload_messages || [],
  };
};

interface AssessmentResultsProps {
  assessmentItem?: {
    appId: string;
    appName: string;
    assessmentData: AssessmentData;
  };
}

export default function AssessmentResults({ assessmentItem }: AssessmentResultsProps) {
  const [activeTab, setActiveTab] = useState("summary");
  const [assessmentData, setAssessmentData] = useState<MappedAssessmentData | null>(null);
  const [appName, setAppName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const router = useRouter();
  const toast = useQlikToast();

  const handleStartNewAssessment = () => {
    router.push("/dashboard");
  };

  const handleProceedToParsing = () => {
    const localData = localStorage.getItem("assessment_data");
    if (!localData) {
      toast.error("No assessment data found. Please complete assessment first.");
      return;
    }

    try {
      const parsed = JSON.parse(localData);
      const folderName = parsed[0]?.assessmentData?.folder_name || parsed[0]?.assessmentData?.report_name;
      if (!folderName) throw new Error("Missing folder name");

      // Skip parsing API – just go to parsing page
      localStorage.setItem("parsedReportData", JSON.stringify({
        folder: folderName,
        files: [],
        autogen_summary: "Parsing skipped (demo mode)",
        dimensions: { dimension_count: 0, dimensions: [] },
        measures: { measure_count: 0, measures: [] },
        filters: { filter_pane_count: 0, filter_panes: [] },
        script: { datasources: [], tables: [], filename: "", table_column_renames: [] },
        errors: [],
      }));

      router.push("/parse-report");
      toast.success("Proceeding to parsing view...");
    } catch (err) {
      toast.error("Failed to prepare parsing data.");
    }
  };

  const downloadAsPDF = () => {
    if (!assessmentData) {
      toast.error("No assessment data available to generate PDF.");
      return;
    }
    setDownloadLoading(true);
    try {
      const cleanedFolderName = removeTimestampFromFolderName(assessmentData.report_name);
      const doc = new jsPDF();
      let yOffset = 10;
      doc.setFontSize(16);
      doc.text(`Assessment Report: ${cleanedFolderName}`, 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, yOffset);
      yOffset += 10;

      if (assessmentData.upload_messages && assessmentData.upload_messages.length > 0) {
        doc.setFontSize(14);
        doc.text("Upload Information", 10, yOffset);
        yOffset += 10;
        doc.setFontSize(12);
        assessmentData.upload_messages.forEach((message) => {
          const lines = doc.splitTextToSize(message, 180);
          lines.forEach((line: string) => {
            doc.text(line, 10, yOffset);
            yOffset += 5;
          });
        });
        yOffset += 5;
      }

      doc.setFontSize(14);
      doc.text("Key Metrics", 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      doc.text(`File Type: ${assessmentData.file_type}`, 10, yOffset);
      yOffset += 5;
      doc.text(`KPI Count: ${assessmentData.KPI}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Page Count: ${assessmentData.page_count}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Database Name: ${assessmentData.database_name}`, 10, yOffset);
      yOffset += 10;

      doc.setFontSize(14);
      doc.text("Assessment Results", 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      doc.text(`Complexity: ${assessmentData.complexity}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Business Criticality: ${assessmentData.business_criticality}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Documentation Quality: ${assessmentData.documentation_quality}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Dimensional Model: ${assessmentData.dimensional_model}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Data Sensitivity: ${assessmentData.data_sensitivity}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Data Volume: ${assessmentData.data_volume}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Migration Challenges: ${assessmentData.migration_challenges}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Query Complexity: ${assessmentData.query_complexity}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Unsupported Data Types: ${assessmentData.unsupported_data_types}`, 10, yOffset);
      yOffset += 5;
      doc.text(`Power BI Replicability: ${assessmentData.powerbi_replicability.recommendation}`, 10, yOffset);
      yOffset += 10;

      doc.setFontSize(14);
      doc.text("Datasets", 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      assessmentData.datasets.forEach((dataset) => {
        doc.text(`${dataset.name}: ${dataset.fields} fields, ${dataset.keys} keys`, 10, yOffset);
        yOffset += 5;
        if (yOffset > 270) { doc.addPage(); yOffset = 10; }
      });

      doc.setFontSize(14);
      doc.text("Power BI Replicability Details", 10, yOffset);
      yOffset += 10;
      doc.setFontSize(12);
      assessmentData.powerbi_replicability.details.forEach((detail) => {
        const lines = doc.splitTextToSize(detail, 180);
        lines.forEach((line: string) => {
          doc.text(`- ${line}`, 10, yOffset);
          yOffset += 5;
          if (yOffset > 270) { doc.addPage(); yOffset = 10; }
        });
      });

      if (assessmentData.sharepoint_upload) {
        doc.setFontSize(14);
        doc.text("SharePoint Upload Details", 10, yOffset);
        yOffset += 10;
        doc.setFontSize(12);
        if (assessmentData.sharepoint_upload.json) {
          doc.text(`JSON Upload: ${assessmentData.sharepoint_upload.json.status || "Unknown"}`, 10, yOffset);
          yOffset += 5;
          if (assessmentData.sharepoint_upload.json.json_download_url) {
            doc.text(`JSON URL: ${assessmentData.sharepoint_upload.json.json_download_url}`, 10, yOffset);
            yOffset += 5;
          }
        }
        if (assessmentData.sharepoint_upload.pdf) {
          doc.text(`PDF Upload: ${assessmentData.sharepoint_upload.pdf.status || "Unknown"}`, 10, yOffset);
          yOffset += 5;
          if (assessmentData.sharepoint_upload.pdf.pdf_download_url) {
            doc.text(`PDF URL: ${assessmentData.sharepoint_upload.pdf.pdf_download_url}`, 10, yOffset);
            yOffset += 5;
          }
        }
      }

      doc.save(`Assessment_Report_${cleanedFolderName}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  useEffect(() => {
    const loadAssessmentData = async () => {
      try {
        if (assessmentItem) {
          const mappedData = mapAssessmentData(assessmentItem.assessmentData);
          setAssessmentData(mappedData);
          setAppName(assessmentItem.appName || "Unknown Application");
          setLoading(false);
          return;
        }

        const localData = localStorage.getItem("assessment_data");
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            const appData = Array.isArray(parsedData) ? parsedData[0] : parsedData;
            if (appData?.assessmentData?.results && Array.isArray(appData.assessmentData.results)) {
              const mappedData = mapAssessmentData(appData.assessmentData);
              setAssessmentData(mappedData);
              setAppName(appData.appName || "Unknown Application");
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error("Failed to parse localStorage data:", error);
            localStorage.removeItem("assessment_data");
          }
        }

        const sessionData = sessionStorage.getItem("assessmentResults");
        if (sessionData) {
          try {
            const parsedData = JSON.parse(sessionData);
            const appData = Array.isArray(parsedData) ? parsedData[0] : parsedData;
            if (appData.results && Array.isArray(appData.results)) {
              const mappedData = mapAssessmentData(appData);
              setAssessmentData(mappedData);
              setAppName(mappedData.appName || "Unknown Application");
              sessionStorage.removeItem("assessmentResults");
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error("Failed to parse sessionStorage data:", error);
            sessionStorage.removeItem("assessmentResults");
          }
        }

        setAssessmentData(null);
        setAppName("");
        setLoading(false);
      } catch (error) {
        console.error("Error loading assessment data:", error);
        setAssessmentData(null);
        setAppName("");
        setLoading(false);
      }
    };

    loadAssessmentData();
  }, [assessmentItem]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p>Loading assessment data...</p>
        </div>
      </div>
    );
  }

  if (!assessmentData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Assessment Data Found</h2>
          <p className="mb-6">We couldn&apos;t find any assessment data to display.</p>
          <Button onClick={handleStartNewAssessment}>
            Start New Assessment
          </Button>
        </div>
      </div>
    );
  }

  const cleanedFolderName = removeTimestampFromFolderName(assessmentData.report_name);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 container py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-red-600">
              Assessment Results
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Application Name</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{appName}</div>
              <p className="text-xs text-muted-foreground">{assessmentData.file_type}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Power BI Migration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{assessmentData.powerbi_replicability.recommendation}</div>
              <p className="text-xs text-muted-foreground">Migration feasibility</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="volumetrics">Volumetrics</TabsTrigger>
            <TabsTrigger value="details">Detailed Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Challenges</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6 pt-6">
            <Summary assessmentData={assessmentData} />
          </TabsContent>
          <TabsContent value="volumetrics" className="space-y-6 pt-6">
            <Volumetrics assessmentData={assessmentData} />
          </TabsContent>
          <TabsContent value="details" className="space-y-6 pt-6">
            <DetailedAnalysis assessmentData={assessmentData} />
          </TabsContent>
          <TabsContent value="recommendations" className="space-y-6 pt-6">
            <Challenges assessmentData={assessmentData} />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="w-full border-t bg-background py-6">
          <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-center text-sm leading-loose text-muted-foreground">© Vector Lab</p>
          </div>
        </footer>
    </div>
  );
}