import type { Metadata } from "next";
import ClientProviders from "@/components/providers/ClientProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "MigrateIQ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
 