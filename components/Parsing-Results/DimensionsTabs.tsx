import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Dimension {
  name: string;
  expression: string;
  table: string;
} 

interface DimensionsTabProps {
  dimensions: Dimension[];
}

export default function DimensionsTab({ dimensions }: DimensionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dimensions</CardTitle>
        <CardDescription>Dimensions used in the report</CardDescription>
      </CardHeader>
      <CardContent>
        {dimensions.length === 0 ? (
          <p className="text-muted-foreground">No dimensions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Field Name</th>
                  <th className="text-left py-3 px-4">Expression</th>
                  <th className="text-left py-3 px-4">Table</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dim, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4">{dim.name}</td>
                    <td className="py-3 px-4">{dim.expression}</td>
                    <td className="py-3 px-4">{dim.table}</td>
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