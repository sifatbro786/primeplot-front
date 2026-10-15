import { getTranslations } from "next-intl/server";
import { PortalPaymentsPage } from "@/components/portal/PortalPayments";

export async function generateMetadata() {
  const t = await getTranslations("portalNav");
  return { title: t("payments") };
}

export default function Page() {
  return <PortalPaymentsPage />;
}
