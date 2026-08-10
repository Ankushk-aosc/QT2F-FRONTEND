import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MappedAssessmentData } from './types';

interface VolumetricsProps {
  assessmentData: MappedAssessmentData;
}

const Volumetrics: React.FC<VolumetricsProps> = ({ assessmentData }) => {
  const totalDatasets = assessmentData.datasets.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volumetric Analysis</CardTitle>
        <CardDescription>Detailed volumetric components captured during assessment.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Dataset Overview</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3">Dataset Name</th>
                    <th className="text-left py-3 px-3">Fields</th>
                    <th className="text-left py-3 px-3">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {totalDatasets === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 px-4 text-center text-gray-500">
                        No datasets available
                      </td>
                    </tr>
                  ) : (
                    assessmentData.datasets.map((dataset, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-3 px-3">{dataset.name || "Unknown"}</td>
                        <td className="py-3 px-3">{dataset.fields || 0}</td>
                        <td className="py-3 px-3">
                          {dataset.name?.toLowerCase().includes("deliveries") || dataset.name?.toLowerCase().includes("matches") ? (
                            <Badge>Fact Table</Badge>
                          ) : (
                            <Badge className="text-white">Dimension Table</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">KPI & Page Distribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">KPI Complexity based on KPI Count</CardTitle>
                  <CardTitle className="text-sm">
                    KPI Count: <span className="text-sm">{assessmentData.KPI || 0}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Low (5)</span>
                      <span>Medium (10)</span>
                      <span>High (15)</span>
                    </div>
                    <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{
                          width: `${Math.min((assessmentData.KPI / 15) * 100, 100)}%`,
                        }}
                      />
                      <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "33%" }} />
                      <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "66%" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Page Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{assessmentData.page_count || 0}</div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Low (3)</span>
                      <span>Medium (6)</span>
                      <span>High (10)</span>
                    </div>
                    <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{
                          width: `${Math.min((assessmentData.page_count / 10) * 100, 100)}%`,
                        }}
                      />
                      <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "33%" }} />
                      <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: "66%" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">Database Information</h3>
            <Card>
              <CardContent className="pt-6">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Database Platform</dt>
                    <dd className="text-lg break-words">{assessmentData.database_name || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Dimensional Model</dt>
                    <dd className="text-lg break-words">{assessmentData.dimensional_model || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Data Sensitivity</dt>
                    <dd className="text-lg">{assessmentData.data_sensitivity || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Documentation Quality</dt>
                    <dd className="text-lg">{assessmentData.documentation_quality || "Unknown"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Volumetrics;