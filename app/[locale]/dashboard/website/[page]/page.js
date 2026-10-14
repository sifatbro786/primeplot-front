import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { Skeleton } from "@/components/ui/States";
import { PageEditorRoute } from "@/components/website/PageEditorRoute";

// The page key is request data → the editor loads client-side (like project tabs).
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("website") };
}

export default function Page() {
  return (
    <RequirePermission any={["site:manage"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-[32rem] w-full max-w-6xl" />}>
        <PageEditorRoute />
      </Suspense>
    </RequirePermission>
  );
}
