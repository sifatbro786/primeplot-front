import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { TasksPage } from "@/components/crm/TasksPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("tasks") };
}

export default function Page() {
  return (
    <RequirePermission any={["leads:read_own", "leads:read_all"]}>
      <TasksPage />
    </RequirePermission>
  );
}
