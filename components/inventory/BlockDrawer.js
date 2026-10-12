"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { keys } from "./queries";

const FORM_ID = "block-form";
const floorStr = (v) => (v == null ? "" : String(v));
const floorOk = (s) => s === "" || (/^-?\d+$/.test(s) && Number(s) >= -5 && Number(s) <= 200);

function BlockForm({ project, block, onDone, onBusy }) {
  const t = useTranslations("inventory.blocks");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const apartment = project.kind === "apartment";

  const schema = z
    .object({
      kind: z.enum(["building", "block", "sector"]),
      code: z.string().trim().min(1, t("required")).max(20),
      name: z.string().trim().min(1, t("required")).max(120),
      nameBn: z.string().trim().max(120),
      lowestFloor: z.string().refine(floorOk, t("floorInvalid")),
      highestFloor: z.string().refine(floorOk, t("floorInvalid")),
    })
    .refine((v) => v.lowestFloor === "" || v.highestFloor === "" || Number(v.lowestFloor) <= Number(v.highestFloor), {
      path: ["highestFloor"],
      message: t("floorOrder"),
    });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: block?.kind ?? (apartment ? "building" : "block"),
      code: block?.code ?? "",
      name: block?.name ?? "",
      nameBn: block?.nameBn ?? "",
      lowestFloor: block ? floorStr(block.lowestFloor) : apartment ? "0" : "",
      highestFloor: block ? floorStr(block.highestFloor) : "",
    },
  });

  const onSubmit = async (v) => {
    const body = {
      kind: v.kind,
      code: v.code,
      name: v.name,
      nameBn: v.nameBn || null,
      ...(apartment && {
        lowestFloor: v.lowestFloor === "" ? null : Number(v.lowestFloor),
        highestFloor: v.highestFloor === "" ? null : Number(v.highestFloor),
      }),
    };
    onBusy(true);
    try {
      const saved = block
        ? await api.patch(`/projects/${project.id}/blocks/${block.id}`, { version: block.version, ...body })
        : await api.post(`/projects/${project.id}/blocks`, body);
      await qc.invalidateQueries({ queryKey: keys.project(project.id) });
      toast.success(block ? t("saved") : t("created", { code: saved.code }));
      onDone(saved);
    } catch (err) {
      if (err?.code === "DUPLICATE") return setError("code", { message: t("codeTaken") });
      if (err?.code === "UNITS_OUTSIDE_RANGE") return setError("root", { message: t("unitsOutside", { n: err.details?.units ?? "" }) });
      if (err?.code === "STALE_VERSION") return setError("root", { message: t("stale") });
      setError("root", { message: errorMessage(te, err) });
    } finally {
      onBusy(false);
    }
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert>{errors.root?.message}</FormAlert>
      {!apartment && (
        <Field label={t("kind")}>
          <Select {...register("kind")}>
            <option value="block">{t("kinds.block")}</option>
            <option value="sector">{t("kinds.sector")}</option>
          </Select>
        </Field>
      )}
      <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
        <Field label={t("code")} error={errors.code?.message} required hint={t("codeHint")}>
          <Input className="font-mono" maxLength={20} {...register("code")} />
        </Field>
        <Field label={t("name")} error={errors.name?.message} required>
          <Input placeholder={apartment ? "Tower A" : "Block B"} {...register("name")} />
        </Field>
      </div>
      <Field label={t("nameBn")} error={errors.nameBn?.message}>
        <Input lang="bn" {...register("nameBn")} />
      </Field>
      {apartment && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("lowestFloor")} error={errors.lowestFloor?.message} hint={t("lowestHint")}>
            <Input inputMode="numeric" {...register("lowestFloor")} />
          </Field>
          <Field label={t("highestFloor")} error={errors.highestFloor?.message} hint={t("highestHint")}>
            <Input inputMode="numeric" {...register("highestFloor")} />
          </Field>
        </div>
      )}
    </form>
  );
}

/** `state` = null | { block?: Block } (no block = create). */
export function BlockDrawer({ state, project, onClose, onSaved }) {
  const t = useTranslations("inventory.blocks");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const block = state?.block;
  const apartment = project.kind === "apartment";

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}/blocks/${block.id}`);
      await qc.invalidateQueries({ queryKey: keys.project(project.id) });
      toast.success(t("deleted"));
      onClose();
    } catch (err) {
      toast.error(err?.code === "BLOCK_IN_USE" ? t("inUse") : errorMessage(te, err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      open={Boolean(state)}
      onClose={onClose}
      width="sm"
      title={block ? t("editTitle") : t(apartment ? "newBuilding" : "newBlock")}
      footer={
        <>
          {block && (
            <Button variant="ghost" className="mr-auto text-danger" loading={deleting} onClick={remove} aria-label={t("delete")}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {block ? tc("save") : t("create")}
          </Button>
        </>
      }
    >
      {state && (
        <BlockForm
          key={block?.id ?? "new"}
          project={project}
          block={block}
          onBusy={setBusy}
          onDone={(b) => {
            onSaved?.(b);
            onClose();
          }}
        />
      )}
    </Drawer>
  );
}
