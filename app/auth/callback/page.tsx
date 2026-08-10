"use client";

import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useRouter } from "next/navigation";
import { Spinner, makeStyles } from "@fluentui/react-components";

// Optional brief pause to let MSAL state fully settle
const DELAY_MS = 500;

const useStyles = makeStyles({
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});

export default function AuthCallbackPage() {
  const styles = useStyles();
  const { instance, accounts, inProgress } = useMsal();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Wait until MSAL confirms no interaction is in progress
    if (inProgress === InteractionStatus.None) {
      setTimeout(() => {
        // If MSAL successfully mapped an account, routing to dashboard
        if (accounts.length > 0 || instance.getActiveAccount()) {
          console.log("[Auth Callback] Sign in successful. Routing to dashboard...");
          router.replace("/dashboard");
        } else {
          console.warn("[Auth Callback] No account found after interaction. Routing to signin.");
          router.replace("/signin");
        }
      }, DELAY_MS);
    }
  }, [inProgress, accounts, instance, router, mounted]);

  return (
    <div className={styles.container}>
      <Spinner size="large" label="Applying your secure access..." />
    </div>
  );
}
