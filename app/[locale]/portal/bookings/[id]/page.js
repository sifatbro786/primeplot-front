import { getTranslations } from "next-intl/server";
import { PortalBooking } from "@/components/portal/PortalBooking";

export async function generateMetadata() {
  const t = await getTranslations("portal.booking");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <PortalBooking />;
}
