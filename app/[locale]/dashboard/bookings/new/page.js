import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { BookingWizard } from "@/components/sales/wizard/BookingWizard";

export async function generateMetadata() {
  const t = await getTranslations("sales.wizard");
  return { title: t("title") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:create"]}>
      <BookingWizard />
    </RequirePermission>
  );
}
