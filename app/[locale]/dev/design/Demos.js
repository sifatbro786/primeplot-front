"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";

function Label({ children }) {
  return <p className="mb-3 font-mono text-[11px] text-ink-subtle">{children}</p>;
}

export function ControlsDemo() {
  const t = useTranslations("design");
  const c = useTranslations("common");
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-10">
      <div>
        <Label>{t("buttons")}</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">
            <Plus aria-hidden className="size-3.5" /> Small
          </Button>
          <Button size="lg">Large</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            {c("save")}
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="icon" variant="secondary" aria-label="Add">
            <Plus aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label>{t("inputs")}</Label>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={t("emailLabel")} hint={t("emailHint")} required>
            <Input type="email" placeholder="client@example.com" autoComplete="email" />
          </Field>
          <Field label={t("phoneLabel")} error={t("phoneError")}>
            <Input type="tel" defaultValue="01212" inputMode="tel" />
          </Field>
          <Field label={t("projectLabel")}>
            <Select defaultValue="" placeholder={t("projectPlaceholder")}>
              <option value="shapla">{t("projectName")}</option>
              <option value="other">Meghna Heights</option>
            </Select>
          </Field>
          <Field label="Search">
            <Input leading={<Search className="size-4" />} placeholder={t("searchPlaceholder")} />
          </Field>
          <Field label={t("notesLabel")} optionalLabel={c("optional")} className="md:col-span-2">
            <Textarea rows={3} />
          </Field>
          <Checkbox label={t("agree")} description={t("agreeHint")} defaultChecked />
          <Field label="Disabled">
            <Input disabled defaultValue="A-12-03" className="font-mono" />
          </Field>
        </div>
      </div>
    </div>
  );
}

export function FeedbackDemo() {
  const t = useTranslations("design");
  const c = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => toast.success(t("savedMsg"))}>
          {t("toastSuccess")}
        </Button>
        <Button variant="secondary" onClick={() => toast.error(t("failedMsg"))}>
          {t("toastError")}
        </Button>
        <Button onClick={() => setOpen(true)}>{t("openDrawer")}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} action={<Button size="sm">{c("retry")}</Button>} />
        <ErrorState
          title={t("errorTitle")}
          description={t("errorBody")}
          requestId="7f3c9a1e-2b4d"
          requestIdLabel={c("requestId")}
          action={
            <Button size="sm" variant="secondary">
              {c("retry")}
            </Button>
          }
        />
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("drawerTitle")}
        description="+880 1712-345678"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {c("cancel")}
            </Button>
            <Button onClick={() => setOpen(false)}>{c("save")}</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t("drawerBody")}</p>
      </Drawer>
    </div>
  );
}
