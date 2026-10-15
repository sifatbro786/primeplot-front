import { getTranslations } from "next-intl/server";
import { PaymentResult } from "@/components/portal/PortalPayments";

export async function generateMetadata() {
  const t = await getTranslations("portal.result");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <PaymentResult />;
}
