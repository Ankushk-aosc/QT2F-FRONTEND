// app/(auth)/signin/page.tsx
"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { Sparkles, TrendingUp, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { getLoginRequest } from "@/lib/auth-constants";
import { globalApiScope } from "@/components/providers/MsalProviderWrapper";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-Driven Migration",
    description: "Leverage 6 intelligent agents",
  },
  {
    icon: TrendingUp,
    title: "Real-time Monitoring",
    description: "Track progress with live telemetry",
  },
  {
    icon: ShieldCheck,
    title: "End-to-End Validation",
    description: "Ensure data accuracy & integrity",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Secure, compliant & trusted",
  },
];

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#00a4ef" />
      <rect x="1" y="12" width="10" height="10" fill="#7fba00" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

function FlowNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        {children}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function SignInContent() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      router.replace(redirectTo);
    }
  }, [mounted, isAuthenticated, router, searchParams]);

  const handleMicrosoftLogin = async () => {
    setMsLoading(true);
    setError(null);
    try {
      const request = getLoginRequest(globalApiScope);
      await instance.loginRedirect(request);
    } catch (err) {
      console.error("Login redirect failed:", err);
      setError("Failed to start sign-in. Please try again.");
      setMsLoading(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 lg:p-10">
      <div className="grid w-full max-w-[1240px] grid-cols-1 overflow-hidden rounded-3xl border border-border bg-white shadow-card lg:min-h-[680px] lg:grid-cols-2 lg:shadow-2xl">
        {/* Marketing panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-background px-10 py-10 xl:px-16 xl:py-12 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,var(--primary-subtle),transparent_60%)]" />

          <div className="relative flex items-center gap-3">
            <Image src="/MigrateIQ_Icon.svg" alt="" width={36} height={36} priority />
            <span className="text-lg font-bold tracking-wide text-foreground">MIGRATEIQ</span>
          </div>

          <div className="relative flex flex-col gap-8 xl:gap-10">
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-extrabold leading-tight text-foreground xl:text-5xl">
                Unified Migration
                <br />
                <span className="text-primary">Platform</span>
              </h1>
              <p className="max-w-md text-base text-muted-foreground xl:text-lg">
                Migrate Tableau &amp; Qlik to Microsoft Fabric with AI-powered automation.
              </p>
            </div>

            <ul className="flex flex-col gap-4 xl:gap-5">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="text-sm text-muted-foreground">{description}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4 xl:gap-6">
              <FlowNode label="Tableau">
                <span className="text-lg font-bold text-[#e97627]">T</span>
              </FlowNode>
              <FlowNode label="Qlik">
                <span className="text-lg font-bold text-[#009845]">Q</span>
              </FlowNode>
              <ArrowRight className="shrink-0 text-muted-foreground" size={20} />
              <FlowNode label="Microsoft Fabric">
                <Image src="/Fabric_Color_48.svg" alt="" width={28} height={28} unoptimized />
              </FlowNode>
            </div>
          </div>

          <p className="relative text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MigrateIQ. All rights reserved.
          </p>
        </div>

        {/* Sign-in panel */}
        <div className="flex items-center justify-center bg-surface-subtle px-6 py-12 sm:px-10 lg:bg-white">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
              <Image src="/MigrateIQ_Icon.svg" alt="" width={40} height={40} className="mb-2 lg:hidden" />
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Sign in with your organization&apos;s Microsoft account to continue</p>
            </div>

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={msLoading}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MicrosoftIcon />
              {msLoading ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
            </button>

            {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

            <p className="mt-8 text-center text-xs text-muted-foreground">
              By continuing, you agree to the terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignInContent />
    </Suspense>
  );
}
