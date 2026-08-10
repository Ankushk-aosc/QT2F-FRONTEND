import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Measure {
  name: string;
  expression: string;
  table: string;
}

interface MeasuresTabProps {
  measures: Measure[];
}

export default function MeasuresTab({ measures }: MeasuresTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measures</CardTitle>
        <CardDescription>Measures used in the report</CardDescription>
      </CardHeader>
      <CardContent>
        {measures.length === 0 ? (
          <p className="text-muted-foreground">No measures found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 w-1/2">Field Name</th>
                  <th className="text-left py-3 px-4 w-1/2">Expression</th>
                </tr>
              </thead>
              <tbody>
                {measures.map((measure, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4 w-1/2">{measure.name}</td>
                    <td className="py-3 px-4 w-1/2">{measure.expression}</td>
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