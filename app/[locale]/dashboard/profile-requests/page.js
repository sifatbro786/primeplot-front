import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { ProfileRequestsPage } from "@/components/review/ProfileRequestsPage";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("profileRequests") };
}

export default function Page() {
  return (
    <RequirePermission any={["portal:manage"]}>
      <ProfileRequestsPage />
    </RequirePermission>
  );
}
