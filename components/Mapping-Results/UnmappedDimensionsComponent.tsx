
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Dimension {
  name: string;
  expression: string;
  "Calculated Columns"?: string;
}

interface UnmappedDimensionsProps {
  mappingData: any;
}

export default function UnmappedDimensionsComponent({ mappingData }: UnmappedDimensionsProps) {
  // Derive unmapped dimensions (same as original)
  const unmappedDimensions = (mappingData.dimensions?.dimensions || []).map((dim: any) => ({
    dimension_name: dim.name || "N/A",
    label_expression: dim.expression || "N/A",
    status: "Unmapped",
    power_bi: "Calculated Column",
  }));

  // Derive mapped dimensions from mappingData.dimensions.dimensions
  const mappedDimensions = (mappingData.dimensions?.dimensions || []).map((dim: Dimension) => ({
    name: dim.name || "N/A",
    calculated_column: dim["Calculated Columns"] || "N/A",
  }));

  return (
    <div className="space-y-6 pt-6">
      <Tabs defaultValue="unmapped" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unmapped">Unmapped Fields</TabsTrigger>
          <TabsTrigger value="mapped">Mapped Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="unmapped">
          <Card>
            <CardHeader>
              <CardTitle>Unmapped Fields</CardTitle>
              <CardDescription>Unmapped fields detected in the report</CardDescription>
            </CardHeader>
            <CardContent>
              {unmappedDimensions.length === 0 ? (
                <p className="text-muted-foreground">No unmapped fields available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Fields Name</th>
                        <th className="text-left py-3 px-4">Label Expression in Qlik</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Power BI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmappedDimensions.map((dim: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{dim.dimension_name}</td>
                          <td className="py-3 px-4">{dim.label_expression}</td>
                          <td className="py-3 px-4">{dim.status}</td>
                          <td className="py-3 px-4">{dim.power_bi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapped">
          <Card>
            <CardHeader>
              <CardTitle>Mapped Fields</CardTitle>
              <CardDescription>Converted calculated columns from Qlik to Power BI</CardDescription>
            </CardHeader>
            <CardContent>
              {mappedDimensions.length === 0 ? (
                <p className="text-muted-foreground">No mapped fields available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Field Name</th>
                        <th className="text-left py-3 px-4">Calculated Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedDimensions.map((dim: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{dim.name}</td>
                          <td className="py-3 px-4">{dim.calculated_column}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}