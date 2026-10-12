"use client";

import { useTranslations } from "next-intl";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";

const FILE_CODES = ["UNSUPPORTED_MEDIA_TYPE", "FILE_TOO_LARGE", "INVALID_IMAGE"];

/** POST /media (multipart). Public by default — plans, gallery and brochures are for the website. */
export function uploadMedia(file, { purpose = "general", visibility = "public", alt } = {}) {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  form.append("visibility", visibility);
  if (alt) form.append("alt", alt);
  return api.upload("/media", form);
}

/** Upload error → user message (file-type/size problems get their own wording). */
export function useUploadError() {
  const t = useTranslations("media.errors");
  const te = useTranslations("errors");
  return (err) => (FILE_CODES.includes(err?.code) ? t(err.code) : errorMessage(te, err));
}

/** Delete media that was uploaded but never saved anywhere (best effort; the purge job is the backstop). */
export function discardMedia(ids) {
  for (const id of ids) api.delete(`/media/${id}`).catch(() => {});
}
