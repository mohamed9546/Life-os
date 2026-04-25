"use client";

import { useEffect, useState } from "react";
import {
  CandidateProfileImportDraft,
  CandidateProfileSeed,
  normalizeCandidateProfile,
} from "@/lib/profile/shared";
import { assertJsonOk } from "@/lib/api/safe-json";

interface CandidateProfileResponse {
  profile: CandidateProfileSeed | null;
  draft: CandidateProfileImportDraft | null;
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function CandidateProfilePanel() {
  const [data, setData] = useState<CandidateProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/candidate");
      const payload = await assertJsonOk<CandidateProfileResponse & { error?: string }>(
        response,
        "Failed to load candidate profile"
      );
      if (!("profile" in payload)) {
        throw new Error("Failed to load candidate profile");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidate profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updateProfileField = <K extends keyof CandidateProfileSeed>(
    key: K,
    value: CandidateProfileSeed[K]
  ) => {
    setData((current) =>
      current
        ? {
            ...current,
            profile: normalizeCandidateProfile({
              ...(current.profile || {}),
              [key]: value,
            }),
          }
        : current
    );
  };

  const uploadCv = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);
    setMessage("");

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/profile/import-cv", {
        method: "POST",
        body: formData,
      });
      await assertJsonOk<{ error?: string }>(response, "Failed to import CV");
      setMessage("CV imported into profile draft");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CV");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!data?.profile) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/profile/candidate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: data.profile }),
      });
      await assertJsonOk<{ error?: string }>(response, "Failed to save candidate profile");
      setMessage("Candidate profile saved");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save candidate profile");
    } finally {
      setSaving(false);
    }
  };

  const saveProfilePatch = async (
    patch: Partial<CandidateProfileSeed>,
    label: string
  ) => {
    const profile = normalizeCandidateProfile({
      ...(data?.profile || {}),
      ...patch,
    });

    setSavingTarget(label);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/profile/candidate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const payload = await assertJsonOk<
        CandidateProfileResponse & { error?: string }
      >(response, `Failed to save ${label}`);

      setData({
        profile: payload.profile || profile,
        draft: payload.draft ?? data?.draft ?? null,
      });
      setMessage(`${label} saved`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${label}`);
    } finally {
      setSavingTarget(null);
    }
  };

  const approveDraft = async () => {
    setSaving(true);
    setError(null);
    setMessage("");

    try {
      const response = await fetch("/api/profile/candidate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approveDraft: true }),
      });
      await assertJsonOk<{ error?: string }>(response, "Failed to approve profile draft");
      setMessage("Profile draft approved");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve profile draft");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <section className="card text-center py-10">
        <p className="text-sm text-text-secondary">Loading candidate profile...</p>
      </section>
    );
  }

  const profile = data?.profile || normalizeCandidateProfile({});
  const draft = data?.draft || null;

  return (
    <section className="card space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Candidate profile
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            Upload CV PDFs into a reviewable profile draft, then approve what should drive job fit and outreach.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="btn-secondary btn-sm cursor-pointer">
            {uploading ? "Importing..." : "Import CV PDFs"}
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(event) => void uploadCv(event.target.files)}
            />
          </label>
          <button className="btn-primary btn-sm w-full sm:w-auto" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>

      {draft && (
        <div className="rounded-lg border border-accent/30 bg-accent-subtle px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-accent">Profile draft ready</p>
              <p className="text-sm text-text-primary mt-1">
                Imported from {list(draft.sourceFiles).join(", ")} with confidence{" "}
                {Math.round(draft.confidence * 100)}%.
              </p>
            </div>
            <button className="btn-primary btn-sm w-full sm:w-auto" onClick={approveDraft} disabled={saving}>
              {saving ? "Approving..." : "Approve draft"}
            </button>
          </div>
          {list(draft.issues).length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-text-secondary">
              {list(draft.issues).map((issue, index) => (
                <li key={`${issue}-${index}`}>- {issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Full name"
          value={profile.fullName}
          onChange={(value) => updateProfileField("fullName", value)}
          onSave={() => void saveProfilePatch({ fullName: profile.fullName }, "Full name")}
          saving={savingTarget === "Full name"}
        />
        <Field
          label="Headline"
          value={profile.headline}
          onChange={(value) => updateProfileField("headline", value)}
          onSave={() => void saveProfilePatch({ headline: profile.headline }, "Headline")}
          saving={savingTarget === "Headline"}
        />
        <Field
          label="Location"
          value={profile.location}
          onChange={(value) => updateProfileField("location", value)}
          onSave={() => void saveProfilePatch({ location: profile.location }, "Location")}
          saving={savingTarget === "Location"}
        />
        <Field
          label="Target titles"
          value={list(profile.targetTitles).join(", ")}
          onChange={(value) =>
            updateProfileField(
              "targetTitles",
              value.split(",").map((item) => item.trim()).filter(Boolean)
            )
          }
          onSave={() => void saveProfilePatch({ targetTitles: profile.targetTitles }, "Target titles")}
          saving={savingTarget === "Target titles"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextAreaField
          label="Summary"
          value={profile.summary}
          onChange={(value) => updateProfileField("summary", value)}
          onSave={() => void saveProfilePatch({ summary: profile.summary }, "Summary")}
          saving={savingTarget === "Summary"}
        />
        <TextAreaField
          label="Transition narrative"
          value={profile.transitionNarrative}
          onChange={(value) => updateProfileField("transitionNarrative", value)}
          onSave={() =>
            void saveProfilePatch(
              { transitionNarrative: profile.transitionNarrative },
              "Transition narrative"
            )
          }
          saving={savingTarget === "Transition narrative"}
        />
        <TextAreaField
          label="Strengths"
          value={list(profile.strengths).join("\n")}
          onChange={(value) =>
            updateProfileField(
              "strengths",
              value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            )
          }
          onSave={() => void saveProfilePatch({ strengths: profile.strengths }, "Strengths")}
          saving={savingTarget === "Strengths"}
        />
        <TextAreaField
          label="Experience highlights"
          value={list(profile.experienceHighlights).join("\n")}
          onChange={(value) =>
            updateProfileField(
              "experienceHighlights",
              value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            )
          }
          onSave={() =>
            void saveProfilePatch(
              { experienceHighlights: profile.experienceHighlights },
              "Experience highlights"
            )
          }
          saving={savingTarget === "Experience highlights"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextAreaField
          label="Education"
          value={list(profile.education).join("\n")}
          onChange={(value) =>
            updateProfileField(
              "education",
              value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            )
          }
          onSave={() => void saveProfilePatch({ education: profile.education }, "Education")}
          saving={savingTarget === "Education"}
        />
        <TextAreaField
          label="Location constraints"
          value={list(profile.locationConstraints).join("\n")}
          onChange={(value) =>
            updateProfileField(
              "locationConstraints",
              value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            )
          }
          onSave={() =>
            void saveProfilePatch(
              { locationConstraints: profile.locationConstraints },
              "Location constraints"
            )
          }
          saving={savingTarget === "Location constraints"}
        />
      </div>

      {(message || error) && (
        <div className="space-y-2 text-sm">
          {message && <p className="text-success">{message}</p>}
          {error && <p className="text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="label">{label}</label>
        {onSave && (
          <button type="button" className="btn-secondary btn-sm w-full sm:w-auto" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="label">{label}</label>
        {onSave && (
          <button type="button" className="btn-secondary btn-sm w-full sm:w-auto" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>
      <textarea
        className="textarea min-h-28"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
