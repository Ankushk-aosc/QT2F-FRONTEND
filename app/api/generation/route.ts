import { NextResponse } from 'next/server';
import { httpClient } from '@/lib/api/httpClient';
import { RECORDS_PATHS, resultPath, normalizeRunResult } from '@/lib/api/runContract';

export const dynamic = 'force-dynamic';

/**
 * Reads one app's report-generation result:
 *
 *   GET {RECORDS_BASE}/report-generation/{app_id}?run_id=...&workspace_id=...
 *
 * This route file did not exist. generationService.getWorkbookResult calls
 * `GET /api/generation?...`, which Next answered with its 404 page; the store
 * treats any 404 as "not ready yet", so the Generation tab in Run Details sat
 * empty forever and looked like a run still in progress rather than a missing
 * route.
 *
 * Note the path mismatch this route bridges: the client calls the stage
 * "generation", upstream serves it under "/report-generation". The record's
 * inner key is `report_result` to match (see RESULT_KEYS).
 *
 * Parameter aliasing matches the assessment/parsing routes -- the stores were
 * written against Tableau's vocabulary and still send workbook_id/project_id.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id') || searchParams.get('workbook_id');
    const workspaceId =
      searchParams.get('workspace_id') || searchParams.get('project_id');
    const runId = searchParams.get('run_id');

    if (!appId) {
      return NextResponse.json(
        { error: 'app_id (or workbook_id) is required' },
        { status: 400 }
      );
    }
    if (!runId) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id (or project_id) is required' },
        { status: 400 }
      );
    }

    const data = await httpClient.get<unknown>(
      resultPath(RECORDS_PATHS.REPORT_GENERATION, { appId, workspaceId, runId }),
      { apiType: 'logs' }
    );

    return NextResponse.json(normalizeRunResult(data, 'generation'), { status: 200 });
  } catch (err: any) {
    console.error('[API /api/generation GET] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch generation result' },
      { status: err?.status || 500 }
    );
  }
}
