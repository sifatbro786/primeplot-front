import { getTranslations } from "next-intl/server";
import { Overview } from "@/components/dashboard/Overview";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

export default function DashboardHome() {
  return <Overview />;
}
