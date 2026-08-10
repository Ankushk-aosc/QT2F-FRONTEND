import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeaderCardsProps {
  appName: string;
  reportType: string;
  dataModel: string;
  factTablesCount: number;
  dimensionTablesCount: number;
}

export default function HeaderCards({
  appName,
  reportType,
  dataModel,
  factTablesCount,
  dimensionTablesCount,
}: HeaderCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Application Name</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="text-2xl break-words overflow-wrap-break-word">{appName}</div>
        </CardContent>
      </Card>
      <Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium">Data Model</CardTitle>
  </CardHeader>
  <CardContent className="pb-2">
    <div className="text-2xl">{dataModel}</div>
  </CardContent>
</Card>
      <Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium">Dimensional Model</CardTitle>
  </CardHeader>
  <CardContent className="pb-2">
    <div className="text-2xl">{reportType}</div>
    <p className="text-xs text-muted-foreground">
      {factTablesCount} {factTablesCount === 1 ? "Table" : "Tables"},{" "}
      {dimensionTablesCount} {dimensionTablesCount === 1 ? "Dimension" : "Dimensions"}
    </p>
  </CardContent>
</Card>
    </div>
  );
}