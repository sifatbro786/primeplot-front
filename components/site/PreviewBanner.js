import { draftMode } from "next/headers";
import { PreviewBar } from "./PreviewBar";

/**
 * Shown only in Draft Mode (an editor pressed "Preview" in the dashboard). Cached like the rest
 * of the shell — Draft Mode makes it re-render per request for that editor only.
 */
export async function PreviewBanner() {
  "use cache";
  const { isEnabled } = await draftMode();
  return isEnabled ? <PreviewBar /> : null;
}
