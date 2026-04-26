export interface AtsScoreResult {
  fitScore: number;
  requiredSkillCount: number;
  matchedSkillCount: number;
  coveragePct: number;
  sweetSpotAssessment: string;
  matchedSkills: string[];
  missingSkills: string[];
}

const ATS_TERMS = [
  "clinical trial assistant",
  "clinical trial associate",
  "clinical research assistant",
  "clinical research coordinator",
  "trial coordinator",
  "clinical operations assistant",
  "study start-up",
  "site activation",
  "trial administrator",
  "ich-gcp",
  "gcp",
  "tmf",
  "etmf",
  "ctms",
  "essential documents",
  "sop",
  "document control",
  "protocol compliance",
  "regulatory",
  "quality assurance",
  "gmp",
  "pharmacovigilance",
  "medical information",
  "study coordination",
  "site management",
] as const;

export function scoreAtsText(jdText: string, cvText: string): AtsScoreResult {
  const jd = jdText.toLowerCase();
  const cv = cvText.toLowerCase();
  const requiredSkills = ATS_TERMS.filter((term) => jd.includes(term));
  const matchedSkills = requiredSkills.filter((term) => cv.includes(term));
  const coverage = requiredSkills.length > 0 ? matchedSkills.length / requiredSkills.length : 0;
  const keywordDensity = requiredSkills.length > 0 ? matchedSkills.length / Math.min(requiredSkills.length, 15) : 0;
  const fitScore = Math.round(Math.min(100, coverage * 85 + keywordDensity * 15));

  return {
    fitScore,
    requiredSkillCount: requiredSkills.length,
    matchedSkillCount: matchedSkills.length,
    coveragePct: Number((coverage * 100).toFixed(1)),
    sweetSpotAssessment:
      matchedSkills.length >= 9 && matchedSkills.length <= 15
        ? "Within the 9-15 keyword sweet spot"
        : matchedSkills.length < 9
        ? "Below the recommended 9-15 keyword sweet spot"
        : "Above the recommended 9-15 keyword sweet spot; check for stuffing",
    matchedSkills,
    missingSkills: requiredSkills.filter((term) => !matchedSkills.includes(term)),
  };
}
