import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { SlipQueuePage } from "@/components/review/SlipQueuePage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("paymentSlips") };
}

export default function Page() {
  return (
    <RequirePermission any={["payment_slips:verify", "bookings:read_all", "bookings:read"]}>
      <SlipQueuePage />
    </RequirePermission>
  );
}
