"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOGIN } from "./paths";

export const ME_KEY = ["auth", "me"];

/**
 * Current user for dashboard/portal UI: { user, org, features, can(permission) }.
 * Loaded client-side so the page shell stays static (cacheComponents); the proxy has already
 * routed only signed-in users here, and the API client refreshes expired tokens itself.
 */
const noopSubscribe = () => () => {};

/** false during SSR and hydration, true afterwards — see useSession. */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useSession() {
  const q = useQuery({ queryKey: ME_KEY, queryFn: () => api.get("/auth/me"), staleTime: 5 * 60_000 });
  // Streaming hydrates Suspense boundaries one by one; by the time a later boundary hydrates,
  // the shared query cache may already hold /auth/me while the server HTML showed the loading
  // state → hydration mismatch. Report "pending" until this component has hydrated.
  const hydrated = useHydrated();
  const data = hydrated ? q.data : undefined;
  const perms = data?.user?.permissions;
  const can = useCallback((...needed) => Boolean(perms) && needed.some((p) => perms.includes(p)), [perms]);
  return {
    ...q,
    isPending: !hydrated || q.isPending,
    isError: hydrated && q.isError,
    user: data?.user,
    org: data?.org,
    features: data?.features,
    can,
  };
}

/** Sign out this device and forget all cached data. */
export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the call fails, the local session ends.
    }
    qc.clear();
    router.replace(LOGIN);
  }, [qc, router]);
}

/** When the API client gives up refreshing, send the user to login and come back afterwards. */
export function useSessionExpiryRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  useEffect(() => {
    const onExpired = () => {
      qc.clear();
      router.replace({ pathname: LOGIN, query: { next: pathname, reason: "expired" } });
    };
    window.addEventListener("pp:session-expired", onExpired);
    return () => window.removeEventListener("pp:session-expired", onExpired);
  }, [router, pathname, qc]);
}

/** Translate an ApiError code to a user message (falls back to the server's message). */
export function errorMessage(t, err) {
  const code = err?.code;
  if (code && t.has(code)) return t(code);
  return err?.message || t("UNKNOWN");
}
