import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileCheck } from "lucide-react";
import { MappedAssessmentData } from './types';

interface SummaryProps {
  assessmentData: MappedAssessmentData;
}

const Summary: React.FC<SummaryProps> = ({ assessmentData }) => {
  const totalFields = assessmentData.datasets.reduce((sum, dataset) => sum + (dataset.fields || 0), 0);
  const totalDatasets = assessmentData.datasets.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment Overview</CardTitle>
        <CardDescription>Summary of the assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Key Metrics</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>KPIs</span>
                  <span>{assessmentData.KPI}</span>
                </div>
                <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#0033A0]"
                    style={{
                      width: `${Math.min((assessmentData.KPI / 15) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Pages</span>
                  <span>{assessmentData.page_count}</span>
                </div>
                <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#0033A0]"
                    style={{
                      width: `${Math.min((assessmentData.page_count / 10) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Datasets</span>
                  <span>{totalDatasets}</span>
                </div>
                <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#0033A0]"
                    style={{
                      width: `${Math.min((totalDatasets / 10) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Total Fields</span>
                  <span>{totalFields}</span>
                </div>
                <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#0033A0]"
                    style={{
                      width: `${Math.min((totalFields / 100) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Assessment Results</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Documentation Quality</span>
                <Badge variant="default">{assessmentData.documentation_quality}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Data Sensitivity</span>
                <Badge variant="default">{assessmentData.data_sensitivity}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Key Findings</h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>{assessmentData.data_sensitivity} data sensitivity requires compliance checks</span>
            </li>
            <li className="flex items-start gap-2">
              <FileCheck className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{assessmentData.dimensional_model === "Non-Dimensional" ? "Non-dimensional model may require restructuring" : "Clear dataset structure aids migration process"}</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default Summary;