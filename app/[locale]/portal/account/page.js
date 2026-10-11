import { getTranslations } from "next-intl/server";
import { AccountPage } from "@/components/account/AccountPage";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default function Page() {
  return <AccountPage />;
}
