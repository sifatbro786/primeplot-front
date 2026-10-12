import { InventoryTab } from "@/components/inventory/InventoryTab";

// Client-loaded tab (see ../layout.js) — not validated for instant navigation.
export const instant = false;

export default function Page() {
  return <InventoryTab />;
}
