import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { ProjectsPage } from "@/components/projects/ProjectsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("projects") };
}

export default function Page() {
  return (
    <RequirePermission any={["projects:read"]}>
      <ProjectsPage />
    </RequirePermission>
  );
}
