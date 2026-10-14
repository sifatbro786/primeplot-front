import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { ReportsPage } from "@/components/sales/ReportsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("reports") };
}

export default function Page() {
  return (
    <RequirePermission any={["reports:read"]}>
      <ReportsPage />
    </RequirePermission>
  );
}
