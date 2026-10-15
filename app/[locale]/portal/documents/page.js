import { getTranslations } from "next-intl/server";
import { PortalDocumentsPage } from "@/components/portal/PortalDocuments";

export async function generateMetadata() {
  const t = await getTranslations("portalNav");
  return { title: t("documents") };
}

export default function Page() {
  return <PortalDocumentsPage />;
}
