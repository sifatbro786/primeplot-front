import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { IntegrationsPage } from "@/components/crm/IntegrationsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("integrations") };
}

export default function Page() {
  return (
    <RequirePermission any={["settings:integrations", "pipeline:manage"]}>
      <IntegrationsPage />
    </RequirePermission>
  );
}
