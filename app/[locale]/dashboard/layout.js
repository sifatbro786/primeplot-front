import { Suspense } from "react";
import { DashboardShell } from "@/components/shell/DashboardShell";

// Static shell; the user (and permission-filtered nav) loads client-side via /auth/me.
// Access is enforced by proxy.js (routing) and the API (data).
export const metadata = { robots: { index: false } };

export default function DashboardLayout({ children }) {
  // The shell reads the pathname (active nav, title): dynamic routes ([...slug]) need a boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-canvas" />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
