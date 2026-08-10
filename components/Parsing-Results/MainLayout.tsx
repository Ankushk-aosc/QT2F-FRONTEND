import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Rename {
  previous_name: string;
  renamed: string;
}

interface TableRename {
  table_name: string;
  column_renames: Rename[];
}

interface RenamedFieldsTabProps {
  tableRenames: TableRename[];
}

export default function RenamedFieldsTab({ tableRenames }: RenamedFieldsTabProps) {
  const [selectedTable, setSelectedTable] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Renamed Fields</CardTitle>
        <CardDescription>Renamed Fields</CardDescription>
      </CardHeader>
      <CardContent>
        {tableRenames.length === 0 ? (
          <p className="text-muted-foreground">No renamed fields available</p>
        ) : (
          <>
            <div className="mb-4">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-[200px] p-2 border rounded-md"
                style={{ backgroundColor: "#ffffff", borderColor: "#000000", color: "#000000" }}
              >
                <option value="" disabled hidden>Select a table</option>
                {tableRenames.map((table, index) => (
                  <option key={index} value={table.table_name}>
                    {table.table_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              {(tableRenames.find((table) => table.table_name === selectedTable)?.column_renames?.length ?? 0) > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Table</th>
                      <th className="text-left py-3 px-4">Previous Column Name</th>
                      <th className="text-left py-3 px-4">Renamed Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRenames
                      .find((table) => table.table_name === selectedTable)
                      ?.column_renames.map((rename, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{selectedTable}</td>
                          <td className="py-3 px-4">{rename.previous_name}</td>
                          <td className="py-3 px-4">{rename.renamed}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground">
                  {selectedTable ? "No renamed fields available for this table" : "Please select a table to view renamed fields"}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}