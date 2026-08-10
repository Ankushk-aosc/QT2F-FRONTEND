"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TablesFieldsProps {
  mappingData: any;
}

export default function TablesFieldsComponent({ mappingData }: TablesFieldsProps) {
  // Extract table names from the 'table_details.tables' array
  const tableNames = mappingData.table_details?.tables?.map((table: any) => table.table_name) || [];
  const [selectedTable, setSelectedTable] = useState(tableNames[0] || "");

  // Find the selected table's fields from 'table_details.tables'
  const selectedTableData = mappingData.table_details?.tables?.find(
    (table: any) => table.table_name === selectedTable
  );
  const fields = selectedTableData?.fields || [];

  // Map fields to the required format for display
  const fieldMappings = fields.map((field: any) => ({
    source_field: field.field_name || "N/A",
    qlik_type: field.dataType || "N/A", // Use dataType from the field
    target_field: field.field_name || "N/A",
    bi_type: field.nature || "N/A", // Use nature as the BI type
  }));

  return (
    <div className="space-y-6 pt-6">
      <Card>
        <CardHeader>
          <CardTitle>Field Mappings</CardTitle>
          <CardDescription>View your mapped fields</CardDescription>
          <div className="mb-6">
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-[200px] p-2 border rounded-md"
              style={{ backgroundColor: "#ffffff", borderColor: "#000000", color: "#000000" }}
            >
              {tableNames.length > 0 ? (
                tableNames.map((table: string, index: number) => (
                  <option key={index} value={table}>
                    {table}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No tables available
                </option>
              )}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {tableNames.length > 0 && fieldMappings.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b" style={{ backgroundColor: "#E6F0FA" }}>
                    <th colSpan={2} className="text-center py-3 px-4">
                      Qlik
                    </th>
                    <th colSpan={2} className="text-center py-3 px-4">
                      Power BI
                    </th>
                  </tr>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Source Name</th>
                    <th className="text-left py-3 px-4">Source Type</th>
                    <th className="text-left py-3 px-4">Target Name</th>
                    <th className="text-left py-3 px-4">Target Type</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMappings.map((field: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{field.source_field}</td>
                      <td className="py-3 px-4">{field.bi_type}</td>
                      {/* <td className="py-3 px-4">{field.qlik_type}</td> */}
                      <td className="py-3 px-4">{field.target_field}</td>
                        <td className="py-3 px-4">{field.qlik_type}</td>
                      {/* <td className="py-3 px-4">{field.bi_type}</td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-center py-6">
                {selectedTable ? "No fields available for this table" : "No tables available"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}