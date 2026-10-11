import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default function LoginPage() {
  // useSearchParams (next, reason) is request data → behind Suspense under cacheComponents.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
