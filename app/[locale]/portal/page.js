import { getTranslations } from "next-intl/server";
import { PortalHome } from "@/components/dashboard/PortalHome";

export async function generateMetadata() {
  const t = await getTranslations("portalNav");
  return { title: t("home") };
}

export default function PortalPage() {
  return <PortalHome />;
}
