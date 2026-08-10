"use client";

import { Card, CardContent } from "@/components/ui/card";

interface VisualizationsProps {
  mappingData: any;
}

export default function VisualizationsComponent({ mappingData }: VisualizationsProps) {
  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-center py-3 px-4">Elements used in Qlik</th>
                  <th className="text-center py-3 px-4">Elements to be used in Power BI</th>
                </tr>
              </thead>
              <tbody>
                {mappingData.visualizations?.visualizations?.length > 0 ? (
                  mappingData.visualizations.visualizations.map((vis: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4 text-center">{vis.qlik_type || "N/A"}</td>
                      <td className="py-3 px-4 text-center">{vis.bi_type || "N/A"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-muted-foreground">
                      No visualizations found.
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