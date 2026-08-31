import type { AccountInfo } from "@azure/msal-browser";

/**
 * Resolve the signed-in user's email from an MSAL account.
 *
 * Why this exists: run history is keyed by email on the backend. The migration
 * pipeline POSTs `user_email` when it records a run, and the Monitoring / Run
 * History tabs read those runs back via `/run-history/by-email/{email}`. Those
 * three call sites had each rolled their own resolution and did not agree —
 * the writer used `account.username` alone while the readers fell back to
 * `homeAccountId.split(".")[0]`. Any Entra ID configuration that leaves
 * `username` empty therefore wrote runs under "" but read them back under an
 * object id, so a user's own runs became invisible to them.
 *
 * The resolution order below is taken from vl-t2f-frontend's AuthSync.tsx,
 * which checks the idTokenClaims before falling back to `username`. Every call
 * site must use this helper so the write and read keys cannot drift again.
 */
export function resolveUserEmail(account: AccountInfo | null | undefined): string {
  if (!account) return "";

  const claims = account.idTokenClaims as Record<string, unknown> | undefined;
  const candidates = [
    claims?.email,
    claims?.preferred_username,
    account.username,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}
