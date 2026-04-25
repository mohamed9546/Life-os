export const ROLE_TRACK_LABELS: Record<string, string> = {
  clinical: "Clinical",
  regulatory: "Regulatory",
  qa: "QA",
  pv: "Drug Safety",
  medinfo: "Medical Info",
  other: "Other",
};

export const DEFAULT_VISIBLE_ROLE_TRACKS = [
  "clinical",
  "qa",
  "regulatory",
  "medinfo",
  "other",
] as const;

export function getRoleTrackLabel(roleTrack?: string | null): string {
  if (!roleTrack) return "Other";
  return ROLE_TRACK_LABELS[roleTrack] || roleTrack;
}
