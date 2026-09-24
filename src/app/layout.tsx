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
        <header className="bg-text text-bg">
          {/* Announcement strip — the buyer promise, plus a quiet staff entry point. */}
          <div className="border-b border-bg/10">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
              <p className="truncate text-[11px] uppercase tracking-wide text-bg/55">
                Approved buyers · QC-passed stock only · Bonded storage, Lagos Free Zone &amp; Jos
              </p>
              <Link href="/console" className="shrink-0 text-[11px] uppercase tracking-wide text-bg/60 hover:text-bg">
                Console →
              </Link>
            </div>
          </div>

          {/* Main bar: wordmark · nav · search · actions. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
            <Link href="/" className="shrink-0 font-heading text-xl font-semibold tracking-tight">
              Orexmine
            </Link>

            <nav className="hidden items-center gap-4 text-sm sm:flex">
              <Link href="/catalog" className="text-bg/75 hover:text-bg">Inventory</Link>
              <span title="Coming soon" className="cursor-default text-bg/35">Orders</span>
              <span title="Coming soon" className="cursor-default text-bg/35">Account</span>
            </nav>

            {/* Native GET search → /catalog?q= (filtered server-side). */}
            <form action="/catalog" className="order-last w-full md:order-none md:w-auto md:flex-1">
              <label className="sr-only" htmlFor="site-search">Search inventory</label>
              <input
                id="site-search"
                type="search"
                name="q"
                placeholder="Search batch, mineral or grade"
                className="w-full rounded-md border border-bg/15 bg-bg px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              <span className="rounded-md border border-bg/25 px-2.5 py-1 text-xs text-bg/80">Saved · 0</span>
              <Link
                href="/catalog"
                className="rounded-md border border-bg/30 px-3.5 py-1.5 text-sm font-medium text-bg transition hover:bg-bg/10"
              >
                Request a quote
              </Link>
            </div>
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
