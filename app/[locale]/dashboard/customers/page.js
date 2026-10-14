import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { CustomersPage } from "@/components/sales/CustomersPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("customers") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <CustomersPage />
    </RequirePermission>
  );
}
