"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, canAccess } from "./access";

// Left sidebar. An item is a live link only when the role may access it AND the
// page exists; otherwise it renders greyed, with the reason in a tooltip.
export function ConsoleNav({ role }: { role: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV.map((item) => {
        const permitted = role != null && canAccess(role, item.key);
        const built = item.href != null;
        const enabled = permitted && built;

        if (enabled) {
          // "/console" (action queue) matches exactly only — it's a prefix of
          // every sub-route, so it must not light up for those.
          const active =
            pathname === item.href ||
            (item.href !== "/console" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.key}
              href={item.href!}
              aria-current={active ? "page" : undefined}
              className={`rounded px-3 py-1.5 transition ${
                active ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-divider/40"
              }`}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <span
            key={item.key}
            title={permitted ? "Not built yet" : "Outside your role"}
            className="cursor-default px-3 py-1.5 text-muted/50"
          >
            {item.label}
          </span>
        );
      })}
      <p className="mt-4 px-3 text-[10px] uppercase leading-relaxed tracking-wide text-muted/60">
        Greyed items are outside your role or not built yet.
      </p>
    </nav>
  );
}
