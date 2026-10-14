import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { WebsitePage } from "@/components/website/WebsitePage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("website") };
}

export default function Page() {
  return (
    <RequirePermission any={["site:manage"]}>
      <WebsitePage />
    </RequirePermission>
  );
}
