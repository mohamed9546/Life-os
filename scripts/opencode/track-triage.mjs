import { promises as fs } from "fs";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const source = process.argv[2];
let text = "";

if (source) {
  const maybePath = path.resolve(source);
  try {
    text = await fs.readFile(maybePath, "utf8");
  } catch {
    text = source;
  }
}

if (!text.trim()) {
  const rl = readline.createInterface({ input, output });
  text = await rl.question("Paste JD text or a short summary: ");
  await rl.close();
}

const result = triageTrack(text);
console.log(JSON.stringify(result, null, 2));

function triageTrack(rawText) {
  const text = rawText.toLowerCase();
  const tracks = [
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
        "site activation",
        "trial administrator",
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
  ];

  const offTarget = [
    "offshore",
    "oil and gas",
    "food & beverage",
    "aviation security",
    "van driver",
    "radiographer",
    "helpdesk",
    "it support",
  ].some((keyword) => text.includes(keyword));

  const ranked = tracks.map((track) => {
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
