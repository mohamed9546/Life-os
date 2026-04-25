"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserSettingsBundle } from "@/types";
import { useApi } from "@/hooks/use-api";

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function OnboardingForm({
  initialSettings,
}: {
  initialSettings: UserSettingsBundle;
}) {
  const router = useRouter();
  const settingsApi = useApi<UserSettingsBundle>();
  const [name, setName] = useState(initialSettings.profile.fullName || "");
  const [locations, setLocations] = useState(
    list(initialSettings.profile.targetLocations).join(", ")
  );
  const [seniority, setSeniority] = useState(
    initialSettings.profile.preferredSeniority
  );
  const [remotePreference, setRemotePreference] = useState(
    initialSettings.profile.remotePreference
  );
  const [roleTracks, setRoleTracks] = useState<string[]>(
    list(initialSettings.profile.targetRoleTracks)
  );

  const toggleRoleTrack = (roleTrack: string) => {
    setRoleTracks((current) =>
      current.includes(roleTrack)
        ? current.filter((item) => item !== roleTrack)
        : [...current, roleTrack]
    );
  };

  const handleSubmit = async () => {
    const result = await settingsApi.call("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        profile: {
          fullName: name.trim() || null,
          onboardingCompleted: true,
          targetLocations: locations
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          preferredSeniority: seniority,
          remotePreference,
          targetRoleTracks: roleTracks,
        },
      }),
    });

    if (result) {
      router.replace("/career");
      router.refresh();
    }
  };

  return (
    <div className="card space-y-5">
      <div>
        <label className="label">Your name</label>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="How should we label your workspace?"
        />
      </div>

      <div>
        <label className="label">Priority locations</label>
        <input
          className="input"
          value={locations}
          onChange={(event) => setLocations(event.target.value)}
          placeholder="Glasgow, Scotland, United Kingdom"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Preferred seniority</label>
          <input
            className="input"
            value={seniority}
            onChange={(event) => setSeniority(event.target.value)}
            placeholder="entry-to-mid"
          />
        </div>
        <div>
          <label className="label">Remote preference</label>
          <select
            className="input"
            value={remotePreference}
            onChange={(event) => setRemotePreference(event.target.value as typeof remotePreference)}
          >
            <option value="flexible">Flexible</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Role tracks</label>
        <div className="flex flex-wrap gap-2">
          {[
            ["qa", "Quality assurance"],
            ["regulatory", "Regulatory"],
            ["medinfo", "Medical information"],
            ["clinical", "Clinical operations"],
          ].map(([value, label]) => {
            const active = roleTracks.includes(value);
            return (
              <button
                key={value}
                type="button"
                className={`px-3 py-2 rounded-lg text-sm border ${
                  active
                    ? "border-accent/30 bg-accent-subtle text-text-primary"
                    : "border-surface-3 bg-surface-2 text-text-secondary"
                }`}
                onClick={() => toggleRoleTrack(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <button className="btn-primary" onClick={handleSubmit} disabled={settingsApi.loading}>
          {settingsApi.loading ? "Saving..." : "Finish setup"}
        </button>
        {settingsApi.error && <p className="text-sm text-danger mt-3">{settingsApi.error}</p>}
      </div>
    </div>
  );
}
