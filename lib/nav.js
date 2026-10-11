import {
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Grid3x3,
  Home,
  KanbanSquare,
  Landmark,
  LineChart,
  ScrollText,
  Settings,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Staff navigation. `any` = visible if the user has ANY of these permissions (none = everyone).
 * `phase` marks modules not built yet — they open a "coming in …" page instead of a 404.
 */
export const STAFF_NAV = [
  {
    group: "workspace",
    items: [{ key: "overview", href: "/dashboard", icon: Gauge, exact: true }],
  },
  {
    group: "inventory",
    items: [
      { key: "projects", href: "/dashboard/projects", icon: Building2, any: ["projects:read"], phase: "F3" },
      { key: "units", href: "/dashboard/units", icon: Grid3x3, any: ["units:read"], phase: "F3" },
    ],
  },
  {
    group: "sales",
    items: [
      { key: "leads", href: "/dashboard/leads", icon: ClipboardList, any: ["leads:read_own", "leads:read_all"], phase: "F4" },
      { key: "pipeline", href: "/dashboard/pipeline", icon: KanbanSquare, any: ["leads:read_own", "leads:read_all"], phase: "F4" },
      { key: "bookings", href: "/dashboard/bookings", icon: FileText, any: ["bookings:read"], phase: "F5" },
      { key: "accounts", href: "/dashboard/accounts", icon: Landmark, any: ["accounts:read"], phase: "F5" },
      { key: "reports", href: "/dashboard/reports", icon: LineChart, any: ["reports:read"], phase: "F6" },
    ],
  },
  {
    group: "admin",
    items: [
      { key: "users", href: "/dashboard/users", icon: Users, any: ["users:read"] },
      { key: "audit", href: "/dashboard/audit", icon: ScrollText, any: ["audit:read"] },
      { key: "settings", href: "/dashboard/settings", icon: Settings, any: ["org:update"] },
    ],
  },
];

export const PORTAL_NAV = [
  { key: "home", href: "/portal", icon: Home, exact: true },
  { key: "payments", href: "/portal/payments", icon: Wallet, phase: "F6" },
  { key: "documents", href: "/portal/documents", icon: FileText, phase: "F6" },
  { key: "account", href: "/portal/account", icon: UserRound },
];

export function visibleNav(nav, can) {
  return nav
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.any || can(...i.any)) }))
    .filter((g) => g.items.length);
}

export function isActive(pathname, item) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Find the nav item for a path (for "coming soon" pages and the topbar title). */
export function findNavItem(nav, pathname) {
  const flat = nav.flatMap((g) => g.items ?? [g]);
  return flat
    .filter((i) => isActive(pathname, { ...i, exact: false }))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
