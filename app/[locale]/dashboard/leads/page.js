import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { LeadsPage } from "@/components/crm/LeadsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("leads") };
}

export default function Page() {
  return (
    <RequirePermission any={["leads:read_own", "leads:read_all"]}>
      <LeadsPage />
    </RequirePermission>
  );
}
