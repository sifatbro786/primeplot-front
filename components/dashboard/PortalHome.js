"use client";

import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/auth/session";

/** Portal landing. Units, dues and receipts arrive with B5/F6. */
export function PortalHome() {
  const t = useTranslations("portalHome");
  const { user, org, isPending } = useSession();
  if (isPending) return <Skeleton className="h-40 w-full" />;
  return (
    <div>
      <span className="eyebrow">{org?.name}</span>
      <h1 className="mt-4 font-display text-4xl leading-tight">{t("welcome", { name: user?.name?.split(" ")[0] ?? "" })}</h1>
      <p className="mt-3 max-w-lg text-ink-muted">{t("intro")}</p>
      <EmptyState icon={Building2} title={t("emptyTitle")} description={t("emptyBody")} className="mt-10" />
    </div>
  );
}
