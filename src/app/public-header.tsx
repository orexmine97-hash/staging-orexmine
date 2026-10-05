"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared top chrome. Constrained to the marketing column by default; on the
// console it goes full-bleed so the wordmark/actions line up with the
// full-width identity bar below it.
export function PublicHeader({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const box = pathname.startsWith("/console") ? "px-6" : "mx-auto max-w-6xl px-4";

  return (
    <header className="bg-text text-bg">
      {/* Announcement strip — the buyer promise, plus a quiet staff entry point. */}
      <div className="border-b border-bg/10">
        <div className={`flex items-center justify-between gap-3 py-1.5 ${box}`}>
          <p className="truncate text-[11px] uppercase tracking-wide text-bg/55">
            Approved buyers · QC-passed stock only · Bonded storage, Lagos Free Zone &amp; Jos
          </p>
          <div className="flex shrink-0 items-center gap-3 text-[11px]">
            {userName ? (
              <>
                <span className="max-w-[180px] truncate text-bg/55" title={userName}>{userName}</span>
                <a href="/auth/logout" className="uppercase tracking-wide text-bg/60 hover:text-bg">Sign out</a>
              </>
            ) : (
              <a href="/auth/login" className="uppercase tracking-wide text-bg/60 hover:text-bg">Sign in</a>
            )}
            <Link href="/console" className="uppercase tracking-wide text-bg/60 hover:text-bg">Console →</Link>
          </div>
        </div>
      </div>

      {/* Main bar: wordmark · nav · search · actions. */}
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 py-3 ${box}`}>
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
  );
}
