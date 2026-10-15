import { getTranslations } from "next-intl/server";
import { AccountPage, Panel } from "@/components/account/AccountPage";
import { PortalProfile } from "@/components/portal/PortalProfile";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("portal.profile");
  return (
    <AccountPage
      profile={
        <Panel title={t("title")} description={t("description")}>
          <PortalProfile />
        </Panel>
      }
    />
  );
}
