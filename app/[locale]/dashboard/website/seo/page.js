import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { SiteSeoSettings } from "@/components/website/SiteSeoSettings";

export async function generateMetadata() {
  const t = await getTranslations("website.siteSeo");
  return { title: t("title") };
}

export default function Page() {
  return (
    <RequirePermission any={["site:manage"]}>
      <SiteSeoSettings />
    </RequirePermission>
  );
}
