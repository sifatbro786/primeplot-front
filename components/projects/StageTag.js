"use client";

import { useTranslations } from "next-intl";
import { Tag } from "@/components/ui/Tag";

export const STAGES = ["upcoming", "ongoing", "ready", "completed"];
const STAGE_TONE = { upcoming: "info", ongoing: "warning", ready: "success", completed: "neutral" };

export function StageTag({ stage }) {
  const t = useTranslations("projects.stages");
  return <Tag tone={STAGE_TONE[stage]}>{t(stage)}</Tag>;
}
