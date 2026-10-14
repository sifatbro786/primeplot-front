"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { keys, useProject } from "@/components/inventory/queries";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { stripResolved } from "@/lib/site/schema";
import { SeoFields } from "./SeoFields";

/** Project › SEO (PATCH /projects/:id { seo }). The share image is the generated project card. */
export function ProjectSeoTab() {
  const { id } = useParams();
  const project = useProject(id);
  if (!project.data) return <Skeleton className="h-96 w-full" />;
  return <Form key={project.data.version} project={project.data} />;
}

function Form({ project }) {
  const t = useTranslations("website");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const { can, org } = useSession();
  const [seo, setSeo] = useState(project.seo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = JSON.stringify(stripResolved(seo)) !== JSON.stringify(stripResolved(project.seo));
  const company = (locale === "bn" && org?.nameBn) || org?.name || "";
  const name = { en: project.name, bn: project.nameBn || project.name };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { ogImage: _o, ...body } = stripResolved(seo);
      const updated = await api.patch(`/projects/${project.id}`, { version: project.version, seo: body });
      qc.setQueryData(keys.project(project.id), updated);
      toast.success(t("saved"));
    } catch (err) {
      setError(err?.code === "STALE_VERSION" ? t("stale") : errorMessage(te, err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-ink-muted">{t("projectSeoBody")}</p>
      {error && <FormAlert>{error}</FormAlert>}
      <SeoFields
        value={seo}
        onChange={setSeo}
        path={`/projects/${project.slug}`}
        company={company}
        heading={name}
        withImage={false}
        fallback={{
          title: { en: `${project.name} | ${org?.name ?? ""}`, bn: `${project.nameBn || project.name} | ${org?.nameBn || org?.name || ""}` },
          description: { en: project.tagline || "", bn: project.taglineBn || project.tagline || "" },
        }}
      />
      {can("projects:write") && (
        <div className="mt-8 flex justify-end border-t border-line pt-4">
          <Button loading={saving} disabled={!dirty} onClick={save}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
