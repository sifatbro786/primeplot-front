"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { uploadMedia, useUploadError } from "@/components/media/upload";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatNumber, localizeDigits } from "@/lib/format";
import { ICONS } from "@/lib/site/icons";
import { emptyOf, ICON_KEYS, isHref, isHttps, youtubeId } from "@/lib/site/schema";

const LANGS = [
  ["bn", "বাংলা"],
  ["en", "English"],
];

function Counter({ value, max, soft }) {
  const locale = useLocale();
  const n = [...(value ?? "")].length;
  const over = n > max;
  const warn = !over && soft && n > soft;
  return (
    <span className={cn("font-mono text-[10px]", over ? "font-semibold text-danger" : warn ? "text-warning" : "text-ink-subtle")}>
      {localizeDigits(n, locale)}/{localizeDigits(soft ?? max, locale)}
    </span>
  );
}

/** Bangla + English side by side, each with its own counter. */
export function BiInput({ label, hint, value, onChange, max = 160, soft, kind = "t", required }) {
  const id = useId();
  const v = value ?? { en: "", bn: "" };
  const rows = kind === "long" ? 9 : kind === "ta" ? 3 : 1;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </legend>
      <div className="grid gap-2 md:grid-cols-2">
        {LANGS.map(([lang, name]) => (
          <div key={lang} className="min-w-0">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={`${id}-${lang}`} className="text-[10px] font-semibold tracking-wide text-ink-subtle uppercase">
                {name}
              </label>
              <Counter value={v[lang]} max={max} soft={soft} />
            </div>
            {rows > 1 ? (
              <Textarea
                id={`${id}-${lang}`}
                lang={lang}
                rows={rows}
                value={v[lang]}
                aria-invalid={[...(v[lang] ?? "")].length > max || undefined}
                onChange={(e) => onChange({ ...v, [lang]: e.target.value })}
              />
            ) : (
              <Input
                id={`${id}-${lang}`}
                lang={lang}
                value={v[lang]}
                aria-invalid={[...(v[lang] ?? "")].length > max || undefined}
                onChange={(e) => onChange({ ...v, [lang]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </fieldset>
  );
}

function IconPicker({ value, onChange, label }) {
  const t = useTranslations("website");
  const [open, setOpen] = useState(false);
  const Current = ICONS[value] ?? ICONS.sparkles;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm hover:bg-surface-2"
      >
        <Current aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
        <span className="font-mono text-xs text-ink-muted">{value}</span>
        <ChevronDown aria-hidden className="size-3.5 text-ink-subtle" />
      </button>
      {open && (
        <div role="radiogroup" aria-label={t("chooseIcon")} className="mt-2 grid max-w-md grid-cols-7 gap-1 rounded-md border border-line bg-surface p-2 sm:grid-cols-9">
          {ICON_KEYS.map((k) => {
            const Icon = ICONS[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === value}
                aria-label={k}
                title={k}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn("grid aspect-square place-items-center rounded-sm hover:bg-surface-2", k === value && "bg-accent-soft ring-1 ring-accent")}
              >
                <Icon aria-hidden className="size-4.5" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Upload / replace / remove one public image. Writes `xMediaId` + `x` (preview) on the parent. */
export function ImageField({ label, hint, media, onChange, contain = false, round = false, purpose = "general" }) {
  const t = useTranslations("website");
  const uploadError = useUploadError();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pickFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const m = await uploadMedia(file, { purpose, alt: file.name.replace(/\.[^.]+$/, "") });
      onChange(m);
    } catch (err) {
      toast.error(uploadError(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className={cn("relative size-20 shrink-0 overflow-hidden border border-line bg-surface-2", round ? "rounded-full" : "rounded-md")}>
          {media?.urls ? (
            <SmartImage media={media} variant="thumb" alt="" fit={contain ? "contain" : "cover"} sizes="80px" className="absolute inset-0" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-ink-subtle">
              <ImagePlus aria-hidden className="size-5" strokeWidth={1.5} />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            {media ? t("replaceImage") : t("uploadImage")}
          </Button>
          {media && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              {t("removeImage")}
            </Button>
          )}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Repeating items: collapsible rows, reorder, remove, add (up to `max`). */
function ListField({ field, value, onChange, T, depthLabel }) {
  const t = useTranslations("website");
  const locale = useLocale();
  const items = value ?? [];
  const [open, setOpen] = useState(() => new Set(items.length === 1 ? [0] : []));
  const toggle = (i) => setOpen((s) => new Set(s.has(i) ? [...s].filter((x) => x !== i) : [...s, i]));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen((s) => new Set([...s].map((x) => (x === i ? j : x === j ? i : x))));
  };
  const add = () => {
    onChange([...items, Object.fromEntries(field.item.map((x) => [x.name, emptyOf(x)]))]);
    setOpen((s) => new Set([...s, items.length]));
  };
  const labelOf = (it, i) => {
    const raw = it[field.labelField];
    const text = typeof raw === "string" ? raw : (locale === "bn" ? raw?.bn || raw?.en : raw?.en || raw?.bn) || "";
    return text.trim() || t("untitledItem", { n: localizeDigits(i + 1, locale) });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium">
          {depthLabel} <span className="font-normal text-ink-subtle">({formatNumber(items.length, locale)}/{formatNumber(field.max, locale)})</span>
        </p>
      </div>
      {items.length === 0 && <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-xs text-ink-muted">{t("emptyList")}</p>}
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-md border border-line bg-surface">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button type="button" onClick={() => toggle(i)} aria-expanded={open.has(i)} className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-1 text-left text-sm hover:bg-surface-2">
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-subtle transition-transform", !open.has(i) && "-rotate-90")} />
                <span className="font-mono text-[11px] text-ink-subtle">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                <span className="truncate">{labelOf(it, i)}</span>
              </button>
              <Button size="icon" variant="ghost" className="size-8" aria-label={t("moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp aria-hidden className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8" aria-label={t("moveDown")} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown aria-hidden className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-danger"
                aria-label={t("removeItem")}
                onClick={() => {
                  onChange(items.filter((_, x) => x !== i));
                  setOpen((s) => new Set([...s].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))));
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
            {open.has(i) && (
              <div className="border-t border-line px-3 py-4">
                <FieldsForm fields={field.item} value={it} onChange={(v) => onChange(items.map((x, n) => (n === i ? v : x)))} T={T} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="mt-2" disabled={items.length >= field.max} onClick={add}>
        <Plus aria-hidden className="size-4" />
        {t("addItem")}
      </Button>
    </div>
  );
}

/** Renders a descriptor list (lib/site/schema.js) against a data object. */
export function FieldsForm({ fields, value, onChange, T }) {
  const t = useTranslations("website");
  const set = (name, v) => onChange({ ...value, [name]: v });
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const label = T(field.name);
        switch (field.kind) {
          case "t":
          case "ta":
          case "long":
            return (
              <BiInput
                key={field.name}
                label={label}
                kind={field.kind}
                max={field.max}
                hint={field.emph ? t("hintEmph") : field.kind === "long" ? t("hintParagraphs") : undefined}
                value={value[field.name]}
                onChange={(v) => set(field.name, v)}
              />
            );
          case "text":
            return (
              <Field key={field.name} label={label} className="max-w-sm">
                <Input value={value[field.name] ?? ""} maxLength={field.max} onChange={(e) => set(field.name, e.target.value)} />
              </Field>
            );
          case "href":
          case "url":
          case "youtube": {
            const v = value[field.name] ?? "";
            const ok = field.kind === "href" ? isHref(v) : field.kind === "url" ? isHttps(v) : v === "" || Boolean(youtubeId(v));
            return (
              <Field key={field.name} label={label} hint={t(`hint_${field.kind}`)} error={ok ? undefined : t(`invalid_${field.kind}`)} className="max-w-xl">
                <Input value={v} inputMode="url" spellCheck={false} placeholder={field.kind === "href" ? "/projects" : "https://"} onChange={(e) => set(field.name, e.target.value.trim())} />
              </Field>
            );
          }
          case "select":
            return (
              <Field key={field.name} label={label} className="max-w-xs">
                <Select value={value[field.name]} onChange={(e) => set(field.name, e.target.value)}>
                  {field.options.map((o) => (
                    <option key={o} value={o}>
                      {T(`${field.name}_${o}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          case "icon":
            return <IconPicker key={field.name} label={label} value={value[field.name]} onChange={(v) => set(field.name, v)} />;
          case "image": {
            const base = field.name.slice(0, -"MediaId".length);
            return (
              <ImageField
                key={field.name}
                label={label}
                media={value[base] ?? null}
                contain={field.contain}
                round={field.round}
                onChange={(m) => onChange({ ...value, [field.name]: m?.id ?? null, [base]: m })}
              />
            );
          }
          case "group":
            return (
              <fieldset key={field.name} className="rounded-md border border-line p-4">
                <legend className="px-1 text-xs font-semibold">{label}</legend>
                <FieldsForm fields={field.fields} value={value[field.name] ?? {}} onChange={(v) => set(field.name, v)} T={T} />
              </fieldset>
            );
          case "list":
            return <ListField key={field.name} field={field} value={value[field.name]} onChange={(v) => set(field.name, v)} T={T} depthLabel={label} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
