import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { OnlinePaymentsPage } from "@/components/review/OnlinePaymentsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("onlinePayments") };
}

export default function Page() {
  return (
    <RequirePermission any={["online_payments:review", "bookings:read_all", "bookings:read"]}>
      <OnlinePaymentsPage />
    </RequirePermission>
  );
}
