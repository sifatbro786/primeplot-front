import { draftMode } from "next/headers";

/** Leaves Draft Mode (the banner's "Exit preview" form) and returns to the same page. */
export async function POST(request) {
  (await draftMode()).disable();
  const origin = new URL(request.url).origin;
  let back = "/";
  try {
    const ref = new URL(request.headers.get("referer") ?? "", origin);
    if (ref.origin === origin && !ref.pathname.startsWith("/api/")) back = ref.pathname + ref.search;
  } catch {
    // no/invalid referer → home
  }
  return Response.redirect(new URL(back, origin), 303);
}
