"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppConfig,
  GreenhouseCompanyConfig,
  LeverCompanyConfig,
  TaskStatus,
} from "@/types";
import { useApi } from "@/hooks/use-api";
import { CommandBar, Panel, SectionHeading, StatusChip } from "@/components/ui/system";
import { StatusBadge } from "@/components/status-badge";

type CompanyBoardItem = GreenhouseCompanyConfig | LeverCompanyConfig;

interface AdminOpsResponse {
  sources: Array<{
    sourceId: string;
    displayName: string;
    configured: boolean;
    state?: {
      status: TaskStatus;
      lastRun: string | null;
      error?: string;
      skippedReason?: string;
    } | null;
    recentRun?: {
      createdAt: string;
      status: TaskStatus;
      error?: string;
    } | null;
  }>;
}

const SOURCE_TOGGLES: Array<{
  key: keyof AppConfig["jobSources"];
  label: string;
  detail: string;
  stack: "core" | "extended";
}> = [
  { key: "adzuna", label: "Adzuna", detail: "Primary UK API coverage", stack: "core" },
  { key: "reed", label: "Reed", detail: "Primary UK direct-search API", stack: "core" },
  { key: "serpApi", label: "SerpAPI Google Jobs", detail: "Google Jobs discovery via SerpAPI", stack: "core" },
  { key: "greenhouse", label: "Greenhouse boards", detail: "Direct company board ingestion", stack: "core" },
  { key: "lever", label: "Lever boards", detail: "Direct company board ingestion", stack: "core" },
  { key: "jooble", label: "Jooble", detail: "Aggregator fallback source", stack: "extended" },
  { key: "findwork", label: "FindWork", detail: "Developer-oriented job API", stack: "extended" },
  { key: "themuse", label: "The Muse", detail: "Curated editorial job source", stack: "extended" },
  { key: "careerjet", label: "CareerJet", detail: "Aggregator fallback source", stack: "extended" },
  { key: "remotive", label: "Remotive", detail: "Remote-first public feed", stack: "extended" },
  { key: "arbeitnow", label: "Arbeitnow", detail: "Remote and Europe-facing public source", stack: "extended" },
  { key: "himalayas", label: "Himalayas", detail: "Remote-first public listings", stack: "extended" },
  { key: "brightnetwork", label: "Bright Network", detail: "Graduate and early-career opportunities", stack: "extended" },
  { key: "linkedin", label: "LinkedIn public", detail: "Public listing fallback", stack: "extended" },
  { key: "rapidApiLinkedin", label: "LinkedIn RapidAPI", detail: "Provider-limited LinkedIn fallback", stack: "extended" },
  { key: "indeed", label: "Indeed fallback", detail: "Fallback search source", stack: "extended" },
  { key: "weworkremotely", label: "We Work Remotely", detail: "Remote-focused feed", stack: "extended" },
  { key: "guardianjobs", label: "Guardian Jobs", detail: "Editorial jobs feed", stack: "extended" },
];

export function AdminIntegrationsPanel() {
  const configApi = useApi<AppConfig>();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ops, setOps] = useState<AdminOpsResponse | null>(null);

  useEffect(() => {
    configApi.call("/api/config").then((data) => {
      if (data) {
        setConfig(data);
      }
    });

    fetch("/api/admin/ops")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as AdminOpsResponse;
      })
      .then((data) => {
        if (data) {
          setOps(data);
        }
      })
      .catch(() => null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceHealthMap = useMemo(() => {
    return new Map((ops?.sources || []).map((source) => [source.sourceId, source]));
  }, [ops]);

  if (!config) {
    return (
      <section className="card py-10 text-center">
        <p className="text-sm text-text-secondary">
          {configApi.loading
            ? "Loading integrations..."
            : configApi.error || "Unable to load admin integrations."}
        </p>
      </section>
    );
  }

  const patchSource = <K extends keyof AppConfig["jobSources"]>(
    key: K,
    patch: Partial<AppConfig["jobSources"][K]>
  ) => {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        jobSources: {
          ...current.jobSources,
          [key]: {
            ...current.jobSources[key],
            ...patch,
          },
        },
      };
    });
  };

  const patchEnrichment = (patch: Partial<AppConfig["enrichment"]>) => {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        enrichment: {
          ...current.enrichment,
          ...patch,
        },
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");

    const result = await configApi.call("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });

    setSaving(false);

    if (result) {
      setConfig(result);
      setMessage("Integration settings saved");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const coreSources = SOURCE_TOGGLES.filter((source) => source.stack === "core");
  const extendedSources = SOURCE_TOGGLES.filter((source) => source.stack === "extended");

  return (
    <section className="card space-y-6">
      <SectionHeading
        title="Source adapters and credentials"
        description="Control live ingestion sources, board connectors, and enrichment providers from one system control room."
        actions={
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save integrations"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel tone="hero" className="xl:col-span-2">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Source posture
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                Official APIs first. Scraping and aggregator fallbacks only where necessary.
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Adzuna, Reed, Greenhouse, Lever, and SerpAPI define the serious ingestion layer.
                Secondary sources stay available for breadth, but they should not outrank the core stack.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Live health
              </p>
              <div className="mt-4 space-y-3">
                {[
                  ["Configured sources", (ops?.sources || []).filter((source) => source.configured).length],
                  ["Core stack enabled", coreSources.filter((source) => config.jobSources[source.key].enabled).length],
                  ["Extended stack enabled", extendedSources.filter((source) => config.jobSources[source.key].enabled).length],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="text-sm text-slate-600">{label}</span>
                    <span className="font-mono text-sm text-slate-900">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel tone="subtle">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            SerpAPI control
          </p>
          <div className="mt-4 space-y-3">
            <SourceStatusCard
              title="Connector"
              value={config.jobSources.serpApi.enabled ? "Enabled" : "Disabled"}
              tone={config.jobSources.serpApi.enabled ? "success" : "neutral"}
            />
            <SourceStatusCard
              title="Credential"
              value={config.jobSources.serpApi.apiKey ? "Saved" : "Missing"}
              tone={config.jobSources.serpApi.apiKey ? "success" : "warning"}
            />
            <SourceStatusCard
              title="Region"
              value={`${config.jobSources.serpApi.googleDomain} / ${config.jobSources.serpApi.gl}`}
            />
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Primary job source stack"
          description="These connectors define the main career ingestion surface."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coreSources.map((source) => (
            <SourceToggleCard
              key={String(source.key)}
              label={source.label}
              detail={source.detail}
              enabled={config.jobSources[source.key].enabled}
              health={sourceHealthMap.get(normalizeSourceId(source.key))}
              onToggle={() =>
                patchSource(source.key, {
                  enabled: !config.jobSources[source.key].enabled,
                } as Partial<AppConfig["jobSources"][typeof source.key]>)
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Extended source coverage"
          description="Keep fallback connectors available without letting them define the whole pipeline."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {extendedSources.map((source) => (
            <SourceToggleCard
              key={String(source.key)}
              label={source.label}
              detail={source.detail}
              enabled={config.jobSources[source.key].enabled}
              health={sourceHealthMap.get(normalizeSourceId(source.key))}
              onToggle={() =>
                patchSource(source.key, {
                  enabled: !config.jobSources[source.key].enabled,
                } as Partial<AppConfig["jobSources"][typeof source.key]>)
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Credential vault"
          description="Store API credentials and connector runtime defaults without editing files."
        />
        <CommandBar>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SecretField
              label="Adzuna app ID"
              value={config.jobSources.adzuna.appId}
              onChange={(value) => patchSource("adzuna", { appId: value })}
            />
            <SecretField
              label="Adzuna app key"
              value={config.jobSources.adzuna.appKey}
              onChange={(value) => patchSource("adzuna", { appKey: value })}
            />
            <SecretField
              label="Reed API key"
              value={config.jobSources.reed.apiKey}
              onChange={(value) => patchSource("reed", { apiKey: value })}
            />
            <SecretField
              label="SerpAPI key"
              value={config.jobSources.serpApi.apiKey}
              onChange={(value) => patchSource("serpApi", { apiKey: value })}
            />
            <TextField
              label="SerpAPI Google domain"
              value={config.jobSources.serpApi.googleDomain}
              onChange={(value) => patchSource("serpApi", { googleDomain: value })}
              placeholder="google.co.uk"
            />
            <TextField
              label="SerpAPI country code"
              value={config.jobSources.serpApi.gl}
              onChange={(value) => patchSource("serpApi", { gl: value.toLowerCase() })}
              placeholder="uk"
            />
            <TextField
              label="SerpAPI language code"
              value={config.jobSources.serpApi.hl}
              onChange={(value) => patchSource("serpApi", { hl: value.toLowerCase() })}
              placeholder="en"
            />
            <SecretField
              label="Jooble API key"
              value={config.jobSources.jooble.apiKey}
              onChange={(value) => patchSource("jooble", { apiKey: value })}
            />
            <SecretField
              label="FindWork API key"
              value={config.jobSources.findwork.apiKey}
              onChange={(value) => patchSource("findwork", { apiKey: value })}
            />
            <SecretField
              label="The Muse API key"
              value={config.jobSources.themuse.apiKey || ""}
              onChange={(value) => patchSource("themuse", { apiKey: value })}
            />
            <SecretField
              label="CareerJet affiliate ID"
              value={config.jobSources.careerjet.affid || ""}
              onChange={(value) => patchSource("careerjet", { affid: value })}
            />
            <SecretField
              label="RapidAPI LinkedIn key"
              value={config.jobSources.rapidApiLinkedin.apiKey}
              onChange={(value) => patchSource("rapidApiLinkedin", { apiKey: value })}
            />
            <SecretField
              label="Apollo API key"
              value={config.enrichment.apollo.apiKey}
              onChange={(value) =>
                patchEnrichment({
                  apollo: { ...config.enrichment.apollo, apiKey: value },
                })
              }
            />
          </div>
        </CommandBar>
      </div>

      <CompanyBoardEditor
        title="Greenhouse company boards"
        description="Add company board tokens for public Greenhouse boards."
        valueLabel="Board token"
        valueKey="boardToken"
        items={config.jobSources.greenhouse.companies}
        onChange={(items) =>
          patchSource("greenhouse", {
            companies: items as GreenhouseCompanyConfig[],
          })
        }
      />

      <CompanyBoardEditor
        title="Lever company boards"
        description="Add public Lever API endpoints for target companies."
        valueLabel="Endpoint URL"
        valueKey="endpointUrl"
        items={config.jobSources.lever.companies}
        onChange={(items) =>
          patchSource("lever", {
            companies: items as LeverCompanyConfig[],
          })
        }
      />

      <div className="space-y-4">
        <SectionHeading
          title="Source runtime board"
          description="Configuration state and latest execution signal for each source adapter."
        />
        <div className="overflow-hidden rounded-[28px] border border-slate-200">
          <div className="grid grid-cols-[1.2fr_0.55fr_0.75fr] bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            <span>Source</span>
            <span>Status</span>
            <span>Last signal</span>
          </div>
          <div className="divide-y divide-slate-200 bg-white">
            {(ops?.sources || []).map((source) => (
              <div
                key={source.sourceId}
                className="grid grid-cols-[1.2fr_0.55fr_0.75fr] gap-3 px-4 py-4 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{source.displayName}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {source.sourceId}
                  </p>
                  {source.state?.error ? (
                    <p className="mt-2 text-xs text-rose-600">{source.state.error}</p>
                  ) : source.state?.skippedReason ? (
                    <p className="mt-2 text-xs text-amber-600">{source.state.skippedReason}</p>
                  ) : null}
                </div>
                <div className="flex items-start">
                  {source.configured ? (
                    <StatusChip tone="success">Configured</StatusChip>
                  ) : (
                    <StatusChip tone="warning">Missing config</StatusChip>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2">
                  <StatusBadge status={source.state?.status || "idle"} />
                  <span className="text-xs text-slate-500">
                    {source.state?.lastRun
                      ? new Date(source.state.lastRun).toLocaleString("en-GB")
                      : "Never run"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Apollo enrichment"
          description="Control enrichment behavior and automation thresholds without over-enriching weak-fit roles."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ConfigToggle
            label="Apollo enrichment"
            enabled={config.enrichment.apollo.enabled}
            detail="Enable company and people discovery through Apollo."
            onToggle={() =>
              patchEnrichment({
                apollo: {
                  ...config.enrichment.apollo,
                  enabled: !config.enrichment.apollo.enabled,
                },
              })
            }
          />
          <ConfigToggle
            label="Auto company intel"
            enabled={config.enrichment.autoEnrichCompany}
            detail="Pull company context automatically after fit scoring."
            onToggle={() =>
              patchEnrichment({
                autoEnrichCompany: !config.enrichment.autoEnrichCompany,
              })
            }
          />
          <ConfigToggle
            label="Auto decision makers"
            enabled={config.enrichment.autoFindDecisionMakers}
            detail="Find likely hiring or team contacts for strong-fit jobs."
            onToggle={() =>
              patchEnrichment({
                autoFindDecisionMakers: !config.enrichment.autoFindDecisionMakers,
              })
            }
          />
          <ConfigToggle
            label="Auto email discovery"
            enabled={config.enrichment.autoFindEmails}
            detail="Attempt verified or likely email discovery where supported."
            onToggle={() =>
              patchEnrichment({
                autoFindEmails: !config.enrichment.autoFindEmails,
              })
            }
          />
          <ConfigToggle
            label="Auto outreach plans"
            enabled={config.enrichment.autoGenerateOutreach}
            detail="Generate outreach strategy and drafts for approved roles."
            onToggle={() =>
              patchEnrichment({
                autoGenerateOutreach: !config.enrichment.autoGenerateOutreach,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField
          label="Min fit score for people search"
          value={config.enrichment.minFitScoreForPeopleSearch}
          onChange={(value) =>
            patchEnrichment({
              minFitScoreForPeopleSearch: value,
            })
          }
        />
        <NumberField
          label="Min fit score for outreach"
          value={config.enrichment.minFitScoreForOutreach}
          onChange={(value) =>
            patchEnrichment({
              minFitScoreForOutreach: value,
            })
          }
        />
      </div>

      {message || configApi.error ? (
        <div className="space-y-2 text-sm">
          {message ? <p className="text-emerald-700">{message}</p> : null}
          {configApi.error ? <p className="text-rose-700">{configApi.error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function SourceToggleCard({
  label,
  detail,
  enabled,
  health,
  onToggle,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  health?: AdminOpsResponse["sources"][number];
  onToggle: () => void;
}) {
  return (
    <Panel tone="subtle" className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        </div>
        <button
          type="button"
          className={`btn-sm ${enabled ? "btn-primary" : "btn-secondary"}`}
          onClick={onToggle}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {enabled ? <StatusChip tone="success">Live</StatusChip> : <StatusChip tone="neutral">Off</StatusChip>}
        {health?.configured ? (
          <StatusChip tone="success">Configured</StatusChip>
        ) : (
          <StatusChip tone="warning">Needs key</StatusChip>
        )}
        {health?.state ? <StatusBadge status={health.state.status} /> : null}
      </div>
    </Panel>
  );
}

function ConfigToggle({
  label,
  enabled,
  detail,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  detail: string;
  onToggle: () => void;
}) {
  return (
    <Panel tone="subtle" className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-950">{label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        </div>
        <button
          type="button"
          className={`btn-sm ${enabled ? "btn-primary" : "btn-secondary"}`}
          onClick={onToggle}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>
    </Panel>
  );
}

function SecretField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter secret"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type="number"
        value={value}
        onChange={(event) => onChange(parseInt(event.target.value || "0", 10))}
      />
    </div>
  );
}

function SourceStatusCard({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      <p
        className={`mt-2 text-sm font-medium ${
          tone === "success"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CompanyBoardEditor({
  title,
  description,
  items,
  valueLabel,
  valueKey,
  onChange,
}: {
  title: string;
  description: string;
  items: CompanyBoardItem[];
  valueLabel: string;
  valueKey: "boardToken" | "endpointUrl";
  onChange: (items: CompanyBoardItem[]) => void;
}) {
  const addItem = () => {
    if (valueKey === "boardToken") {
      onChange([
        ...items,
        {
          name: "",
          boardToken: "",
          enabled: true,
          sourceTag: "",
        } satisfies GreenhouseCompanyConfig,
      ]);
      return;
    }

    onChange([
      ...items,
      {
        name: "",
        endpointUrl: "",
        enabled: true,
        sourceTag: "",
      } satisfies LeverCompanyConfig,
    ]);
  };

  const updateItem = (index: number, patch: Partial<CompanyBoardItem>) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3">
      <SectionHeading
        title={title}
        description={description}
        actions={
          <button className="btn-secondary btn-sm" onClick={addItem}>
            Add board
          </button>
        }
      />

      {items.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No boards added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Panel key={`${title}-${index}`} tone="subtle">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="label">Company</label>
                  <input
                    className="input"
                    value={item.name}
                    onChange={(event) => updateItem(index, { name: event.target.value })}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="label">{valueLabel}</label>
                  <input
                    className="input"
                    value={
                      valueKey === "boardToken"
                        ? (item as GreenhouseCompanyConfig).boardToken
                        : (item as LeverCompanyConfig).endpointUrl
                    }
                    onChange={(event) =>
                      updateItem(
                        index,
                        valueKey === "boardToken"
                          ? { boardToken: event.target.value }
                          : { endpointUrl: event.target.value }
                      )
                    }
                    placeholder={
                      valueKey === "boardToken"
                        ? "company-board-token"
                        : "https://api.lever.co/v0/postings/company"
                    }
                  />
                </div>
                <div>
                  <label className="label">Source tag</label>
                  <input
                    className="input"
                    value={item.sourceTag || ""}
                    onChange={(event) => updateItem(index, { sourceTag: event.target.value })}
                    placeholder="Optional label"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    className={`btn-sm ${item.enabled ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => updateItem(index, { enabled: !item.enabled })}
                  >
                    {item.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => removeItem(index)}>
                    Remove
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeSourceId(key: keyof AppConfig["jobSources"]) {
  if (key === "rapidApiLinkedin") {
    return "rapidapi-linkedin";
  }

  if (key === "serpApi") {
    return "serpapi";
  }

  return key;
}
