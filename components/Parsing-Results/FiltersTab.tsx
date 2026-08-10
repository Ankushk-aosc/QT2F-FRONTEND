import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Filter {
  name: string;
  condition: string;
  id: string;
  report: string;
}

interface Calculation {
  name: string;
  expression: string;
}

interface FiltersTabProps {
  filters: Filter[];
  calculations: Calculation[];
}

export default function FiltersTab({ filters, calculations }: FiltersTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calculated Columns</CardTitle>
          <CardDescription>Calculated Columns used in the report</CardDescription>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <p className="text-muted-foreground">No calculation fields available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Column Name</th>
                    <th className="text-left py-3 px-4">Expression</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.map((calc, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{calc.name}</td>
                      <td className="py-3 px-4">{calc.expression}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filters used in the report</CardDescription>
        </CardHeader>
        <CardContent>
          {filters.length === 0 ? (
            <p className="text-muted-foreground">No filters found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {filters.map((filter, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4">{filter.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}