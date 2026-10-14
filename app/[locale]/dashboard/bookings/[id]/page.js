import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { BookingDetail } from "@/components/sales/BookingDetail";
import { Skeleton } from "@/components/ui/States";

// The id is only known at request time; the booking loads client-side.
export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("bookings") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-[32rem] w-full max-w-7xl" />}>
        <BookingDetail />
      </Suspense>
    </RequirePermission>
  );
}
