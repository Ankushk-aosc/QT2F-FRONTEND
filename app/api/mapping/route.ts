// app/api/mapping/route.ts
import { NextResponse } from 'next/server';
import { httpClient } from '@/lib/api/httpClient';
import { RECORDS_PATHS, resultPath, normalizeRunResult } from '@/lib/api/runContract';

export const dynamic = 'force-dynamic';

/**
 * Reads one app's mapping result:
 *
 *   GET {RECORDS_BASE}/mapping/{app_id}?run_id=...&workspace_id=...
 *
 * This handler did not exist. mappingService.getWorkbookResult has always
 * issued `GET /api/mapping?...`, and a Next route that exports only POST
 * answers a GET with 405 -- so every read failed, mappingStore swallowed it,
 * and the Mapping tab in Run Details was permanently blank. Same defect the
 * assessment and parsing routes were already fixed for; see the note on
 * parsing's GET for why both parameter spellings are accepted.
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
      resultPath(RECORDS_PATHS.MAPPING, { appId, workspaceId, runId }),
      { apiType: 'logs' }
    );

    // Upstream nests the content under mapping_result inside a single-element
    // array, exactly as assessment and parsing do.
    return NextResponse.json(normalizeRunResult(data, 'mapping'), { status: 200 });
  } catch (err: any) {
    console.error('[API /api/mapping GET] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch mapping result' },
      { status: err?.status || 500 }
    );
  }
}
