"use client";

import { useEffect, useState } from "react";
import { SavedSearch, UserSettingsBundle } from "@/types";
import { useApi } from "@/hooks/use-api";
import { SOURCE_CATALOG } from "@/lib/career/defaults";
import { CommandBar, Panel, SectionHeading, StatusChip } from "@/components/ui/system";
import { AIControlRoom } from "./ai-control-room";
import { AdminIntegrationsPanel } from "./admin-integrations-panel";
import { CandidateProfilePanel } from "./candidate-profile-panel";

type SettingsResponse = UserSettingsBundle;

export function SettingsPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const settingsApi = useApi<SettingsResponse>();
  const [settings, setSettings] = useState<UserSettingsBundle | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.call("/api/settings").then((data) => {
      if (data) {
        setSettings(data);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const result = await settingsApi.call("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });

    setSaving(false);

    if (result) {
      setSettings(result);
      setSaveMessage("Settings saved");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const updateProfile = (patch: Partial<UserSettingsBundle["profile"]>) => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      profile: { ...settings.profile, ...patch },
    });
  };

  const updateSearch = (id: string, patch: Partial<SavedSearch>) => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      savedSearches: settings.savedSearches.map((search) =>
        search.id === id
          ? { ...search, ...patch, updatedAt: new Date().toISOString() }
          : search
      ),
    });
  };

  const addSearch = () => {
    if (!settings) {
      return;
    }

    const now = new Date().toISOString();

    setSettings({
      ...settings,
      savedSearches: [
        ...settings.savedSearches,
        {
          id: `draft-${Date.now()}`,
          userId: settings.profile.id,
          label: "New search",
          keywords: ["clinical trial assistant"],
          location: "United Kingdom",
          remoteOnly: false,
          radius: 25,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  };

  const removeSearch = (id: string) => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      savedSearches: settings.savedSearches.filter((search) => search.id !== id),
    });
  };

  const toggleSource = (sourceId: string) => {
    if (!settings) {
      return;
    }

    const existing = settings.sourcePreferences.find(
      (source) => source.sourceId === sourceId
    );

    const nextSources = existing
      ? settings.sourcePreferences.map((source) =>
          source.sourceId === sourceId
            ? {
                ...source,
                enabled: !source.enabled,
                updatedAt: new Date().toISOString(),
              }
            : source
        )
      : [
          ...settings.sourcePreferences,
          {
            id: `${settings.profile.id}-${sourceId}`,
            userId: settings.profile.id,
            sourceId,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

    setSettings({
      ...settings,
      sourcePreferences: nextSources,
    });
  };

  if (!settings) {
    return (
      <div className="card py-12 text-center">
        <p className="text-sm text-text-secondary">
          {settingsApi.loading
            ? "Loading settings..."
            : settingsApi.error || "Unable to load settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Panel tone="hero">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              System control room
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Runtime, source adapters, search posture, and profile control in one place.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This page configures the serious operating surface: local AI runtime, job-source policy,
              target search shape, and user-level preferences that drive ranking and review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={isAdmin ? "success" : "neutral"}>
              {isAdmin ? "Admin workspace" : "Member workspace"}
            </StatusChip>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      </Panel>

      <AIControlRoom />
      {isAdmin ? <AdminIntegrationsPanel /> : null}
      <CandidateProfilePanel />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card space-y-5">
          <SectionHeading
            title="Target profile"
            description="Shape how the career engine interprets location, seniority, role lanes, and notification cadence."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <Label>Full name</Label>
              <input
                className="input"
                value={settings.profile.fullName || ""}
                onChange={(event) => updateProfile({ fullName: event.target.value })}
              />
            </Field>
            <Field>
              <Label>Notification cadence</Label>
              <select
                className="input"
                value={settings.profile.notificationFrequency}
                onChange={(event) =>
                  updateProfile({
                    notificationFrequency:
                      event.target.value as UserSettingsBundle["profile"]["notificationFrequency"],
                  })
                }
              >
                <option value="manual">Manual</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field>
              <Label>Target locations</Label>
              <input
                className="input"
                value={settings.profile.targetLocations.join(", ")}
                onChange={(event) =>
                  updateProfile({
                    targetLocations: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field>
              <Label>Preferred seniority</Label>
              <input
                className="input"
                value={settings.profile.preferredSeniority}
                onChange={(event) =>
                  updateProfile({ preferredSeniority: event.target.value })
                }
              />
            </Field>
            <Field>
              <Label>Remote preference</Label>
              <select
                className="input"
                value={settings.profile.remotePreference}
                onChange={(event) =>
                  updateProfile({
                    remotePreference:
                      event.target.value as UserSettingsBundle["profile"]["remotePreference"],
                  })
                }
              >
                <option value="flexible">Flexible</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </Field>
            <Field>
              <Label>Role tracks</Label>
              <input
                className="input"
                value={settings.profile.targetRoleTracks.join(", ")}
                onChange={(event) =>
                  updateProfile({
                    targetRoleTracks: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean) as UserSettingsBundle["profile"]["targetRoleTracks"],
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="card space-y-5">
          <SectionHeading
            title="Source permissions"
            description="Enable only the ingestion lanes this workspace should actively use."
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SOURCE_CATALOG.map((sourceMeta) => {
              const source = settings.sourcePreferences.find(
                (preference) => preference.sourceId === sourceMeta.id
              );

              return (
                <button
                  key={sourceMeta.id}
                  className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${
                    source?.enabled
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                  onClick={() => toggleSource(sourceMeta.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{sourceMeta.label}</p>
                      <p
                        className={`mt-2 text-xs leading-6 ${
                          source?.enabled ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {source?.enabled
                          ? "Enabled for fetch and ranking"
                          : "Disabled for this workspace"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        source?.enabled
                          ? "bg-white/10 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {source?.enabled ? "On" : "Off"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card space-y-5">
        <SectionHeading
          title="Saved searches"
          description="Define the exact query lanes that feed the career engine."
          actions={
            <button className="btn-secondary btn-sm" onClick={addSearch}>
              Add search
            </button>
          }
        />

        <div className="space-y-4">
          {settings.savedSearches.map((search) => (
            <Panel key={search.id} tone="subtle">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <Label>Label</Label>
                  <input
                    className="input"
                    value={search.label}
                    onChange={(event) =>
                      updateSearch(search.id, { label: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <Label>Location</Label>
                  <input
                    className="input"
                    value={search.location}
                    onChange={(event) =>
                      updateSearch(search.id, { location: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <Label>Keywords</Label>
                  <input
                    className="input"
                    value={search.keywords.join(", ")}
                    onChange={(event) =>
                      updateSearch(search.id, {
                        keywords: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
                <Field>
                  <Label>Radius (miles)</Label>
                  <input
                    className="input"
                    type="number"
                    value={search.radius}
                    onChange={(event) =>
                      updateSearch(search.id, {
                        radius: parseInt(event.target.value || "0", 10),
                      })
                    }
                  />
                </Field>
              </div>

              <CommandBar className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className={`btn-sm ${search.enabled ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => updateSearch(search.id, { enabled: !search.enabled })}
                  >
                    {search.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => removeSearch(search.id)}>
                    Remove
                  </button>
                  <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={search.remoteOnly}
                      onChange={(event) =>
                        updateSearch(search.id, { remoteOnly: event.target.checked })
                      }
                    />
                    Remote only
                  </label>
                </div>
              </CommandBar>
            </Panel>
          ))}
        </div>
      </section>

      {saveMessage || settingsApi.error ? (
        <div className="flex items-center gap-4 text-sm">
          {saveMessage ? <span className="text-emerald-700">{saveMessage}</span> : null}
          {settingsApi.error ? <span className="text-rose-700">{settingsApi.error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="label">{children}</label>;
}
