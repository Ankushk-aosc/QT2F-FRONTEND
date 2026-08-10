"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  confidence?: string; // e.g., "95%"
  reason?: string;
}
interface DaxMeasures {
  [table: string]: Measure[];
}
interface MeasuresProps {
  mappingData: {
    dax_measures?: DaxMeasures;
  };
  appId: string;
  backendToken: string; 
}
// Call the validation API via your Next.js route


const validateMeasures = async (
  daxMeasures: DaxMeasures,
  backendToken: string
): Promise<any> => {
  const response = await fetch("/api/check-measures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${backendToken}`,   // 👈 ADDED
    },
    body: JSON.stringify(daxMeasures),
  });

  if (!response.ok) {
    throw new Error(`Validation failed: ${response.statusText}`);
  }
  return response.json();
};

export default function MeasuresComponent({ mappingData, appId, backendToken }: MeasuresProps) {

  const [loading, setLoading] = useState(false);
  const [measures, setMeasures] = useState<DaxMeasures>({});
  useEffect(() => {
    const API_RESULTS_KEY = "api_results";
    const storedApiResults = localStorage.getItem(API_RESULTS_KEY);
    if (!storedApiResults) {
      setMeasures(mappingData.dax_measures || {});
      return;
    }
    let apiResults: any[] = [];
    try {
      apiResults = JSON.parse(storedApiResults);
    } catch {
      setMeasures(mappingData.dax_measures || {});
      return;
    }
    // Find current app by appId
    const currentAppIndex = apiResults.findIndex((app: any) => app.appId === appId);
    if (currentAppIndex === -1) {
      setMeasures(mappingData.dax_measures || {});
      return;
    }
    const currentApp = apiResults[currentAppIndex];
    let daxMeasures = currentApp.mappedData?.dax_measures || mappingData.dax_measures || {};
    // Check if `confidence` already exists in any measure across tables
    const hasConfidence = Object.values(daxMeasures).some((table: any) =>
      Array.isArray(table) && table.some((m: any) => m.confidence !== undefined)
    );
    if (hasConfidence) {
      // Data already has confidence, use it directly
      setMeasures(daxMeasures);
      return;
    }
    // First time for this app → call API
    setLoading(true);
    validateMeasures(daxMeasures, backendToken)
      .then((apiData) => {
        console.log("API Response:", apiData);
       
        if (!apiData.success) {
          throw new Error("API returned unsuccessful response");
        }
        // Extract tables from API response (everything except success/validated_count)
        const updatedDaxMeasures: DaxMeasures = {};
       
        Object.entries(apiData).forEach(([key, value]) => {
          // Skip metadata keys, only process table data
          if (key === "success" || key === "validated_count") {
            return;
          }
         
          // This is a table with measures
          if (Array.isArray(value)) {
            updatedDaxMeasures[key] = value;
            console.log(`✓ Extracted table: ${key} with ${value.length} measures`);
          }
        });
        console.log("Updated DAX Measures with confidence:", updatedDaxMeasures);
        // Create updated app object with deep copy to ensure changes are saved
        const updatedMappedData = {
          ...currentApp.mappedData,
          dax_measures: updatedDaxMeasures,
        };
        const updatedApp = {
          ...currentApp,
          mappedData: updatedMappedData,
        };
        // Update the array
        const updatedApiResults = [...apiResults];
        updatedApiResults[currentAppIndex] = updatedApp;
       
        console.log("Saving to localStorage - Updated App dax_measures:", updatedApp.mappedData.dax_measures);
       
        // Save back to localStorage
        localStorage.setItem(API_RESULTS_KEY, JSON.stringify(updatedApiResults));
       
        // Verify it was saved
        const verificationString = localStorage.getItem(API_RESULTS_KEY);
        if (verificationString) {
          const verificationData = JSON.parse(verificationString);
          const savedApp = verificationData[currentAppIndex];
          console.log("✓ Verification - Data saved successfully!");
          console.log("Saved dax_measures:", savedApp?.mappedData?.dax_measures);
         
          // Double check a specific measure has confidence
          const firstTable = Object.keys(updatedDaxMeasures)[0];
          if (firstTable && updatedDaxMeasures[firstTable][0]) {
            console.log(`Sample measure confidence: ${updatedDaxMeasures[firstTable][0].name} = ${updatedDaxMeasures[firstTable][0].confidence}`);
          }
        } else {
          console.error("✗ Verification failed - localStorage is empty");
        }
        setMeasures(updatedDaxMeasures);
      })
      .catch((err) => {
        console.error("Validation API error:", err);
        setMeasures(daxMeasures);
      })
      .finally(() => setLoading(false));
  }, [mappingData, appId]);
  // Flatten all tables' measures
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
  // Get percentage from confidence string
  const getPercent = (confidence: string | null | undefined): number => {
    if (!confidence) return 0;
    const num = parseFloat(confidence.replace("%", ""));
    return isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
  };
  // Label based on percentage
  const getConfidenceLabel = (percent: number): { text: string; color: string } => {
    if (percent < 60) return { text: "Incorrect Translation - Needs Attention", color: "text-red-700" };
    if (percent < 85) return { text: "Need Attention", color: "text-yellow-700" };
    return { text: "Excellent", color: "text-green-700" };
  };
  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardContent className="p-0 relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-20 rounded-lg">
              <div className="flex items-center space-x-2 text-xs text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                <span className="font-medium">Validating measures and calculating confidence...</span>
              </div>
            </div>
          )}
 
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse border-border">
              <thead>
                <tr className="border-b  border-border">
                  <th className="text-center py-3 px-4 border-x border-border">Table</th>
                  <th className="text-center py-3 px-4 border-x border-border">Fields</th>
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
  {flatMeasures.length > 0 ? (
    flatMeasures.map((m, i) => {
      const percent = getPercent(m.confidence);
      const displayValue = percent === 0 ? 100 : percent;
      const label = getConfidenceLabel(percent);
      const showValue = m.confidence || "—";
 
      return (
        <tr key={i} className="border-b border-border text-center text-sm">
          <td className=" border-x border-border py-2 px-1 max-w-[100px] truncate break-words whitespace-pre-wrap" title={m.table_name}>
            {m.table_name}
          </td>
          <td className=" border-x border-border py-2 px-1 max-w-[100px] truncate break-words whitespace-pre-wrap" title={m.field_name}>
            {m.field_name}
          </td>
          <td
            className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap leading-tight"
            title={m.qlik_measure}
          >
            {m.qlik_measure}
          </td>
          <td
            className="border-x border-border py-2 px-1 max-w-[120px] break-words whitespace-pre-wrap leading-tight"
            title={m.powerbi_measure}
          >
            {m.powerbi_measure}
          </td>
 
          {/* Accuracy Circle */}
          <td className=" border-x border-border text-center py-2 px-1 w-[100px]">
            <div className="flex flex-col items-center justify-center transition-all duration-700 ease-in-out">
              <div style={{ width: 40, height: 40 }}>
                <CircularProgressbar
                  value={displayValue}
                  text={percent.toString()}
                  styles={buildStyles({
                    textSize: "28px",
                    pathTransitionDuration: 0.8,
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
 
          {/* Info Button with Popover */}
          <td className="border-x border-border text-center py-2 px-1">
            {m.reason && m.reason !== "N/A" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-[500px] p-4">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
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
    })
  ) : (
    <tr>
      <td colSpan={6} className="py-6 text-center text-muted-foreground text-s">
        No measures found.
      </td>
    </tr>
  )}
</tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}