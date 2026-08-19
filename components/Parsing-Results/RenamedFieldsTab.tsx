// // import { useState } from "react";
// // import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// // interface ColumnRename {
// //   previous_name: string;
// //   renamed: string;
// // }

// // interface TableRename {
// //   table_name: string;
// //   column_renames: ColumnRename[];
// // }

// // interface RenamedFieldsTabProps {
// //   tableRenames: TableRename[];
// // }

// // export default function RenamedFieldsTab({ tableRenames }: RenamedFieldsTabProps) {
// //   const [selectedTable, setSelectedTable] = useState("");

// //   return (
// //     <Card>
// //       <CardHeader>
// //         <CardTitle>Renamed Fields</CardTitle>
// //         <CardDescription>Renamed Fields</CardDescription>
// //       </CardHeader>
// //       <CardContent>
// //         {tableRenames.length === 0 ? (
// //           <p className="text-muted-foreground">No renamed fields available</p>
// //         ) : (
// //           <>
// //             <div className="mb-4">
// //               <select
// //                 value={selectedTable}
// //                 onChange={(e) => setSelectedTable(e.target.value)}
// //                 className="w-[200px] p-2 border rounded-md"
// //                 style={{ backgroundColor: "#ffffff", borderColor: "#000000", color: "#000000" }}
// //               >
// //                 <option value="" disabled hidden>
// //                   Select a table
// //                 </option>
// //                 {tableRenames.map((table, index) => (
// //                   <option key={index} value={table.table_name}>
// //                     {table.table_name}
// //                   </option>
// //                 ))}
// //               </select>
// //             </div>
// //             <div className="overflow-x-auto">
// //               {selectedTable &&
// //               tableRenames.find((table) => table.table_name === selectedTable)?.column_renames?.length > 0 ? (
// //                 <table className="w-full border-collapse">
// //                   <thead>
// //                     <tr className="border-b">
// //                       <th className="text-left py-3 px-4">Table</th>
// //                       <th className="text-left py-3 px-4">Qlik Column Name</th>
// //                       <th className="text-left py-3 px-4">Fabric Column Name</th>
// //                     </tr>
// //                   </thead>
// //                   <tbody>
// //                     {tableRenames
// //                       .find((table) => table.table_name === selectedTable)
// //                       ?.column_renames.map((rename, index) => (
// //                         <tr key={index} className="border-b">
// //                           <td className="py-3 px-4">{selectedTable}</td>
// //                           <td className="py-3 px-4">{rename.previous_name}</td>
// //                           <td className="py-3 px-4">{rename.renamed}</td>
// //                         </tr>
// //                       ))}
// //                   </tbody>
// //                 </table>
// //               ) : (
// //                 <p className="text-muted-foreground">
// //                   {selectedTable ? "No renamed fields available for this table" : "Please select a table to view renamed fields"}
// //                 </p>
// //               )}
// //             </div>
// //           </>
// //         )}
// //       </CardContent>
// //     </Card>
// //   );
// // }

// import { useState } from "react";
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// interface ColumnRename {
//   previous_name: string;
//   renamed: string;
// }

// interface TableRename {
//   table_name: string;
//   column_renames: ColumnRename[];
// }

// interface RenamedFieldsTabProps {
//   tableRenames: TableRename[];
// }

// export default function RenamedFieldsTab({ tableRenames }: RenamedFieldsTabProps) {
//   const [selectedTable, setSelectedTable] = useState("");

//   // Helper to check if a rename is "true" (not equal and not just table-prefixed)
//   const isTrueRename = (tableName: string, rename: ColumnRename) => {
//     return (
//       rename.previous_name !== rename.renamed &&
//       rename.renamed !== `${tableName}.${rename.previous_name}`
//     );
//   };

//   // Filter tables that have at least one true rename
//   const tablesWithRenames = tableRenames.filter((table) =>
//     table.column_renames.some((rename) => isTrueRename(table.table_name, rename))
//   );

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Renamed Fields</CardTitle>
//         <CardDescription>Fields that have been renamed during migration</CardDescription>
//       </CardHeader>
//       <CardContent>
//         {tablesWithRenames.length === 0 ? (
//           <p className="text-muted-foreground">No renamed fields available</p>
//         ) : (
//           <>
//             <div className="mb-4">
//               <select
//                 value={selectedTable}
//                 onChange={(e) => setSelectedTable(e.target.value)}
//                 className="w-[200px] p-2 border rounded-md"
//                 style={{ backgroundColor: "#ffffff", borderColor: "#000000", color: "#000000" }}
//               >
//                 <option value="" disabled hidden>
//                   Select a table
//                 </option>
//                 {tablesWithRenames.map((table) => (
//                   <option key={table.table_name} value={table.table_name}>
//                     {table.table_name}
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div className="overflow-x-auto">
//               {selectedTable ? (
//                 (() => {
//                   const selected = tablesWithRenames.find((t) => t.table_name === selectedTable);
//                   const actualRenames = selected?.column_renames.filter((rename) =>
//                     isTrueRename(selectedTable, rename)
//                   ) || [];

//                   return actualRenames.length > 0 ? (
//                     <table className="w-full border-collapse">
//                       <thead>
//                         <tr className="border-b">
//                           <th className="text-left py-3 px-4">Table</th>
//                           <th className="text-left py-3 px-4">Data Source Column</th>
//                           <th className="text-left py-3 px-4">Qlik</th>
//                           <th className="text-left py-3 px-4">Fabric</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {actualRenames.map((rename, index) => (
//                           <tr key={index} className="border-b">
//                             <td className="py-3 px-4">{selectedTable}</td>
//                             <td className="py-3 px-4">{rename.previous_name}</td>
//                             <td className="py-3 px-4">{rename.renamed}</td>
//                             <td className="py-3 px-4">{rename.renamed}</td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   ) : (
//                     <p className="text-muted-foreground">
//                       No renamed fields available for this table
//                     </p>
//                   );
//                 })()
//               ) : (
//                 <p className="text-muted-foreground">Please select a table to view renamed fields</p>
//               )}
//             </div>
//           </>
//         )}
//       </CardContent>
//     </Card>
//   );
// }
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ColumnRename {
  previous_name: string;
  renamed: string;
}

interface TableRename {
  table_name: string;
  column_renames: ColumnRename[];
}

interface RenamedFieldsTabProps {
  tableRenames: TableRename[];
}

export default function RenamedFieldsTab({ tableRenames }: RenamedFieldsTabProps) {
  const [selectedTable, setSelectedTable] = useState<string>("");

  // Helper: determines if it's a real rename (not just table prefix added)
  const isTrueRename = (tableName: string, rename: ColumnRename): boolean => {
    return (
      rename.previous_name !== rename.renamed &&
      rename.renamed !== `${tableName}.${rename.previous_name}`
    );
  };

  // Only include tables that have at least one true rename
  const tablesWithRenames = tableRenames.filter((table) =>
    table.column_renames.some((rename) => isTrueRename(table.table_name, rename))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Renamed Fields</CardTitle>
        <CardDescription>
          Fields that have been renamed during migration
        </CardDescription>
      </CardHeader>

      <CardContent>
        {tablesWithRenames.length === 0 ? (
          <p className="text-muted-foreground">No renamed fields available</p>
        ) : (
          <>
            <div className="mb-4">
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-[200px] p-2 border rounded-md"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#000000",
                  color: "#000000",
                }}
              >
                <option value="" disabled hidden>
                  Select a table
                </option>
                {tablesWithRenames.map((table) => (
                  <option key={table.table_name} value={table.table_name}>
                    {table.table_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              {selectedTable ? (
                (() => {
                  const selected = tablesWithRenames.find(
                    (t) => t.table_name === selectedTable
                  );

                  const actualRenames =
                    selected?.column_renames.filter((rename) =>
                      isTrueRename(selectedTable, rename)
                    ) || [];

                  return actualRenames.length > 0 ? (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-4 whitespace-nowrap w-[160px]">
                            Table
                          </th>
                          <th className="text-left py-3 px-4 whitespace-nowrap w-[260px]">
                            Original Column Name (Qlik)
                          </th>
                          <th className="text-left py-3 px-4 whitespace-nowrap w-[260px]">
                            Renamed Column Name (Fabric)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {actualRenames.map((rename, index) => (
                          <tr
                            key={index}
                            className="border-b hover:bg-muted/20"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              {selectedTable}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {rename.previous_name}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {rename.renamed}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted-foreground">
                      No renamed fields available for this table
                    </p>
                  );
                })()
              ) : (
                <p className="text-muted-foreground">
                  Please select a table to view renamed fields
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}