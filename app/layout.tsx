import type { Metadata } from "next";
import FluentProviderClient from "@/components/providers/ClientProviders";
import "./globals.css";
 
export const metadata: Metadata = {
  title: "Switchblade Autonomous Migration",
};
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* ✅ Add suppressHydrationWarning={true} here */}
      <body suppressHydrationWarning={true}>
        <FluentProviderClient>{children}</FluentProviderClient>
      </body>
    </html>
  )
}
 