import type { HealthPrivacyLevel } from "./health-domain-catalog";

export type HealthProfileRole = "self" | "caregiver" | "trusted-helper";
export type HealthRecordVisibility = "profile-shared" | "caregiver-only" | "youth-private" | "emergency-card-only";
export type SensitiveNotificationMode = "full" | "redacted" | "generic";
export type YouthPrivacyMode = "caregiver-managed" | "shared-management" | "private-sections-enabled";

export type HealthProfileAccessGrant = {
  id: string;
  profileId: string;
  role: HealthProfileRole;
  deviceId?: string;
  canViewStandard: boolean;
  canViewSensitive: boolean;
  canViewHighlySensitive: boolean;
  canEditStandard: boolean;
  canEditSensitive: boolean;
  canEditHighlySensitive: boolean;
  canExport: boolean;
  canManageEmergencyCard: boolean;
  createdAt: string;
  expiresAt?: string;
};

export type HealthProfilePrivacyPolicy = {
  profileId: string;
  mode: YouthPrivacyMode;
  highlySensitiveDefault: HealthRecordVisibility;
  sensitiveDefault: HealthRecordVisibility;
  standardDefault: HealthRecordVisibility;
  notificationModeForSensitive: SensitiveNotificationMode;
  hideSensitiveDashboardCards: boolean;
  autoLockMinutes?: number;
  requireUnlockForHighlySensitive: boolean;
  jurisdictionPolicyId?: string;
  updatedAt: string;
};

export type HealthRecordPrivacyEnvelope = {
  recordId: string;
  privacy: HealthPrivacyLevel;
  visibility: HealthRecordVisibility;
  ownerProfileId: string;
  explicitShareGrantIds?: string[];
  updatedAt: string;
};

export type HealthSharePackagePolicy = {
  packageId: string;
  profileId: string;
  purpose: "clinic-visit" | "school-health" | "emergency" | "university-transition" | "personal-export" | "other";
  includeDomains: string[];
  excludeHighlySensitiveByDefault: boolean;
  expiresAt?: string;
  createdByRole: HealthProfileRole;
  createdAt: string;
};

export const HEALTH_PRIVACY_BASELINE = {
  adminCenterReceivesHealthRecords: false,
  deviceApprovalIsNotProfileAuthorization: true,
  highlySensitivePrivateByDefaultWhenPrivateSectionsEnabled: true,
  sensitiveNotificationsRedactedByDefault: true,
  explicitShareForExternalExport: true,
  emergencyCardUsesSeparateMinimalDataset: true,
  noLegalConsentAgeHardcoded: true,
} as const;

// Lớp này chỉ định nghĩa quyền ở cấp hồ sơ Sức khỏe Y tế.
// Site Quản trị tiếp tục chỉ quyết định thiết bị/app access; không quyết định ai được đọc dữ liệu tâm lý,
// dậy thì, sức khỏe sinh sản, thuốc hoặc tài liệu y tế của một hồ sơ cụ thể.
// Quy tắc quyền của trẻ/vị thành niên phải có cấu hình pháp lý/quốc gia trước khi kích hoạt production.
