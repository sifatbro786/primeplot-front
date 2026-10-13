import { Suspense } from "react";
import { LegalPage, legalMetadata } from "@/components/site/LegalPage";
import { Skeleton } from "@/components/ui/States";

export const generateMetadata = () => legalMetadata("privacy");

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <LegalPage kind="privacy" />
    </Suspense>
  );
}
