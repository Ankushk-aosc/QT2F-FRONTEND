import { NextRequest, NextResponse } from "next/server";

/**
 * API Proxy for re-running validation on a single workbook.
 * This route forwards the request to the Semantic Kernel backend service.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const semanticBase = process.env.SEMANTIC_KERNEL_URL;
        if (!semanticBase) {
            throw new Error("SEMANTIC_KERNEL_URL is not defined in environment variables");
        }
        // Semantic Kernel exposes no /run-single-validation. Validation runs as a
        // stage of /invoke-batch; there is no single-workbook re-run endpoint.
        console.warn(
            `[Run-Single-Validation] No upstream endpoint exists (run ${body.run_id}) — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Re-running validation for a single workbook is not supported.",
                details:
                    "Semantic Kernel runs validation as a stage of POST /api/migration/invoke-batch. " +
                    "Read validation results from GET /api/validation.",
            },
            { status: 501 }
        );

    } catch (err: any) {
        console.error(`[Revalidate-Single] Connection Error:`, err.message);
        return NextResponse.json(
            { error: `Failed to re-run validation. Details: ${err.message}` },
            { status: err.status || 500 }
        );
    }
}
