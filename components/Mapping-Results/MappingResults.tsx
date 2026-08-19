"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useQlikToast } from "@/hooks/useQlikToast";
import OverviewComponent from "./OverviewComponent";
import TablesFieldsComponent from "./TablesFieldsComponent";
import MeasuresComponent from "./MeasuresComponent";
import RelationshipsComponent from "./RelationshipsComponent";
import VisualizationsComponent from "./VisualizationsComponent";
import UnmappedDimensionsComponent from "./CalculatedColumnComponent";

// Utility function to remove timestamp from folder name
const removeTimestampFromFolderName = (folderName: string): string => {
  if (!folderName) return "Unknown";

  let cleanedName = folderName
    .replace(/_\d{8}_\d{6}/g, "") // Remove _YYYYMMDD_HHMMSS
    .replace(/_?\d{8}/g, "") // Remove _YYYYMMDD
    .replace(/_?\d{4}-\d{2}-\d{2}/g, "") // Remove _YYYY-MM-DD
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
  return cleanedName.trim() || "Unknown";
};

interface MappingResultsProps {
  appId?: string;
  mappingData?: any;
  onProceed?: () => void;
  backendToken?: string
}

export default function MappingResults({ appId = "", mappingData: propMappingData, onProceed, backendToken }: MappingResultsProps) {
  const [mappingData, setMappingData] = useState<any>(propMappingData || null);
  const [appName, setAppName] = useState<string>("Unknown");
  const [databasePlatform, setDatabasePlatform] = useState<string>("Unknown");
  const [loading, setLoading] = useState(!propMappingData);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useQlikToast();

  useEffect(() => {
    if (propMappingData) {
      setMappingData(propMappingData);
      setLoading(false);
      return;
    }

    try {
      const storedAssessmentData = localStorage.getItem("api_results");
      let fetchedAppName = "Unknown";
      let fetchedDatabasePlatform = "Unknown";

      if (storedAssessmentData && appId) {
        const assessmentArray = JSON.parse(storedAssessmentData);
        const selectedApp = Array.isArray(assessmentArray) ? assessmentArray.find((app: any) => app.appId === appId) : null;

        if (selectedApp) {
          fetchedAppName = selectedApp.appName || selectedApp.unbuildData?.appName || "Unknown";
          fetchedAppName = fetchedAppName.replace(/(_\d{8}_\d{6})$|(_\d+)$/g, "");
          setAppName(fetchedAppName);

          if (selectedApp.assessmentData?.results && Array.isArray(selectedApp.assessmentData.results)) {
            const fileTypeEntry = selectedApp.assessmentData.results.find((item: any) => item.category === "File Type");
            const databaseNameEntry = selectedApp.assessmentData.results.find((item: any) => item.category === "Database Name");
            fetchedDatabasePlatform = fileTypeEntry?.value || databaseNameEntry?.value || selectedApp.unbuildData?.database_platform || "Unknown";
            setDatabasePlatform(fetchedDatabasePlatform);
          }
        }
      }

      const storedMappedData = localStorage.getItem("mappedReportData");
      if (storedMappedData) {
        const mappedData = JSON.parse(storedMappedData);
        setMappingData(mappedData);
      }
    } catch (error) {
      console.error("Error fetching or parsing localStorage data:", error);
      setError("Failed to load mapping data. Check console for details.");
    } finally {
      setLoading(false);
    }
  }, [appId, propMappingData]);

  const handleProceedToReportGeneration = async () => {
    setLoading(true);
    setError(null);

    try {
      const localData = localStorage.getItem("assessment_data");
      if (!localData) {
        throw new Error("No assessment data found. Please complete the assessment first.");
      }
      const assessmentData = JSON.parse(localData)[0];
      const folderName = assessmentData.assessmentData.folder_name;
      if (!folderName) {
        throw new Error("Folder name not found in assessment data.");
      }

      const payload = {
        folder_name: folderName,
      };

      const response = await fetch("/api/report-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseTextGen = await response.text();
      if (!response.ok) {
        console.error("Generation API request failed:", {
          status: response.status,
          statusText: response.statusText,
          responseText: responseTextGen,
        });
        throw new Error(`Failed to generate report: ${responseTextGen}`);
      }

      let data;
      try {
        data = JSON.parse(responseTextGen);
      } catch (parseError) {
        console.error("Error parsing generation API response:", parseError);
        throw new Error(`Invalid response from generation API: ${responseTextGen}`);
      }

      localStorage.setItem("report_generation_result", JSON.stringify(data));

      if (onProceed) {
        onProceed();
      } else {
        router.push(`/report-generation-results?appId=${appId || JSON.parse(localStorage.getItem("api_results") || "[]")[0]?.appId}`);
      }
    } catch (error: any) {
      console.error("Error during report generation:", error.message, error.stack);
      setError(error.message || "Failed to generate report. Please check the console for details.");
      toast.error(error.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!mappingData) return <div className="text-center py-10">No mapping data available. Please ensure the mapping process is complete.</div>;

  // Get dimension count for OverviewComponent
  const unmappedFieldsCount = mappingData.dimensions?.dimension_count || 0;

  return (
    <div className="flex min-h-screen flex-col">
      {loading && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
            <p className="text-white text-lg">Processing Report Generation, please wait...</p>
          </div>
        </div>
      )}
      
      <main className="flex-1 container py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-red-600">Mapping Results</h1>
              <p className="text-muted-foreground">
                Application Name: {appName}
              </p>
              <p className="text-muted-foreground">
                Mapped Fields: {mappingData.table_details?.total_field_count || 0}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            <h3 className="font-bold">Error</h3>
            <p>{error}</p>
          </div>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tables-fields">Tables/Fields</TabsTrigger>
            <TabsTrigger value="measures">Measures</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
            <TabsTrigger value="visualizations">Visualisations</TabsTrigger>
            <TabsTrigger value="unmapped-dimensions">Calculated Columns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewComponent 
              mappingData={mappingData} 
              appName={appName} 
              databasePlatform={databasePlatform} 
              unmappedFieldsCount={unmappedFieldsCount}
            />
          </TabsContent>
          <TabsContent value="tables-fields">
            <TablesFieldsComponent mappingData={mappingData} />
          </TabsContent>
          <TabsContent value="measures">
            <MeasuresComponent mappingData={mappingData} appId={appId || ""} backendToken={backendToken || ""} />
          </TabsContent>
          <TabsContent value="relationships">
            <RelationshipsComponent mappingData={mappingData} />
          </TabsContent>
          <TabsContent value="visualizations">
            <VisualizationsComponent mappingData={mappingData} />
          </TabsContent>
          <TabsContent value="unmapped-dimensions">
           <UnmappedDimensionsComponent mappingData={mappingData} appId={appId || ""} backendToken={backendToken || ""} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center mt-4">
     
        </div>
      </main>

      <footer className="w-full border-t bg-background py-6">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © Vector Lab 
          </p>
        </div>
      </footer>
    </div>
  );
}