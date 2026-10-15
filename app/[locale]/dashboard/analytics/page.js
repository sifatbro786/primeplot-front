import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { AnalyticsPage } from "@/components/analytics/AnalyticsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

export default function Page() {
  return (
    <RequirePermission any={["analytics:read", "reports:read"]}>
      <AnalyticsPage />
    </RequirePermission>
  );
}
