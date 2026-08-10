"use client";

import React from "react"; // Added React import for JSX
import { Card, CardContent } from "@/components/ui/card";

interface RelationshipsProps {
  mappingData: any;
}

export default function RelationshipsComponent({ mappingData }: RelationshipsProps) {
  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Source Table</th>  
                  <th className="text-left py-3 px-4">Relationship Type</th>
                  <th className="text-left py-3 px-4">Target Table</th>             
                </tr>
              </thead>
              <tbody>
                {mappingData.relationships?.length > 0 ? (
                  mappingData.relationships.map((rel: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">
                        <div>{rel.source_table || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">Field: {rel.source_column || "N/A"}</div>
                      </td>
                      <td className="py-3 px-4">{rel.relationship_type || "N/A"}</td>
                      <td className="py-3 px-4">
                        <div>{rel.target_table || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">Field: {rel.target_column || "N/A"}</div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      No relationships found.
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