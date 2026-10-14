import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { AccountsPage } from "@/components/sales/AccountsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("accounts") };
}

export default function Page() {
  return (
    <RequirePermission any={["accounts:read", "bookings:read_all"]}>
      <AccountsPage />
    </RequirePermission>
  );
}
