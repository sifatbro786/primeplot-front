import { Suspense } from "react";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { ProjectShell } from "@/components/projects/ProjectShell";
import { Skeleton } from "@/components/ui/States";

// The project id is only known at request time → useParams() suspends under cacheComponents,
// and every tab loads its data client-side (TanStack Query). Navigation into a project is
// therefore allowed to show the skeleton first — opt the segment out of instant validation.
export const instant = false;

export default function ProjectLayout({ children }) {
  return (
    <RequirePermission any={["projects:read"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-7xl" />}>
        <ProjectShell>{children}</ProjectShell>
      </Suspense>
    </RequirePermission>
  );
}
