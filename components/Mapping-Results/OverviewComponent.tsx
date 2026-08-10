"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const removeTimestampFromFolderName = (folderName: string): string => {
  if (!folderName) return "Unknown";

  let cleanedName = folderName
    .replace(/_\d{8}_\d{6}/g, "")
    .replace(/_?\d{8}/g, "")
    .replace(/_?\d{4}-\d{2}-\d{2}/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
  return cleanedName.trim() || "Unknown";
};

interface OverviewProps {
  mappingData: any;
  appName: string;
  databasePlatform: string;
  unmappedFieldsCount?: number;
}

export default function OverviewComponent({
  mappingData,
  appName,
  databasePlatform,
  unmappedFieldsCount,
}: OverviewProps) {
  const unmappedFields = Object.entries(mappingData.data_type_conversions || {}).flatMap(
    ([table, fields]: [string, any]) =>
      Array.isArray(fields)
        ? fields
            .filter(
              (field) =>
                !field.powerbi_data_type || field.powerbi_data_type === "unknown"
            )
            .map((field) => ({
              table_name: table,
              source_field: field.field_name,
              qlik_type: field.qlik_data_type || "N/A",
            }))
        : []
  );

  return (
    <div className="space-y-6 pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>File Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Application Name:</dt>
                <dd className="text-right break-words max-w-[60%]">
                  {removeTimestampFromFolderName(appName)}
                </dd>
              </div>
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Database Platform:</dt>
                <dd className="text-right break-words max-w-[60%]">
                  {databasePlatform}
                </dd>
              </div>
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Status:</dt>
                <dd className="text-right break-words max-w-[60%]">
                  {mappingData.status || "Unknown"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mapping Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Total Tables:</dt>
                <dd className="text-right">{mappingData.table_details?.table_count || 0}</dd>
              </div>
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Mapped Fields:</dt>
                <dd className="text-right">{mappingData.table_details?.total_field_count || 0}</dd>
              </div>
              <div className="flex justify-between items-start gap-4">
                <dt className="font-medium whitespace-nowrap">Calculated Fields:</dt>
                <dd className="text-right">
                  {unmappedFieldsCount !== undefined
                    ? unmappedFieldsCount
                    : unmappedFields.length || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {unmappedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unmapped Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Table Name</th>
                    <th className="text-left py-3 px-4">Field Name</th>
                    <th className="text-left py-3 px-4">Field Type</th>
                  </tr>
                </thead>
                <tbody>
                  {unmappedFields.map((field: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{field.table_name}</td>
                      <td className="py-3 px-4">{field.source_field}</td>
                      <td className="py-3 px-4">{field.qlik_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
