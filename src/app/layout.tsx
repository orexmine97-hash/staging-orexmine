import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { auth0, isAuthConfigured } from "@/lib/auth0";
import { PublicHeader } from "./public-header";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "OREXMINE — Mineral Showcase",
  description: "Approved, quality-verified mineral inventory from Nigeria's mineral gateway.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = isAuthConfigured ? await auth0.getSession() : null;
  const userName = session?.user ? (session.user.name ?? session.user.email ?? null) : null;

  return (
    <html lang="en" className={`${manrope.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PublicHeader userName={userName} />

        {children}

        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted">
          Live inventory from the transactional API. A representative model is a
          presentation aid, not proof of a batch&rsquo;s grade, quantity, or provenance.
        </footer>
      </body>
    </html>
  );
}
