
import { NextRequest, NextResponse } from "next/server";
import { httpPost, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return NextResponse.json(
                { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
                { status: 401 }
            );
        }

        const body = await req.json();
        
        // Forward the incoming Azure AD token unchanged so the backend can validate it
        const forwardHeaders: Record<string, string> = {
            "Authorization": authHeader
        };

        let allWorkbooks: any[] = [];
        let pageNumber = 1;
        let pageSize = 100;
        let hasMore = true;
        let previousTotal = 0;

        while (hasMore) {
            body.PAGE_NUMBER = pageNumber;
            body.PAGE_SIZE = pageSize;
            body.pageNumber = pageNumber;
            body.pageSize = pageSize;
            body.page_number = pageNumber;
            body.page_size = pageSize;

            console.log(`[API /server/workbooks] Fetching Workbook Page ${pageNumber}`);

            const result = await httpPost<any>(
                "tableau",
                "/server/workbooks",
                body,
                { headers: forwardHeaders }
            );

            const workbooks = result.data.workbooks || [];
            allWorkbooks = [...allWorkbooks, ...workbooks];

            const uniqueMap = new Map();
            allWorkbooks.forEach(wb => {
                const id = wb.id || wb.workbook_id;
                if (wb && id) uniqueMap.set(id, wb);
            });
            allWorkbooks = Array.from(uniqueMap.values());

            if (allWorkbooks.length === previousTotal || workbooks.length === 0) {
                 hasMore = false;
                 break;
            }
            previousTotal = allWorkbooks.length;

            const totalAvailable = result.data.pagination?.totalAvailable || result.data.totalAvailable || result.data.total_available;
            
            if (totalAvailable !== undefined) {
                 if (allWorkbooks.length >= totalAvailable) {
                     hasMore = false;
                 } else {
                     pageNumber++;
                 }
            } else {
                 if (workbooks.length < pageSize) {
                     hasMore = false;
                 } else {
                     pageNumber++;
                 }
            }
        }

        allWorkbooks.sort((a, b) => {
            const nameA = a.name || a.workbook_name || "";
            const nameB = b.name || b.workbook_name || "";
            return nameA.localeCompare(nameB);
        });
        console.log(`[API /server/workbooks] ✅ Total Workbooks Retrieved: ${allWorkbooks.length}`);

        return NextResponse.json({ workbooks: allWorkbooks }, { status: 200 });

    } catch (err: any) {
        const { body, status } = errorResponse(err, "Failed to fetch server workbooks info");
        return NextResponse.json(body, { status });
    }
}
