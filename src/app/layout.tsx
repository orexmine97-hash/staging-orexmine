import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "OREXMINE — Mineral Showcase",
  description: "Approved, quality-verified mineral inventory from Nigeria's mineral gateway.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>
        <header className="border-b border-divider bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="font-heading text-xl font-semibold tracking-tight text-accent">
              OREXMINE
            </Link>
            <nav className="flex gap-6 text-sm text-muted">
              <Link href="/" className="hover:text-text">Showcase</Link>
              <Link href="/catalog" className="hover:text-text">Catalog</Link>
              <Link href="/console" className="hover:text-text">Console</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted">
          Live inventory from the transactional API. A representative model is a
          presentation aid, not proof of a batch&rsquo;s grade, quantity, or provenance.
        </footer>
      </body>
    </html>
  );
}
