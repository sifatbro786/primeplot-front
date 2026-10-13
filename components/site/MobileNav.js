"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Drawer } from "@/components/ui/Drawer";
import { NavLink } from "./NavLink";

/** Below lg: a menu button opening a right-hand sheet with the same links. */
export function MobileNav({ items }) {
  const t = useTranslations("site.header");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menu")}
        aria-haspopup="dialog"
        className="-mr-1.5 grid size-9 place-items-center rounded-md text-ink hover:bg-surface-2 lg:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.5} />
      </button>
      <Drawer open={open} onClose={close} title={t("menu")} width="sm">
        <nav aria-label={t("primaryNav")}>
          <ul className="divide-y divide-line border-y border-line">
            {items.map((n) => (
              <li key={n.key}>
                {n.href.startsWith("#") ? (
                  <a href={n.href} onClick={close} className="block py-4 font-display text-2xl">
                    {n.label}
                  </a>
                ) : (
                  <NavLink href={n.href} onClick={close} className="block py-4 font-display text-2xl">
                    {n.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
