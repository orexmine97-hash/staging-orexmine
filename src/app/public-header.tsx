"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, MapPin, Phone, Search } from "lucide-react";

// Gem mark used in the nav and footer.
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(160deg, #f2b98f, #c86f3c)",
          clipPath: "polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)",
        }}
      />
      <span className="font-heading text-base font-bold tracking-[0.16em]">OREXMINE</span>
    </span>
  );
}

// Floating glass nav. Constrained to the marketing column; full-bleed on the
// console so it lines up with the identity bar below it.
export function PublicHeader({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const onConsole = pathname.startsWith("/console");
  const box = onConsole ? "" : "mx-auto max-w-[1280px]";

  const links = [
    { label: "Inventory", href: "/catalog", on: pathname.startsWith("/catalog") },
    { label: "How it works", href: "/#how", on: false },
    { label: "For suppliers", href: "/#suppliers", on: false },
  ];

  return (
    <header className="relative z-20 px-4 pt-3.5 sm:px-[clamp(16px,3vw,40px)]">
      <nav
        aria-label="Main"
        className={`${box} flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/95 py-2 pl-[18px] pr-2 backdrop-blur-xl`}
        style={{
          background: "linear-gradient(135deg, rgba(251,252,250,0.88), rgba(251,252,250,0.66))",
          boxShadow: "inset 0 1px 0 #fff, 0 18px 40px -24px rgba(15,26,23,0.35)",
        }}
      >
        <Link href="/" aria-label="OREXMINE home" className="flex min-h-11 shrink-0 items-center">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              aria-current={l.on ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-sm ${
                l.on ? "bg-ink/[0.07] font-bold text-ink" : "font-medium text-[#2c3a35] hover:bg-ink/5"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          {/* Native GET search → /catalog?q= (filtered server-side). */}
          <form action="/catalog" className="hidden max-w-[320px] flex-1 lg:block">
            <label className="flex min-h-11 cursor-text items-center gap-2.5 rounded-xl border border-ink/15 bg-white/70 px-3.5 text-muted">
              <Search size={18} aria-hidden="true" className="shrink-0" />
              <span className="sr-only">Search inventory</span>
              <input
                type="search"
                name="q"
                placeholder="Search batch, mineral or grade"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink placeholder:text-muted focus:outline-none"
              />
            </label>
          </form>
          {!onConsole && (
            <>
              {/* ponytail: visual placeholders — prices are stored in ₦ only and saving isn't built yet. */}
              <div role="group" aria-label="Currency" className="hidden shrink-0 gap-0.5 rounded-xl border border-ink/10 bg-ink/5 p-[3px] xl:flex">
                <button type="button" aria-pressed="true" className="min-h-9 rounded-[9px] bg-ink px-2.5 text-[13px] font-bold text-[#f4f6f2]">₦ NGN</button>
                <button type="button" aria-pressed="false" disabled title="Coming soon" className="min-h-9 rounded-[9px] px-2.5 text-[13px] font-bold text-[#2c3a35]">$ USD</button>
              </div>
              <span title="Coming soon" className="hidden min-h-11 shrink-0 items-center rounded-xl border border-ink/10 px-3 text-[13px] font-bold text-[#2c3a35] xl:inline-flex">
                Saved · 0
              </span>
            </>
          )}
          <Link
            href="/catalog"
            aria-label="Search inventory"
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-ink/5 lg:hidden"
          >
            <Search size={18} aria-hidden="true" />
          </Link>

          {userName ? (
            <>
              <Link href="/console" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-bold sm:inline-flex">
                Console
              </Link>
              <a
                href="/auth/logout"
                title={userName}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-muted hover:text-ink"
              >
                Sign out
              </a>
            </>
          ) : (
            <a href="/auth/login" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold">
              Sign in
            </a>
          )}
          {!onConsole && (
            <Link
              href="/#start"
              className="hidden min-h-11 items-center whitespace-nowrap rounded-xl bg-accent px-[18px] sm:inline-flex text-sm font-bold text-[#fbfcfa] hover:opacity-90"
            >
              Get started
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

const FOOTER_NAV: [string, [string, string][]][] = [
  ["Trade", [["Inventory", "/catalog"], ["Sign in", "/auth/login"], ["Request a quote", "/catalog"]]],
  ["Company", [["How it works", "/#how"], ["For suppliers", "/#suppliers"], ["Compliance", "/#compliance"]]],
];

// Marketing footer — the console is a work surface, so it gets none.
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/console")) return null;

  return (
    <footer className="border-t border-divider bg-soft">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-8 px-[clamp(16px,3vw,40px)] pb-8 pt-16">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex min-h-11 items-center"><Wordmark size={20} /></Link>
          <span className="text-sm text-muted">Nigeria&rsquo;s Mineral Gateway</span>
        </div>
        {FOOTER_NAV.map(([title, items]) => (
          <nav key={title} aria-label={title} className="flex flex-col text-[15px]">
            <span className="mb-1.5 font-heading text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</span>
            {items.map(([label, href]) => (
              <a key={label} href={href} className="flex min-h-11 items-center">{label}</a>
            ))}
          </nav>
        ))}
        {/* Placeholder contact details from the design (staging only). */}
        <address className="flex flex-col gap-3 text-[15px] not-italic">
          <span className="font-heading text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">Contact</span>
          <span className="flex items-center gap-2.5"><MapPin size={16} className="shrink-0 text-muted" />12 Idowu Taylor Street, Victoria Island, Lagos</span>
          <span className="flex items-center gap-2.5"><Mail size={16} className="shrink-0 text-muted" />trade@orexmine.com</span>
          <span className="flex items-center gap-2.5"><Phone size={16} className="shrink-0 text-muted" />+234 201 700 4410</span>
        </address>
      </div>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-divider px-[clamp(16px,3vw,40px)] py-3 text-[13px] text-muted">
        <span>
          © 2026 Orexmine Limited · RC 1874562 · Illustrations and 3D models are presentation aids,
          not proof of a batch&rsquo;s grade, quantity, or provenance.
        </span>
        <span className="flex gap-2">
          <a href="#" className="inline-flex min-h-11 items-center px-2">Privacy</a>
          <a href="#" className="inline-flex min-h-11 items-center px-2">Terms</a>
        </span>
      </div>
    </footer>
  );
}
