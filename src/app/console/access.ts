// Console navigation + per-role module access. Imported by both the sidebar
// (nav.tsx, greying) and proxy.ts (enforcement) so the two never drift — a
// greyed item a user can still reach by URL would be security theatre.
//
// Role values are UserRole (@prisma/client) as plain strings, kept string-typed
// so proxy.ts pulls in no Prisma runtime. ADMIN (System Administrator, §5) is
// the super admin: canAccess() short-circuits true for it, so it sees all.

export type NavItem = { key: string; label: string; href: string | null };

// href null = modeled in the schema but no UI yet (rendered greyed "not built").
export const NAV: NavItem[] = [
  { key: "action-queue", label: "Action queue", href: "/console" },
  { key: "suppliers", label: "Suppliers", href: null },
  { key: "procurement", label: "Procurement", href: "/console/procurement" },
  { key: "qc", label: "Receiving & QC", href: "/console/qc" },
  { key: "inventory", label: "Inventory", href: "/console/inventory" },
  { key: "buyers", label: "Buyers", href: null },
  { key: "trade-desk", label: "Trade desk", href: null },
  { key: "logistics", label: "Logistics", href: null },
  { key: "finance", label: "Finance", href: null },
  { key: "compliance", label: "Compliance", href: null },
  { key: "reports", label: "Reports", href: null },
  { key: "audit", label: "Audit log", href: "/console/audit" },
  { key: "administration", label: "Administration", href: "/console/administration" },
];

// Which roles may access each module (per FRD §5). ADMIN is omitted — it always
// passes via canAccess(). Empty array = ADMIN-only (audit, administration).
const ALL_STAFF = ["PROCUREMENT", "SALES", "QUALITY_COMPLIANCE", "WAREHOUSE_LOGISTICS", "FINANCE"];
export const MODULE_ROLES: Record<string, string[]> = {
  "action-queue": ALL_STAFF,
  suppliers: ["PROCUREMENT"],
  procurement: ["PROCUREMENT"],
  qc: ["QUALITY_COMPLIANCE"],
  inventory: ALL_STAFF,
  buyers: ["SALES"],
  "trade-desk": ["SALES"],
  logistics: ["WAREHOUSE_LOGISTICS"],
  finance: ["FINANCE"],
  compliance: ["QUALITY_COMPLIANCE"],
  reports: ALL_STAFF,
  audit: [], // ADMIN only
  administration: [], // ADMIN only
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "System Administrator",
  PROCUREMENT: "Procurement Officer",
  SALES: "Trade Desk",
  QUALITY_COMPLIANCE: "Quality & Compliance",
  WAREHOUSE_LOGISTICS: "Warehouse & Logistics",
  FINANCE: "Finance Officer",
};

export function canAccess(role: string, moduleKey: string): boolean {
  if (role === "ADMIN") return true;
  return (MODULE_ROLES[moduleKey] ?? []).includes(role);
}

// "/console" -> action-queue; "/console/procurement" -> procurement; etc.
// An unbuilt segment maps to its own key (denied unless the role allows it).
const PATH_MODULE: Record<string, string> = {
  "": "action-queue",
  procurement: "procurement",
  qc: "qc",
  inventory: "inventory",
  audit: "audit",
  administration: "administration",
};
export function moduleForPath(pathname: string): string {
  const seg = pathname.replace(/^\/console\/?/, "").split("/")[0];
  return PATH_MODULE[seg] ?? seg;
}
