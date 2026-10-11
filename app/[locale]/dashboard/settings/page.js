import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { SettingsPage } from "@/components/settings/SettingsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default function Page() {
  return (
    <RequirePermission any={["org:update"]}>
      <SettingsPage />
    </RequirePermission>
  );
}
