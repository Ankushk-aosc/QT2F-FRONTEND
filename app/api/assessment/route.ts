
import { NextResponse } from 'next/server';
import { httpClient } from '@/lib/api/httpClient';
import { RECORDS_PATHS, resultPath, normalizeRunResult } from '@/lib/api/runContract';

export const dynamic = 'force-dynamic';

/**
 * Reads one app's assessment result:
 *
 *   GET {RECORDS_BASE}/assessment/{app_id}?run_id=...&workspace_id=...
 *
 * This route previously exported POST only, so every reader here -- agent.store's
 * fetchAssessmentData and its polling loop, plus assessmentService -- was issuing
 * a GET against a route with no GET handler and getting 405. That is the path
 * MigrationOverview's assessment data comes from, which is why the overview had
 * nothing to show.
 *
 * Callers use the Tableau-era parameter names inherited from the shared stores,
 * so both spellings are accepted and mapped onto the current contract:
 *
 *   workbook_id | app_id       -> {app_id} path segment
 *   project_id  | workspace_id -> workspace_id  (the QLIK SPACE, not Fabric)
 *   run_id                     -> run_id
 *
 * Accepting both keeps every existing call site working untouched.
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
      resultPath(RECORDS_PATHS.ASSESSMENT, { appId, workspaceId, runId }),
      { apiType: 'logs' }
    );

    // Upstream answers [{ id, run_id, workspace_id, app_id, assessment_result }]
    // but every caller tests data.status / data.payload at the top level, so the
    // raw form would be thrown away. See normalizeRunResult.
    return NextResponse.json(normalizeRunResult(data, 'assessment'), { status: 200 });
  } catch (err: any) {
    console.error('[API /api/assessment GET] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch assessment result' },
      { status: err?.status || 500 }
    );
  }
}
