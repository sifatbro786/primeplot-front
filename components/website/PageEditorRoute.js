"use client";

import { FileQuestion } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { PAGE_KEYS } from "@/lib/site/schema";
import { PageEditor } from "./PageEditor";

export function PageEditorRoute() {
  const { page } = useParams();
  const t = useTranslations("website");
  if (!PAGE_KEYS.includes(page)) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={t("unknownPage")}
        action={
          <Button as={Link} href="/dashboard/website" size="sm" variant="secondary">
            {t("back")}
          </Button>
        }
        className="mx-auto max-w-xl"
      />
    );
  }
  return <PageEditor pageKey={page} />;
}
