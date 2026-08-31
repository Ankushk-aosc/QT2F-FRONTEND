import { redirect } from "next/navigation";

/**
 * The bare domain root has no content of its own.
 *
 * It used to render a standalone "Choose Your Migration Path" picker here —
 * duplicate of `/migrations` (same Qlik/Tableau choice, worse: fixed-pixel
 * cards with no responsive breakpoints, an external icons8.com image, and a
 * leftover hardcoded Fluent-blue accent color) and, because it sits outside
 * both the `(auth)` and `(protected)` route groups, reachable without
 * signing in at all. `/dashboard` is behind `AuthGuard`, so this now always
 * resolves through the real auth check instead of offering a second,
 * unguarded entry point.
 */
export default function RootPage() {
  redirect("/dashboard");
}
