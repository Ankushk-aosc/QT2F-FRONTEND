// app/(auth)/signin/page.tsx
"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { getLoginRequest } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";
import {
  Button,
  Card,
  Text,
  makeStyles,
  tokens,
  Spinner,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: "16px",
  },
  card: {
    maxWidth: "600px",
    width: "100%",
    padding: "80px 32px",
    display: "flex",
    flexDirection: "column",
    gap: "40px",
    alignItems: "center",
    backgroundColor: "transparent",
    boxShadow: "none",
    border: "none",
    "@media (max-width: 640px)": {
      padding: "48px 24px",
      gap: "32px",
    },
  },
  titleContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "center",
    marginBottom: "0px",
  },
  title: {
    fontSize: "32px",
    fontWeight: "600",
    textAlign: "center",
    color: tokens.colorNeutralForeground1,
    "@media (max-width: 640px)": {
      fontSize: "28px",
    },
  },
  brandName: {
    color: tokens.colorBrandForeground1,
  },
  subtitle: {
    fontSize: "16px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    "@media (max-width: 640px)": {
      fontSize: "14px",
    },
  },
  microsoftButton: {
    width: "100%",
    maxWidth: "500px",
    height: "48px",
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    backgroundColor: "#EFF6FF",
    color: "#1F2937",
    border: `1px solid #DBEAFE`,
    "&:hover": {
      backgroundColor: "#DBEAFE",
    },
    "@media (max-width: 640px)": {
      height: "44px",
      fontSize: "14px",
    },
  },
  visualizationCard: {
    width: "100%",
    maxWidth: "520px",
    padding: "56px 40px",
    backgroundColor: "#FAFBFC",
    border: "1px solid #F0F1F3",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    gap: "48px",
    marginTop: "16px",
    marginBottom: "8px",
    "@media (max-width: 640px)": {
      padding: "40px 24px",
      gap: "32px",
    },
  },
  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    flex: "0 0 auto",
  },
  logoCircle: {
    width: "120px",
    height: "120px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    border: "1px solid #F0F1F3",
    "@media (max-width: 640px)": {
      width: "100px",
      height: "100px",
      borderRadius: "10px",
    },
  },
  logoText: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#1F2937",
    textAlign: "center",
    "@media (max-width: 640px)": {
      fontSize: "14px",
    },
  },
  arrow: {
    fontSize: "40px",
    fontWeight: "300",
    color: "#64748B",
    lineHeight: "1",
    "@media (max-width: 640px)": {
      fontSize: "32px",
    },
  },
  footer: {
    marginTop: "8px",
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: "13px",
    "@media (max-width: 640px)": {
      fontSize: "12px",
      marginTop: "8px",
    },
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    textAlign: "center",
    fontSize: "14px",
  },
  microsoftIcon: {
    width: "20px",
    height: "20px",
  },
});

function SignInContent() {
  const styles = useStyles();
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.replace(redirectTo);
    }
  }, [mounted, isAuthenticated, router, searchParams]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use scoped login request
      const request = getLoginRequest(globalApiScope);
      await instance.loginRedirect(request);
    } catch (err: any) {
      console.error("Login redirect failed:", err);
      setError("Failed to start sign-in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <Spinner label="Loading..." />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.titleContainer}>
          <Text className={styles.title}>
            Welcome to <span className={styles.brandName}>Switchblade</span>
          </Text>
          <Text className={styles.subtitle}>
            Log into your Switchblade Workspace
          </Text>
        </div>

        {loading ? (
          <div style={{ padding: "20px 0" }}>
            <Spinner label="Redirecting to Microsoft..." />
          </div>
        ) : (
          <>
            <Button
              appearance="secondary"
              size="large"
              onClick={handleLogin}
              disabled={loading}
              className={styles.microsoftButton}
            >
              <svg className={styles.microsoftIcon} viewBox="0 0 23 23">
                <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                <rect x="12" y="1" width="10" height="10" fill="#00a4ef" />
                <rect x="1" y="12" width="10" height="10" fill="#7fba00" />
                <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </Button>
            {error && <Text className={styles.error}>{error}</Text>}
          </>
        )}

        <div className={styles.visualizationCard}>
          <div className={styles.logoContainer}>
            <div className={styles.logoCircle}>
              <Image
                src="https://img.icons8.com/?size=100&id=9Kvi1p1F0tUo&format=png&color=000000"
                alt="Tableau"
                width={64}
                height={64}
                unoptimized
              />
            </div>
            <Text className={styles.logoText}>Tableau</Text>
          </div>
          <div className={styles.arrow}>→</div>
          <div className={styles.logoContainer}>
            <div className={styles.logoCircle}>
              <Image
                src="/Fabric_Color_48.svg"
                alt="Fabric"
                width={64}
                height={64}
                unoptimized
              />
            </div>
            <Text className={styles.logoText}>Fabric</Text>
          </div>
        </div>

        <Text className={styles.footer}>
          By continuing, you agree to the terms of service
        </Text>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}