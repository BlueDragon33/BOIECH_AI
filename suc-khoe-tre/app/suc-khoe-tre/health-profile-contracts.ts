export type HealthProfileId = string;

export type HealthProfileIdentity = {
  id: HealthProfileId;
  displayName: string;
  birthDate: string;
  sexForGrowthReference: "male" | "female" | "";
  avatarLocalReference?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthProfileBackground = {
  profileId: HealthProfileId;
  preferredName?: string;
  bloodTypeText?: string;
  primaryCareProviderText?: string;
  importantNotes?: string;
  assistiveDevices?: string[];
  schoolHealthNotes?: string;
  updatedAt: string;
};

export type HealthProfileRegistry = {
  schemaVersion: 1;
  profiles: HealthProfileIdentity[];
  activeProfileId?: HealthProfileId;
  updatedAt: string;
};

export type ProfileMigrationEnvelope = {
  fromSingleProfileState: true;
  createdProfileId: HealthProfileId;
  migratedAt: string;
  legacyStorageKeyPreserved: true;
};

export const HEALTH_PROFILE_RULES = {
  everyHealthRecordRequiresProfileId: true,
  activeProfileMustBeExplicit: true,
  noCrossProfileTimelineMixing: true,
  noCrossProfileReminderMixing: true,
  profileDeletionRequiresExplicitConfirmation: true,
  exportIsProfileScopedByDefault: true,
  deviceAccessDoesNotGrantAllProfileVisibility: true,
} as const;

// Contract only. Local state hiện tại vẫn là single-profile baseline.
// Khi migration sang multi-profile được triển khai phải giữ key cũ để rollback, tạo profileId cho dữ liệu hiện có,
// kiểm thử không trộn dữ liệu giữa các con và không làm mất backup legacy.
