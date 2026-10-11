import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { TeamPage } from "@/components/team/TeamPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

export default function Page() {
  return (
    <RequirePermission any={["users:read"]}>
      <TeamPage />
    </RequirePermission>
  );
}
