import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Table {
  name: string;
  fields: number;
  fieldNames: Array<{ Name: string; dataType: string }>;
}
 
interface TablesEntitiesTabProps {
  tables: Table[];
}

export default function TablesEntitiesTab({ tables }: TablesEntitiesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tables & Entities</CardTitle>
        <CardDescription>Tables and entities used in the report</CardDescription>
      </CardHeader>
      <CardContent>
        {tables.length === 0 ? (
          <p className="text-muted-foreground">No tables found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Number of Fields</th>
                  <th className="text-left py-3 px-4">View Fields</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((table, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4">{table.name}</td>
                    <td className="py-3 px-4">{table.fields}</td>
                    <td className="py-3 px-4">
                      {table.fieldNames?.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                              View Fields
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto max-w-[500px] p-2 max-h-[300px] overflow-y-auto">
                            <div className="space-y-1">
                              {table.fieldNames.map((field, field_index) => (
                                <div
                                  key={field_index}
                                  className="text-sm text-muted-foreground whitespace-nowrap px-2 py-1"
                                >
                                  {field.Name}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </td>
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