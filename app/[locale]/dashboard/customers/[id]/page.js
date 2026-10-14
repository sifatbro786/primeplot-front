import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { CustomerProfile } from "@/components/sales/CustomerProfile";
import { Skeleton } from "@/components/ui/States";

// The id is only known at request time; the profile loads client-side.
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("customers") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-6xl" />}>
        <CustomerProfile />
      </Suspense>
    </RequirePermission>
  );
}
