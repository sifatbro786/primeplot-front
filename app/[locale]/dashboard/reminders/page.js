import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { RemindersPage } from "@/components/review/RemindersPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("reminders") };
}

export default function Page() {
  return (
    <RequirePermission any={["reminders:manage", "reports:read"]}>
      <RemindersPage />
    </RequirePermission>
  );
}
