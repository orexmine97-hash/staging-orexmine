import type { Metadata } from "next";
import { Montserrat, Mulish } from "next/font/google";
import { auth0, isAuthConfigured } from "@/lib/auth0";
import { PublicHeader, SiteFooter } from "./public-header";
import "./globals.css";

const mulish = Mulish({ subsets: ["latin"], variable: "--font-mulish" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "OREXMINE — Mineral Showcase",
  description: "Approved, quality-verified mineral inventory from Nigeria's mineral gateway.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = isAuthConfigured ? await auth0.getSession() : null;
  const userName = session?.user ? (session.user.name ?? session.user.email ?? null) : null;

  return (
    <html lang="en" className={`${mulish.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PublicHeader userName={userName} />

        {children}

        <SiteFooter />
      </body>
    </html>
  );
}
