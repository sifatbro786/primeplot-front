import { getTranslations } from "next-intl/server";
import { ForgotForm } from "./ForgotForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgot");
  return { title: t("metaTitle") };
}

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
