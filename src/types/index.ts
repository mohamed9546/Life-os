// ============================================================
// Shared domain and platform types for the local-first Life OS app.
// ============================================================

export type Timestamp = string;
export type Confidence = number;
export type Score = number;

export type TaskStatus = "idle" | "running" | "success" | "skipped" | "failed";
export type UserJobStatus =
  | "inbox"
  | "shortlisted"
  | "tracked"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "archived";
export type PriorityBand = "high" | "medium" | "low" | "reject";
export type RemoteType = "remote" | "hybrid" | "onsite" | "unknown";
export type EmploymentType = "permanent" | "contract" | "temp" | "unknown";
export type RoleTrack =
  | "qa"
  | "regulatory"
  | "pv"
  | "medinfo"
  | "clinical"
  | "other";
export type NotificationFrequency = "manual" | "daily" | "weekly";
export type RoutineArea = "career" | "money" | "life" | "health" | "admin";
export type RoutineCadence = "daily" | "weekly" | "custom";
export type AIProvider = "ollama" | "gemini";
export type AIRuntimeMode = "local" | "cloud";
export type AICompatibilityMode = "ollama" | "openai" | "anthropic" | "gemini";
export type AIFailureKind =
  | "timeout"
  | "runtime_error"
  | "invalid_json"
  | "schema_validation"
  | "rate_limited";
export type AITaskType =
  | "health-test"
  | "parse-job"
  | "evaluate-job"
  | "extract-candidate-profile"
  | "categorize-transaction"
  | "summarize-money"
  | "summarize-week"
  | "summarize-decision"
  | "summarize-decision-patterns"
  | "suggest-routine-focus"
  | "generate-followup"
  | "generate-outreach"
  | "chat"
  | "tailor-cv"
  | "linkedin-intro"
  | "cover-letter"
  | "cv-optimize"
  | "interview-prep"
  | "salary-lookup"
  | "skill-gap"
  | "extract-job-from-scrape"
  | "extract-job-list-from-scrape";

export interface Timestamped {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- AI types ---

export interface AIMetadata {
  model: string;
  promptType: string;
  timestamp: Timestamp;
  confidence: Confidence;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  fallbackUsed: boolean;
  fallbackAttempted: boolean;
  attemptCount: number;
  effectiveTimeoutMs: number;
  jsonExtractionFallback: boolean;
  failureKind?: AIFailureKind;
}

export interface AIResult<T> {
  data: T;
  meta: AIMetadata;
  rawInput?: unknown;
  rawOutput?: string;
}

export interface AITaskRuntimeConfig {
  enabled: boolean;
  label: string;
  model?: string;
  fallbackModel?: string | null;
  timeoutMs?: number;
  retryAttempts?: number;
  temperature: number;
  maxTokens: number;
}

export interface AIHealthStatus {
  available: boolean;
  provider: AIProvider;
  mode: AIRuntimeMode;
  compatibilityMode: AICompatibilityMode;
  checkedAt: Timestamp;
  endpoint: string;
  primaryModel: string;
  fallbackModel: string | null;
  responseTimeMs: number | null;
  availableModels: string[];
  configuredTasks: Array<{
    taskType: AITaskType;
    enabled: boolean;
    model: string;
    fallbackModel: string | null;
  }>;
  diagnostics?: {
    recentCalls: number;
    recentFailures: number;
    recentTimeouts: number;
    recentFallbacks: number;
    timeoutsByTaskType: Partial<Record<AITaskType, number>>;
  };
  error?: string;
}

export interface AIConfig {
  provider: AIProvider;
  mode: AIRuntimeMode;
  enabled: boolean;
  baseUrl: string;
  apiKey?: string | null;
  compatibilityMode: AICompatibilityMode;
  model: string;
  fallbackModel: string | null;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
  retryAttempts: number;
  retryDelayMs: number;
  maxCallsPerDay: number;
  maxCallsPerTaskType: number;
  taskSettings: Record<AITaskType, AITaskRuntimeConfig>;
}

// --- Job domain types ---

export interface RawJobItem {
  source: string;
  sourceJobId?: string;
  company: string;
  title: string;
  location: string;
  salaryText?: string;
  link: string;
  postedAt?: Timestamp;
  employmentType?: string;
  remoteType?: string;
  description?: string;
  raw?: unknown;
  fetchedAt: Timestamp;
}

export interface ParsedJobPosting {
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  employmentType: EmploymentType;
  seniority: string;
  remoteType: RemoteType;
  roleFamily: string;
  roleTrack: RoleTrack;
  mustHaves: string[];
  niceToHaves: string[];
  redFlags: string[];
  keywords: string[];
  summary: string;
  confidence: Confidence;
}

export interface JobFitEvaluation {
  fitScore: Score;
  redFlagScore: Score;
  priorityBand: PriorityBand;
  whyMatched: string[];
  whyNot: string[];
  strategicValue: string;
  likelyInterviewability: string;
  actionRecommendation: "apply now" | "apply if time" | "skip";
  visaRisk: "green" | "amber" | "red";
  confidence: Confidence;
}

export interface EnrichedJob extends Timestamped {
  id: string;
  raw: RawJobItem;
  parsed: AIResult<ParsedJobPosting> | null;
  fit: AIResult<JobFitEvaluation> | null;
  status: UserJobStatus;
  userNotes?: string;
  dedupeKey: string;
  sourceQueryId?: string | null;
  userId?: string;
  companyIntel?: CompanyIntel | null;
  decisionMakers?: DecisionMaker[];
  outreachStrategy?: OutreachStrategy | null;
  followUpDate?: Timestamp | null;
  followUpNote?: string | null;
  stageChangedAt?: Timestamp | null;
}

export interface FollowUpPlan {
  nextAction: string;
  followUpDateSuggestion: string;
  rationale: string;
  customNotes: string;
}

// --- User settings / onboarding ---

export interface CareerProfile extends Timestamped {
  id: string;
  email: string;
  fullName: string | null;
  onboardingCompleted: boolean;
  targetRoleTracks: RoleTrack[];
  targetLocations: string[];
  remotePreference: RemoteType | "flexible";
  preferredSeniority: string;
  notificationFrequency: NotificationFrequency;
  isAdmin: boolean;
}

export interface SavedSearch extends Timestamped {
  id: string;
  userId: string;
  label: string;
  keywords: string[];
  location: string;
  remoteOnly: boolean;
  radius: number;
  enabled: boolean;
}

export interface SourcePreference extends Timestamped {
  id: string;
  userId: string;
  sourceId: string;
  enabled: boolean;
}

export interface UserSettingsBundle {
  profile: CareerProfile;
  savedSearches: SavedSearch[];
  sourcePreferences: SourcePreference[];
}

export interface AuthenticatedAppUser {
  id: string;
  email: string;
  isAdmin: boolean;
  mode: "preview" | "supabase";
}

// --- Money domain types ---

export interface Transaction extends Timestamped {
  id: string;
  date: Timestamp;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  merchantCleaned?: string;
  aiCategorization?: AIResult<TransactionCategorization> | null;
}

export interface TransactionCategorization {
  category: string;
  merchantCleaned: string;
  confidence: Confidence;
  notes: string;
}

// --- Decision domain types ---

export interface Decision extends Timestamped {
  id: string;
  title: string;
  context: string;
  options: string[];
  chosenOption?: string;
  outcome?: string;
  status: "open" | "decided" | "reviewed";
  aiSummary?: AIResult<DecisionSummary> | null;
}

export interface DecisionSummary {
  conciseSummary: string;
  hiddenAssumptions: string[];
  risks: string[];
  nextReviewQuestions: string[];
}

export interface WeeklyReview {
  weeklySummary: string;
  wins: string[];
  risks: string[];
  recommendedFocus: string[];
  whatToIgnore: string[];
  energyAdvice: string;
  jobSearchAdvice: string;
  moneyAdvice: string;
  unfinishedLoops: string[];
  nextWeekOperatingFocus: string[];
}

export interface MoneyReview {
  narrativeSummary: string;
  recurringCommitments: string[];
  unusualSpikes: string[];
  monthlyAdjustments: string[];
  stabilityWarning: string;
  confidence: Confidence;
}

export interface DecisionPatternReview {
  repeatedAssumptions: string[];
  commonRiskThemes: string[];
  avoidanceLoops: string[];
  reviewChecklist: string[];
  narrativeSummary: string;
  confidence: Confidence;
}

export interface WeeklyReviewComparison {
  currentId: string;
  previousId: string | null;
  repeatedRisks: string[];
  repeatedFocusThemes: string[];
  risingSignals: string[];
  changedSignals: string[];
}

// --- Routine / import domain types ---

export interface Routine extends Timestamped {
  id: string;
  title: string;
  description?: string;
  area: RoutineArea;
  cadence: RoutineCadence;
  targetDays?: number[];
  enabled: boolean;
  aiPrompt?: string;
  streak: number;
  lastCompletedAt?: Timestamp | null;
}

export interface RoutineCheckIn extends Timestamped {
  id: string;
  routineId: string;
  status: "completed" | "skipped";
  note?: string;
  completedAt: Timestamp;
}

export interface RoutineAnalytics {
  consistencyScore: number;
  completedLast7Days: number;
  skippedLast7Days: number;
  dueToday: number;
  areaBalance: Array<{
    area: RoutineArea;
    enabled: number;
    completedLast7Days: number;
  }>;
  skippedLoopWarnings: string[];
  nextBestAction: string;
}

export interface ImportRecord extends Timestamped {
  id: string;
  type:
    | "jobs-json"
    | "jobs-text"
    | "transactions-csv"
    | "transactions-json"
    | "cv-pdf"
    | "mixed-text";
  label: string;
  status: TaskStatus;
  counts: {
    received: number;
    imported: number;
    failed: number;
  };
  summary?: string;
}

// --- Worker / operations ---

export interface WorkerTaskConfig {
  id: string;
  name: string;
  enabled: boolean;
  minIntervalMs: number;
  dailyLimit: number;
  burstWindowMs: number;
  burstLimit: number;
  cooldownMs: number;
  maxConsecutiveFailures: number;
  adminOnly?: boolean;
}

export interface WorkerTaskState {
  taskId: string;
  status: TaskStatus;
  lastRun: Timestamp | null;
  lastSuccess: Timestamp | null;
  lastFailure: Timestamp | null;
  consecutiveFailures: number;
  runsToday: number;
  todayDate: string;
  skippedReason?: string;
  error?: string;
}

export interface WorkerRunRecord extends Timestamped {
  id: string;
  taskId: string;
  status: TaskStatus;
  actorId: string;
  details?: Record<string, unknown>;
  error?: string;
}

// --- Source / admin config ---

export interface GreenhouseCompanyConfig {
  name: string;
  boardToken: string;
  enabled: boolean;
  sourceTag?: string;
}

export interface LeverCompanyConfig {
  name: string;
  endpointUrl: string;
  enabled: boolean;
  sourceTag?: string;
}

export interface AppConfig {
  jobSources: {
    adzuna: {
      enabled: boolean;
      appId: string;
      appKey: string;
      country: string;
    };
    reed: {
      enabled: boolean;
      apiKey: string;
    };
    jobsac: {
      enabled: boolean;
    };
    totaljobs: {
      enabled: boolean;
    };
    jooble: {
      enabled: boolean;
      apiKey: string;
    };
    serpApi: {
      enabled: boolean;
      apiKey: string;
      gl: string;
      hl: string;
      googleDomain: string;
    };
    greenhouse: {
      enabled: boolean;
      companies: GreenhouseCompanyConfig[];
    };
    lever: {
      enabled: boolean;
      companies: LeverCompanyConfig[];
    };
    remotive: {
      enabled: boolean;
    };
    arbeitnow: {
      enabled: boolean;
    };
    findwork: {
      enabled: boolean;
      apiKey: string;
    };
    themuse: {
      enabled: boolean;
      apiKey?: string;
    };
    careerjet: {
      enabled: boolean;
      affid?: string;
    };
    himalayas: {
      enabled: boolean;
    };
    brightnetwork: {
      enabled: boolean;
    };
    indeed: {
      enabled: boolean;
    };
    linkedin: {
      enabled: boolean;
    };
    rapidApiLinkedin: {
      enabled: boolean;
      apiKey: string;
    };
    weworkremotely: {
      enabled: boolean;
    };
    guardianjobs: {
      enabled: boolean;
    };
  };
  enrichment: {
    apollo: {
      enabled: boolean;
      apiKey: string;
    };
    autoEnrichCompany: boolean;
    autoFindDecisionMakers: boolean;
    autoFindEmails: boolean;
    autoGenerateOutreach: boolean;
    minFitScoreForPeopleSearch: number;
    minFitScoreForOutreach: number;
  };
  worker: {
    tasks: WorkerTaskConfig[];
  };
}

// --- Company intelligence types ---

export interface CompanyIntel {
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: string;
  employeeRange?: string;
  founded?: string;
  description?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  location?: string;
  techStack?: string[];
  keywords?: string[];
  annualRevenue?: string;
  totalFunding?: string;
  latestFundingRound?: string;
  phoneNumber?: string;
  apolloId?: string;
  enrichedAt: Timestamp;
}

export interface MerchantRule extends Timestamped {
  id: string;
  matchText: string;
  merchantCleaned: string;
  category: string;
}

export interface DecisionMaker {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  email?: string;
  emailConfidence?: string;
  linkedinUrl?: string;
  company: string;
  companyDomain?: string;
  seniority?: string;
  departments?: string[];
  city?: string;
  country?: string;
  phoneNumbers?: string[];
  apolloId?: string;
  foundAt: Timestamp;
}

export type JobContactState =
  | "No contacts yet"
  | "Contacts found"
  | "Email ready"
  | "Outreach draft ready"
  | "Stale contacts";

export type JobRankingState =
  | "AI fit + ranked"
  | "Parse only"
  | "No fit score yet"
  | "Ranking degraded";

export interface OutreachStrategy {
  recommendedAction: string;
  targetContacts: Array<{
    name: string;
    title: string;
    email?: string;
    linkedinUrl?: string;
    approachSuggestion: string;
  }>;
  emailDraft?: string;
  linkedinMessageDraft?: string;
  timing: string;
  confidence: number;
}

export interface JobWithIntel extends EnrichedJob {
  companyIntel?: CompanyIntel | null;
  decisionMakers?: DecisionMaker[];
  outreachStrategy?: OutreachStrategy | null;
}

export interface RapidAPIConfig {
  enabled: boolean;
  apiKey: string;
}

export interface ApolloConfig {
  enabled: boolean;
  apiKey: string;
}

// --- Navigation ---

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
}
