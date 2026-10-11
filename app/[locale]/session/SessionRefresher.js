"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";
import { useRouter } from "@/i18n/navigation";
import { homeFor, LOGIN, safeNext } from "@/lib/auth/paths";

export function SessionRefresher() {
  const t = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke: refresh exactly once
    started.current = true;
    const next = params.get("next");

    (async () => {
      let res;
      try {
        res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
        if (res.status === 409) {
          // Another tab rotated the token a moment ago; the cookie jar is already fresh.
          res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
        }
      } catch {
        res = null;
      }
      if (res?.ok) {
        const { data } = await res.json();
        const role = data?.user?.role;
        router.replace(safeNext(next, role) ?? homeFor(role));
      } else {
        const query = safeNext(next) ? { next } : undefined;
        router.replace({ pathname: LOGIN, query });
      }
    })();
  }, [params, router]);

  return (
    <p className="flex items-center gap-3 text-sm text-ink-muted" role="status">
      <Spinner />
      {t("checkingSession")}
    </p>
  );
}
