const SOURCE_META: Record<string, { label: string; badgeClassName: string }> = {
  adzuna: {
    label: "Adzuna",
    badgeClassName: "bg-emerald-500/10 text-emerald-400",
  },
  reed: {
    label: "Reed",
    badgeClassName: "bg-orange-500/10 text-orange-400",
  },
  jobsac: {
    label: "jobs.ac.uk",
    badgeClassName: "bg-cyan-500/10 text-cyan-400",
  },
  totaljobs: {
    label: "Totaljobs",
    badgeClassName: "bg-sky-500/10 text-sky-400",
  },
  jooble: {
    label: "Jooble",
    badgeClassName: "bg-fuchsia-500/10 text-fuchsia-400",
  },
  serpapi: {
    label: "SerpAPI Google Jobs",
    badgeClassName: "bg-slate-900/10 text-slate-600",
  },
  greenhouse: {
    label: "Greenhouse",
    badgeClassName: "bg-green-500/10 text-green-400",
  },
  lever: {
    label: "Lever",
    badgeClassName: "bg-purple-500/10 text-purple-400",
  },
  remotive: {
    label: "Remotive",
    badgeClassName: "bg-cyan-500/10 text-cyan-400",
  },
  arbeitnow: {
    label: "Arbeitnow",
    badgeClassName: "bg-yellow-500/10 text-yellow-400",
  },
  himalayas: {
    label: "Himalayas",
    badgeClassName: "bg-teal-500/10 text-teal-400",
  },
  linkedin: {
    label: "LinkedIn Public",
    badgeClassName: "bg-blue-500/10 text-blue-400",
  },
  "rapidapi-linkedin": {
    label: "LinkedIn RapidAPI",
    badgeClassName: "bg-blue-500/10 text-blue-400",
  },
  indeed: {
    label: "Indeed",
    badgeClassName: "bg-indigo-500/10 text-indigo-400",
  },
  findwork: {
    label: "FindWork",
    badgeClassName: "bg-pink-500/10 text-pink-400",
  },
  careerjet: {
    label: "CareerJet",
    badgeClassName: "bg-amber-500/10 text-amber-400",
  },
  themuse: {
    label: "The Muse",
    badgeClassName: "bg-rose-500/10 text-rose-400",
  },
  weworkremotely: {
    label: "We Work Remotely",
    badgeClassName: "bg-violet-500/10 text-violet-400",
  },
  guardianjobs: {
    label: "Guardian Jobs",
    badgeClassName: "bg-red-500/10 text-red-400",
  },
  nhsjobs: {
    label: "NHS Jobs",
    badgeClassName: "bg-blue-500/10 text-blue-300",
  },
  manual: {
    label: "Manual",
    badgeClassName: "bg-surface-3 text-text-secondary",
  },
  scraper: {
    label: "Scraper",
    badgeClassName: "bg-gray-500/10 text-gray-400",
  },
  "job-alert": {
    label: "Job Alert",
    badgeClassName: "bg-violet-500/10 text-violet-400",
  },
  "gmail-alerts": {
    label: "Gmail Alerts",
    badgeClassName: "bg-violet-500/10 text-violet-300",
  },
  irishjobs: {
    label: "IrishJobs",
    badgeClassName: "bg-emerald-500/10 text-emerald-400",
  },
};

function titleCaseWords(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSourceLabel(source: string): string {
  if (SOURCE_META[source]?.label) {
    return SOURCE_META[source].label;
  }

  if (source.startsWith("gmail-")) {
    const alertSource = source.slice("gmail-".length);
    return `Gmail · ${getSourceLabel(alertSource)}`;
  }

  return titleCaseWords(source.replace(/[_-]+/g, " "));
}

export function getSourceBadgeClassName(source: string): string {
  if (SOURCE_META[source]?.badgeClassName) {
    return SOURCE_META[source].badgeClassName;
  }

  if (source.startsWith("gmail-")) {
    return "bg-violet-500/10 text-violet-300";
  }

  return "bg-surface-3 text-text-tertiary";
}
