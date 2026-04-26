import path from "path";
import { readDocumentText } from "./lib.mjs";

const jdPath = process.argv[2];
const cvPath = process.argv[3];

if (!jdPath || !cvPath) {
  throw new Error("Usage: node scripts/opencode/ats-score.mjs <jd-path> <cv-path>");
}

const [jdText, cvText] = await Promise.all([
  readDocumentText(path.resolve(jdPath)),
  readDocumentText(path.resolve(cvPath)),
]);

const result = scoreAts(jdText, cvText);
console.log(JSON.stringify(result, null, 2));

function scoreAts(jdText, cvText) {
  const jd = jdText.toLowerCase();
  const cv = cvText.toLowerCase();
  const candidates = [
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
  ];

  const requiredSkills = candidates.filter((term) => jd.includes(term));
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
