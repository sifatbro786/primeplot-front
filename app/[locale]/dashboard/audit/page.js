import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { AuditPage } from "@/components/audit/AuditPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("audit") };
}

export default function Page() {
  return (
    <RequirePermission any={["audit:read"]}>
      <AuditPage />
    </RequirePermission>
  );
}
