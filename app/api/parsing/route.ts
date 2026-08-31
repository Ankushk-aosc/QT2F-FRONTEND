import { NextResponse } from 'next/server';
import { httpClient } from '@/lib/api/httpClient';
import { RECORDS_PATHS, resultPath, normalizeRunResult } from '@/lib/api/runContract';

export const dynamic = 'force-dynamic';

/**
 * Reads one app's parsing result:
 *
 *   GET {RECORDS_BASE}/parsing/{app_id}?run_id=...&workspace_id=...
 *
 * Same defect as the assessment route: only POST existed, so parsingService's
 * getRunStatus / getWorkbookResult were issuing GETs against a route with no GET
 * handler. Parameter aliasing matches that route -- see its GET for why both
 * spellings are accepted.
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
      resultPath(RECORDS_PATHS.PARSING, { appId, workspaceId, runId }),
      { apiType: 'logs' }
    );

    // See the assessment route: upstream nests the content under
    // parsing_result inside a single-element array.
    return NextResponse.json(normalizeRunResult(data, 'parsing'), { status: 200 });
  } catch (err: any) {
    console.error('[API /api/parsing GET] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch parsing result' },
      { status: err?.status || 500 }
    );
  }
}
