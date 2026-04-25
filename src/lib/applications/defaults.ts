import { ApplicationProfile, CvLibraryEntry, TargetCompany } from "@/types";

const now = () => new Date().toISOString();

export function defaultCvLibrary(): CvLibraryEntry[] {
  const createdAt = now();
  const updatedAt = createdAt;
  return [
    {
      id: "cv-cra",
      label: "CRA / Clinical Research",
      path: "E:\\CV\\chatgpt\\Mohamed_Abdalla_CV_CRA.pdf",
      roleTracks: ["clinical"],
      keywords: ["cra", "clinical research", "clinical trial", "cta", "tmf", "gcp"],
      active: true,
      createdAt,
      updatedAt,
    },
    {
      id: "cv-pharmacy",
      label: "Pharmacy / PV / MedInfo",
      path: "E:\\CV\\chatgpt\\Mohamed_Abdalla_CV_Pharmacy.pdf",
      roleTracks: ["pv", "medinfo", "other"],
      keywords: ["pharmacy", "pharmacovigilance", "drug safety", "medical information"],
      active: true,
      createdAt,
      updatedAt,
    },
    {
      id: "cv-qa-compliance",
      label: "QA / Compliance",
      path: "E:\\CV\\chatgpt\\Mohamed_Abdalla_CV_QA_Compliance.pdf",
      roleTracks: ["qa"],
      keywords: ["quality assurance", "qa", "compliance", "gmp", "sop", "document control"],
      active: true,
      createdAt,
      updatedAt,
    },
    {
      id: "cv-regulatory",
      label: "Regulatory Affairs",
      path: "E:\\CV\\chatgpt\\Mohamed_Abdalla_CV_Regulatory_Affairs.pdf",
      roleTracks: ["regulatory"],
      keywords: ["regulatory affairs", "regulatory operations", "submissions", "compliance"],
      active: true,
      createdAt,
      updatedAt,
    },
    {
      id: "cv-research-assistant",
      label: "Research Assistant",
      path: "E:\\CV\\chatgpt\\Mohamed_Abdalla_CV_Research_Assistant.pdf",
      roleTracks: ["clinical", "other"],
      keywords: ["research assistant", "clinical research", "data collection", "laboratory"],
      active: true,
      createdAt,
      updatedAt,
    },
  ];
}

export function defaultApplicationProfile(
  userId: string,
  email: string
): ApplicationProfile {
  const createdAt = now();
  return {
    id: userId,
    fullName: "Mohamed Abdalla",
    email,
    phone: "",
    address: "",
    city: "Glasgow",
    country: "United Kingdom",
    linkedinUrl: "",
    rightToWork: "",
    sponsorship: "",
    noticePeriod: "",
    salaryExpectation: "",
    relocationPreference: "Open to UK/Ireland/Egypt roles where feasible",
    stockAnswers: {},
    createdAt,
    updatedAt: createdAt,
  };
}

export function defaultTargetCompanies(): TargetCompany[] {
  const createdAt = now();
  const updatedAt = createdAt;
  const rows: Array<Omit<TargetCompany, "createdAt" | "updatedAt">> = [
    {
      id: "iqvia",
      name: "IQVIA",
      category: "cro",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://jobs.iqvia.com/en/search-jobs",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "parexel",
      name: "Parexel",
      category: "cro",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://jobs.parexel.com/en/search-jobs",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "icon",
      name: "ICON plc",
      category: "cro",
      countries: ["United Kingdom", "Ireland"],
      careersUrl: "https://careers.iconplc.com/jobs",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "thermo-fisher-ppd",
      name: "Thermo Fisher / PPD",
      category: "cro",
      countries: ["United Kingdom", "Ireland"],
      careersUrl: "https://jobs.thermofisher.com/global/en/search-results",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "gsk",
      name: "GSK",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://jobs.gsk.com/en-gb/jobs",
      atsType: "workday",
      enabled: true,
    },
    {
      id: "astrazeneca",
      name: "AstraZeneca",
      category: "pharma",
      countries: ["United Kingdom", "Egypt"],
      careersUrl: "https://careers.astrazeneca.com/search-jobs",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "pfizer",
      name: "Pfizer",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://www.pfizer.com/about/careers/search",
      atsType: "workday",
      enabled: true,
    },
    {
      id: "novartis",
      name: "Novartis",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://www.novartis.com/careers/career-search",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "roche",
      name: "Roche",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://careers.roche.com/global/en/search-results",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "abbvie",
      name: "AbbVie",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://careers.abbvie.com/en/search-jobs",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "msd",
      name: "MSD",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://jobs.msd.com/gb/en/search-results",
      atsType: "generic",
      enabled: true,
    },
    {
      id: "takeda",
      name: "Takeda",
      category: "pharma",
      countries: ["United Kingdom", "Ireland", "Egypt"],
      careersUrl: "https://www.takedajobs.com/search-jobs",
      atsType: "generic",
      enabled: true,
    },
  ];

  return rows.map((row) => ({ ...row, createdAt, updatedAt }));
}
