export type HealthRecordId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type HealthRecordMeta = {
  id: HealthRecordId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  note?: string;
};

export type MedicationRecord = HealthRecordMeta & {
  name: string;
  form?: string;
  doseText?: string;
  scheduleText?: string;
  startDate?: IsoDate;
  endDate?: IsoDate;
  active: boolean;
  prescribedBy?: string;
  source: "user" | "caregiver" | "clinician-document";
};

export type AllergyRecord = HealthRecordMeta & {
  substance: string;
  reactionText?: string;
  severity?: "unknown" | "mild" | "moderate" | "severe";
  confirmedByClinician?: boolean;
};

export type PreventiveCareRecord = HealthRecordMeta & {
  kind: "vaccination" | "dental" | "vision" | "hearing" | "general-checkup" | "other";
  title: string;
  date?: IsoDate;
  nextDueDate?: IsoDate;
  status: "planned" | "completed" | "skipped" | "unknown";
  provider?: string;
};

export type AppointmentRecord = HealthRecordMeta & {
  title: string;
  date: IsoDate;
  time?: string;
  provider?: string;
  place?: string;
  reason?: string;
  outcomeNote?: string;
  calendarReminderId?: string;
};

export type HealthDocumentMetadata = HealthRecordMeta & {
  title: string;
  kind: "prescription" | "lab" | "imaging" | "vaccination" | "visit-note" | "certificate" | "other";
  documentDate?: IsoDate;
  localReference?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type PubertyBodyChangeRecord = HealthRecordMeta & {
  category: "general-change" | "skin" | "hair" | "voice" | "menstrual-cycle" | "other";
  date: IsoDate;
  privateByDefault: true;
  text?: string;
};

export type MenstrualCycleRecord = HealthRecordMeta & {
  startDate: IsoDate;
  endDate?: IsoDate;
  symptoms?: string[];
  privateByDefault: true;
};

export type MentalWellbeingCheckIn = HealthRecordMeta & {
  date: IsoDate;
  mood?: "good" | "okay" | "low" | "very-low";
  stressLevel?: 0 | 1 | 2 | 3 | 4 | 5;
  sleepConcern?: boolean;
  supportNote?: string;
  privateByDefault: true;
};

export type SafetySupportPlan = HealthRecordMeta & {
  trustedContacts: Array<{ name: string; relation?: string; phone?: string }>;
  safePlaces?: string[];
  notes?: string;
  privateByDefault: true;
};

export type EmergencyHealthCard = {
  preferredName: string;
  dateOfBirth?: IsoDate;
  emergencyContacts: Array<{ name: string; relation?: string; phone: string }>;
  criticalAllergies?: string[];
  criticalMedications?: string[];
  importantConditionsText?: string;
  bloodTypeText?: string;
  updatedAt: IsoDateTime;
};

export type AdultTransitionChecklist = {
  knowsOwnAllergies: boolean;
  knowsOwnMedications: boolean;
  canExplainImportantHealthHistory: boolean;
  knowsEmergencyContacts: boolean;
  canBookAnAppointment: boolean;
  canManageReminders: boolean;
  hasHealthDocumentsReady: boolean;
  knowsHowToSeekUrgentHelp: boolean;
  preparedForLivingAwayFromFamily: boolean;
};

export type FutureHealthRecordBundle = {
  schemaVersion: 1;
  medications: MedicationRecord[];
  allergies: AllergyRecord[];
  preventiveCare: PreventiveCareRecord[];
  appointments: AppointmentRecord[];
  documents: HealthDocumentMetadata[];
  pubertyRecords: PubertyBodyChangeRecord[];
  menstrualCycles: MenstrualCycleRecord[];
  wellbeing: MentalWellbeingCheckIn[];
  safetyPlan?: SafetySupportPlan;
  emergencyCard?: EmergencyHealthCard;
  adultTransition?: AdultTransitionChecklist;
};

// Đây là data contract cho các lượt triển khai sâu sau này.
// Không đồng nghĩa các trường đang được thu thập, đồng bộ hoặc gửi sang Site Quản trị.
// Khi kích hoạt persistence phải có migration, privacy review và regression gate riêng.
