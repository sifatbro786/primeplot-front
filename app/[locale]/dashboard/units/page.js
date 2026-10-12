import { getTranslations } from "next-intl/server";
import { RequirePermission } from "@/components/dashboard/RequirePermission";
import { InventoryIndex } from "@/components/inventory/InventoryIndex";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("units") };
}

export default function Page() {
  return (
    <RequirePermission any={["units:read"]}>
      <InventoryIndex />
    </RequirePermission>
  );
}
