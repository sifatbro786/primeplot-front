import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { ChequesPage } from "@/components/sales/ChequesPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("cheques") };
}

export default function Page() {
  return (
    <RequirePermission any={["bookings:read", "bookings:read_all"]}>
      <ChequesPage />
    </RequirePermission>
  );
}
