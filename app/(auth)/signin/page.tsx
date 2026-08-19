// app/(auth)/signin/page.tsx
"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { getLoginRequest } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

function SignInContent() {
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
      <div className="signin-container">
        <Card className="signin-card">
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <Spinner label="Loading..." />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="signin-container">
      <Card className="signin-card">
        <div className="signin-title-container">
          <span className="signin-title">
            Welcome to <span className="signin-brand-name">Switchblade</span>
          </span>
          <span className="signin-subtitle">
            Log into your Switchblade Workspace
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "20px 0" }}>
            <Spinner label="Redirecting to Microsoft..." />
          </div>
        ) : (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleLogin}
              disabled={loading}
              className="signin-microsoft-button"
            >
              <svg className="signin-microsoft-icon" viewBox="0 0 23 23">
                <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                <rect x="12" y="1" width="10" height="10" fill="#00a4ef" />
                <rect x="1" y="12" width="10" height="10" fill="#7fba00" />
                <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </Button>
            {error && <span className="signin-error">{error}</span>}
          </>
        )}

        <div className="signin-visualization-card">
          <div className="signin-logo-container">
            <div className="signin-logo-circle" aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", fontWeight: 700, color: "#1e40af" }}>
              T
            </div>
            <span className="signin-logo-text">Tableau</span>
          </div>
          <div className="signin-arrow">→</div>
          <div className="signin-logo-container">
            <div className="signin-logo-circle">
              <Image
                src="/Fabric_Color_48.svg"
                alt="Fabric"
                width={64}
                height={64}
                unoptimized
              />
            </div>
            <span className="signin-logo-text">Fabric</span>
          </div>
        </div>

        <span className="signin-footer">
          By continuing, you agree to the terms of service
        </span>
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
