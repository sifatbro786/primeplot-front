"use client";

import { Hammer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Link, usePathname } from "@/i18n/navigation";
import { findNavItem, PORTAL_NAV, STAFF_NAV } from "@/lib/nav";

const AREAS = {
  dashboard: { nav: STAFF_NAV, ns: "nav", home: "/dashboard" },
  portal: { nav: PORTAL_NAV, ns: "portalNav", home: "/portal" },
};

/** Placeholder for nav modules that later phases build — never a dead 404 link. */
export function ComingSoon({ area }) {
  const { nav, ns, home } = AREAS[area];
  const t = useTranslations("comingSoon");
  const tn = useTranslations(ns);
  const pathname = usePathname();
  const item = findNavItem(nav, pathname);
  const name = item ? tn(item.key) : "";
  return (
    <EmptyState
      icon={Hammer}
      title={t("title", { name })}
      description={item?.phase ? t("phase", { phase: item.phase }) : t("generic")}
      action={
        <Button as={Link} href={home} variant="secondary" size="sm">
          {t("back")}
        </Button>
      }
      className="mx-auto max-w-2xl"
    />
  );
}
