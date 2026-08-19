import { redirect } from "next/navigation"

/**
 * The application has one entry point.
 *
 * This used to be a "choose your migration path" screen that sat in front of
 * sign-in and set the Qlik/Tableau workspace. It was a second landing surface
 * before the real one, and the choice it captured is now an ordinary setting
 * (Administration Center → Workspace), changeable at any time rather than only
 * once before authenticating.
 *
 * Everything therefore starts at the dashboard. The protected layout sends
 * anyone without a session to /signin and back again afterwards.
 */
export default function RootPage() {
  redirect("/dashboard")
}
