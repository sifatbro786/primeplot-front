"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/auth/session";

/**
 * UX gate for a page (the API enforces the same permission). Shows a calm "no access" panel
 * instead of a broken page when someone opens a URL their role can't use.
 */
export function RequirePermission({ any, children }) {
  const t = useTranslations("shell");
  const { can, isPending } = useSession();
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (!can(...any)) return <EmptyState icon={Lock} title={t("noAccessTitle")} description={t("noAccessBody")} className="mx-auto max-w-2xl" />;
  return children;
}
