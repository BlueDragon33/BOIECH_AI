import type { HealthPrivacyLevel } from "./health-domain-catalog";

export type AttentionPriority = "info" | "due" | "review" | "urgent";
export type AttentionSource = "user-reminder" | "guideline" | "care-plan" | "trend" | "episode" | "data-quality" | "system";

export type HealthDueItem = {
  id: string;
  profileId: string;
  domainId: string;
  title: string;
  dueDate?: string;
  source: "guideline" | "care-plan" | "clinician-directed" | "user-plan";
  evidenceId?: string;
  evidenceVersion?: string;
  jurisdiction?: string;
  relatedRecordId?: string;
  privacy: HealthPrivacyLevel;
};

export type HealthDataGap = {
  id: string;
  profileId: string;
  domainId: string;
  title: string;
  reason: "missing-core-profile" | "stale-record" | "unverified-record" | "missing-follow-up" | "orphan-document" | "incomplete-episode" | "other";
  blocksClinicalRule: boolean;
  privacy: HealthPrivacyLevel;
};

export type HealthTrendSignal = {
  id: string;
  profileId: string;
  domainId: string;
  title: string;
  window: "7d" | "30d" | "3m" | "6m" | "1y" | "all";
  direction: "stable" | "up" | "down" | "variable" | "insufficient-data";
  evidenceId?: string;
  ruleVersion?: string;
  priority: Exclude<AttentionPriority, "urgent"> | "urgent";
  privacy: HealthPrivacyLevel;
  explanation: string;
};

export type OpenHealthEpisode = {
  id: string;
  profileId: string;
  domainId: string;
  title: string;
  startedAt: string;
  lastUpdatedAt: string;
  needsFollowUp: boolean;
  privacy: HealthPrivacyLevel;
};

export type HealthAttentionItem = {
  id: string;
  profileId: string;
  title: string;
  summary?: string;
  domainId: string;
  priority: AttentionPriority;
  source: AttentionSource;
  dueAt?: string;
  evidenceId?: string;
  ruleVersion?: string;
  privacy: HealthPrivacyLevel;
  action: "open-record" | "complete-data" | "review-trend" | "open-episode" | "open-due-item" | "seek-help" | "none";
};

export type HealthAttentionSnapshot = {
  generatedAt: string;
  due: HealthDueItem[];
  dataGaps: HealthDataGap[];
  trends: HealthTrendSignal[];
  openEpisodes: OpenHealthEpisode[];
  attention: HealthAttentionItem[];
};

export const HEALTH_ATTENTION_RULES = {
  maxPrimaryItemsOnToday: 5,
  noOverallHealthScore: true,
  urgentClinicalSignalsRequireEvidenceRule: true,
  missingDataIsNotBadHealth: true,
  privateItemsRespectProfileVisibility: true,
  trendSignalsNeedMinimumData: true,
} as const;

// Contract only. Không có rule y khoa cụ thể nào được kích hoạt chỉ vì file này tồn tại.
// Rule cảnh báo phải có evidence/version/test riêng trước khi production.
