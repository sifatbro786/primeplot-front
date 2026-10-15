import { getTranslations } from "next-intl/server";
import { PortalDocumentViewer } from "@/components/portal/PortalDocuments";

export async function generateMetadata() {
  const t = await getTranslations("portal.documents");
  return { title: t("viewerTitle") };
}

export default function Page() {
  return <PortalDocumentViewer />;
}
