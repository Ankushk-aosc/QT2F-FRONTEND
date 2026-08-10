import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataSource {
  name: string;
  type: string;
  format: string;
  filename: string;
}

interface DataSourcesTabProps {
  dataSources: DataSource[];
}

export default function DataSourcesTab({ dataSources }: DataSourcesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources</CardTitle>
        <CardDescription>Connections and data sources used in the report</CardDescription>
      </CardHeader>
      <CardContent>
        {dataSources.length === 0 ? (
          <p className="text-muted-foreground">No data sources found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Type</th>
                </tr>
              </thead>
              <tbody>
                {dataSources.map((source, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4">{source.name}</td>
                    <td className="py-3 px-4">{source.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}