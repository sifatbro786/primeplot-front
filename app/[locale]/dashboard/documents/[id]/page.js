import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { DocumentViewer } from "@/components/sales/Documents";
import { Skeleton } from "@/components/ui/States";

// The id is only known at request time; the document loads client-side.
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("sales.documents");
  return { title: t("title") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-[40rem] w-full max-w-5xl" />}>
        <DocumentViewer />
      </Suspense>
    </RequirePermission>
  );
}
