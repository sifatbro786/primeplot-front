import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { BookingsPage } from "@/components/sales/BookingsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("bookings") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <BookingsPage />
    </RequirePermission>
  );
}
