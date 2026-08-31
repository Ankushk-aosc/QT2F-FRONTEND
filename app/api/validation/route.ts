import { NextResponse } from 'next/server';
import { httpClient } from '@/lib/api/httpClient';
import { RECORDS_PATHS, resultPath, normalizeRunResult } from '@/lib/api/runContract';

export const dynamic = 'force-dynamic';

/**
 * Reads one app's validation result:
 *
 *   GET {RECORDS_BASE}/validation/{app_id}?run_id=...&workspace_id=...
 *
 * This route file did not exist. validationStore.fetchValidationResult calls
 * `GET /api/validation?...`, Next answered with its 404 page, and the store's
 * catch maps any 404 to "worker hasn't finished yet" and stores null -- so the
 * Validation tab rendered its waiting state permanently, with nothing in the
 * console to suggest the route was simply absent.
 *
 * Unlike the other four stages, the upstream path here is inferred from the
 * shared convention rather than confirmed against a live response: validation
 * is absent from the segment list in app/api/history-results/route.ts. The
 * record key `validation_result` IS confirmed, by the reads in
 * components/tabs/MigrationValidationView. If upstream turns out to serve this
 * elsewhere, RECORDS_PATHS.VALIDATION is the one line to change.
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
      resultPath(RECORDS_PATHS.VALIDATION, { appId, workspaceId, runId }),
      { apiType: 'logs' }
    );

    return NextResponse.json(normalizeRunResult(data, 'validation'), { status: 200 });
  } catch (err: any) {
    console.error('[API /api/validation GET] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch validation result' },
      { status: err?.status || 500 }
    );
  }
}
