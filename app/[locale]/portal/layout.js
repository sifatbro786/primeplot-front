import { Suspense } from "react";
import { PortalShell } from "@/components/shell/PortalShell";

export const metadata = { robots: { index: false } };

export default function PortalLayout({ children }) {
  // The shell reads the pathname (active nav, title): dynamic routes ([...slug]) need a boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh flex-1 bg-canvas" />}>
      <PortalShell>{children}</PortalShell>
    </Suspense>
  );
}
