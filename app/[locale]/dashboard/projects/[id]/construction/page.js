import { ConstructionEditor } from "@/components/website/ConstructionEditor";

// Client-loaded tab (see ../layout.js) — not validated for instant navigation.
export const instant = false;

export default function Page() {
  return <ConstructionEditor />;
}
