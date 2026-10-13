import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { CrmSettingsPage } from "@/components/crm/CrmSettingsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("crmSettings") };
}

export default function Page() {
  return (
    <RequirePermission any={["pipeline:manage"]}>
      <CrmSettingsPage />
    </RequirePermission>
  );
}
