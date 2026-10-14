import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { VerifyResult } from "@/components/site/VerifyResult";
import { Skeleton } from "@/components/ui/States";

export async function generateMetadata() {
  const t = await getTranslations("site.verify");
  // A verification page is personal to one document: never indexed, never shared in previews.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default function Page({ params }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-16 h-96 w-full max-w-2xl" />}>
      <VerifyResult params={params} />
    </Suspense>
  );
}
