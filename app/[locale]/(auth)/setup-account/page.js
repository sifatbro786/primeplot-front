import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { TokenPasswordForm } from "@/components/auth/TokenPasswordForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.setup");
  // The URL carries a one-time token: never send it to other sites via Referer.
  return { title: t("metaTitle"), referrer: "no-referrer", robots: { index: false } };
}

export default function Page() {
  return (
    <Suspense>
      <TokenPasswordForm purpose="account_setup" />
    </Suspense>
  );
}
