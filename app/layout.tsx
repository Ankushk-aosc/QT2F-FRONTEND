import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ClientProviders from "@/components/providers/ClientProviders";
import "./globals.css";

// Self-hosted at build time instead of a render-blocking `@import` of
// fonts.googleapis.com in globals.css — same family/weights/display:swap,
// just served from this origin with no extra DNS/TLS/request round trip
// before first paint.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MigrateIQ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/*
          MsalProviderWrapper's mount effect fetches this before it can even
          construct the MSAL client, gating every page behind it. Preloading
          lets the browser start that request while the JS bundle is still
          downloading/parsing instead of only after hydration + effect fire,
          overlapping the round trip with work that was already happening.
        */}
        <link rel="preload" href="/api/auth/config" as="fetch" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning={true}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
 