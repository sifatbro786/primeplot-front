import { Suspense } from "react";
import { SessionRefresher } from "./SessionRefresher";

export const metadata = { robots: { index: false } };

/**
 * Hop used by proxy.js when a protected page is requested without a valid access cookie:
 * the browser (which holds the path-scoped refresh cookie) refreshes, then continues to `next`
 * — or to /login when there is no session.
 */
export default function SessionPage() {
  return (
    <main className="grid flex-1 place-items-center">
      <Suspense>
        <SessionRefresher />
      </Suspense>
    </main>
  );
}
