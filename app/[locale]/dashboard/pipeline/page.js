import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { PipelinePage } from "@/components/crm/PipelinePage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("pipeline") };
}

export default function Page() {
  return (
    <RequirePermission any={["leads:read_own", "leads:read_all"]}>
      <PipelinePage />
    </RequirePermission>
  );
}
