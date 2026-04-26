export interface TrackTriageResult {
  recommendedTrack: {
    id: string;
    label: string;
    score: number;
    matches: string[];
  };
  alternatives: Array<{
    id: string;
    label: string;
    score: number;
    matches: string[];
  }>;
  note: string;
}

const TRACKS = [
  {
    id: "cta-clinical",
    label: "CTA / Clinical trial support",
    keywords: [
      "clinical trial assistant",
      "clinical trials assistant",
      "clinical trial associate",
      "clinical research assistant",
      "clinical research coordinator",
      "trial coordinator",
      "clinical operations assistant",
      "study start-up",
      "study startup",
      "site activation",
      "trial administrator",
      "tmf",
      "etmf",
      "ich-gcp",
      "ctms",
    ],
    base: 28,
  },
  {
    id: "regulatory",
    label: "Regulatory support",
    keywords: ["regulatory affairs", "regulatory operations", "submissions", "mhra", "ema"],
    base: 12,
  },
  {
    id: "qa",
    label: "QA / GMP support",
    keywords: ["quality assurance", "gmp", "document control", "qms", "capa", "deviation"],
    base: 10,
  },
  {
    id: "medinfo",
    label: "Medical information",
    keywords: ["medical information", "medical affairs", "scientific support"],
    base: 8,
  },
  {
    id: "community",
    label: "Community pharmacy",
    keywords: ["pharmacist", "dispensary", "gphc", "community pharmacy"],
    base: 4,
  },
] as const;

const OFF_TARGET_TERMS = [
  "offshore",
  "oil and gas",
  "food & beverage",
  "aviation security",
  "van driver",
  "radiographer",
  "helpdesk",
  "it support",
  "tax",
  "pension",
  "warehouse",
  "chef",
];

export function triageTrackText(rawText: string): TrackTriageResult {
  const text = rawText.toLowerCase();
  const offTarget = OFF_TARGET_TERMS.some((keyword) => text.includes(keyword));

  const ranked = TRACKS.map((track) => {
    const matches = track.keywords.filter((keyword) => text.includes(keyword));
    let score = track.base + matches.length * 11;
    if (track.id === "cta-clinical" && matches.length > 0) score += 18;
    if (track.id !== "cta-clinical" && text.includes("clinical trial")) score -= 8;
    if (offTarget) score -= 24;
    return { id: track.id, label: track.label, score: Math.max(0, Math.min(100, score)), matches };
  }).sort((left, right) => right.score - left.score);

  return {
    recommendedTrack: ranked[0],
    alternatives: ranked.slice(1, 4),
    note: offTarget
      ? "Off-target signals detected; reject unless there is hidden clinical-trial context."
      : "CTA and close clinical-trial-support aliases are intentionally prioritised above secondary lanes.",
  };
}
