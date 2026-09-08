export type HealthRecordId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type HealthRecordSource = "self" | "caregiver" | "clinician-document" | "school-record" | "device" | "import";
export type HealthRecordVerification = "unverified" | "documented" | "clinician-confirmed";

export type HealthRecordMeta = {
  id: HealthRecordId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  note?: string;
  source?: HealthRecordSource;
  sourceLabel?: string;
  verification?: HealthRecordVerification;
  recordedByProfileId?: string;
};

export type VitalSignRecord = HealthRecordMeta & {
  dateTime: IsoDateTime;
  kind: "blood-pressure" | "pulse" | "temperature" | "spo2" | "respiratory-rate" | "other";
  systolicMmHg?: number;
  diastolicMmHg?: number;
  value?: number;
  unit?: string;
  context?: "resting" | "after-activity" | "during-illness" | "school-check" | "clinic" | "other";
};

export type ScreeningResultRecord = HealthRecordMeta & {
  date: IsoDate;
  kind: "vision" | "hearing" | "oral" | "mental-health" | "substance-use" | "nutrition" | "development" | "other";
  instrumentId?: string;
  instrumentVersion?: string;
  resultText?: string;
  score?: number;
  interpretationText?: string;
  followUpRecommended?: boolean;
  nextDueDate?: IsoDate;
};

export type ClinicalTestResultRecord = HealthRecordMeta & {
  date: IsoDate;
  testName: string;
  valueText?: string;
  numericValue?: number;
  unit?: string;
  referenceRangeText?: string;
  abnormalFlag?: "unknown" | "normal" | "low" | "high" | "abnormal";
  laboratoryOrFacility?: string;
  documentId?: string;
};

export type ConditionRecord = HealthRecordMeta & {
  name: string;
  status: "active" | "resolved" | "unknown";
  diagnosedDate?: IsoDate;
  resolvedDate?: IsoDate;
  clinicianOrFacility?: string;
  schoolAccommodationNeeded?: boolean;
};

export type ProcedureHospitalizationRecord = HealthRecordMeta & {
  kind: "procedure" | "surgery" | "hospitalization" | "emergency-visit" | "other";
  title: string;
  startDate: IsoDate;
  endDate?: IsoDate;
  facility?: string;
  outcomeText?: string;
  documentIds?: string[];
};

export type FamilyHistoryRecord = HealthRecordMeta & {
  relation: string;
  condition: string;
  ageAtOnsetText?: string;
  importantForCare?: boolean;
};

export type CarePlanRecord = HealthRecordMeta & {
  conditionId?: string;
  title: string;
  effectiveFrom?: IsoDate;
  reviewDueDate?: IsoDate;
  clinicianOrFacility?: string;
  instructionsText?: string;
  schoolInstructionsText?: string;
  emergencyInstructionsText?: string;
  documentId?: string;
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

export type MedicationAdministrationRecord = HealthRecordMeta & {
  medicationId: string;
  scheduledAt?: IsoDateTime;
  takenAt?: IsoDateTime;
  status: "taken" | "missed" | "skipped" | "unknown";
};

export type AllergyRecord = HealthRecordMeta & {
  substance: string;
  reactionText?: string;
  severity?: "unknown" | "mild" | "moderate" | "severe";
  firstKnownDate?: IsoDate;
  confirmedByClinician?: boolean;
  emergencyPlanId?: string;
};

export type PreventiveCareRecord = HealthRecordMeta & {
  kind: "vaccination" | "dental" | "vision" | "hearing" | "general-checkup" | "screening" | "other";
  title: string;
  date?: IsoDate;
  nextDueDate?: IsoDate;
  status: "planned" | "completed" | "skipped" | "unknown";
  provider?: string;
  guidelineId?: string;
  guidelineVersion?: string;
  jurisdiction?: string;
};

export type VaccinationRecord = HealthRecordMeta & {
  vaccineName: string;
  diseaseTargets?: string[];
  doseNumberText?: string;
  date: IsoDate;
  provider?: string;
  lotNumber?: string;
  countryOrProgram?: string;
  nextDueDate?: IsoDate;
  documentId?: string;
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
  relatedConditionIds?: string[];
};

export type HealthDocumentMetadata = HealthRecordMeta & {
  title: string;
  kind: "prescription" | "lab" | "imaging" | "vaccination" | "visit-note" | "certificate" | "care-plan" | "other";
  documentDate?: IsoDate;
  localReference?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type SymptomEpisodeRecord = HealthRecordMeta & {
  startDateTime: IsoDateTime;
  endDateTime?: IsoDateTime;
  symptoms: string[];
  severity?: "mild" | "moderate" | "severe" | "unknown";
  temperatureC?: number;
  associatedNotes?: string;
  actionTakenText?: string;
  outcomeText?: string;
  soughtMedicalCare?: boolean;
};

export type InjuryEpisodeRecord = HealthRecordMeta & {
  occurredAt: IsoDateTime;
  activity?: string;
  bodyArea?: string;
  injuryType?: string;
  painLevel0to10?: number;
  headImpactConcern?: boolean;
  stoppedActivity?: boolean;
  medicalCareSought?: boolean;
  returnToActivityDate?: IsoDate;
  clinicianClearanceDocumentId?: string;
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
  flowText?: string;
  painLevel0to10?: number;
  symptoms?: string[];
  impactedSchoolOrActivity?: boolean;
  privateByDefault: true;
};

export type MentalWellbeingCheckIn = HealthRecordMeta & {
  date: IsoDate;
  mood?: "good" | "okay" | "low" | "very-low";
  stressLevel?: 0 | 1 | 2 | 3 | 4 | 5;
  sleepConcern?: boolean;
  schoolStress?: boolean;
  socialConcern?: boolean;
  supportNote?: string;
  privateByDefault: true;
};

export type SchoolFunctionCheckIn = HealthRecordMeta & {
  date: IsoDate;
  attendanceConcern?: boolean;
  concentrationConcern?: boolean;
  learningConcern?: boolean;
  fatigueConcern?: boolean;
  supportOrAccommodationText?: string;
};

export type SubstanceUseCheckIn = HealthRecordMeta & {
  date: IsoDate;
  nicotineOrVape?: "not-asked" | "none" | "past" | "current";
  alcohol?: "not-asked" | "none" | "past" | "current";
  otherSubstances?: "not-asked" | "none" | "past" | "current";
  screeningInstrumentId?: string;
  score?: number;
  helpRequested?: boolean;
  privateByDefault: true;
};

export type SocialProtectiveContextRecord = HealthRecordMeta & {
  date: IsoDate;
  trustedAdultAvailable?: boolean;
  feelsSafeAtHome?: boolean;
  feelsSafeAtSchool?: boolean;
  bullyingConcern?: boolean;
  careAccessBarrier?: boolean;
  foodAccessConcern?: boolean;
  noteText?: string;
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
  carePlanIds?: string[];
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
  understandsOwnPrivacyChoices: boolean;
  knowsWhereToGetRoutineCare: boolean;
  preparedForLivingAwayFromFamily: boolean;
};

export type FutureHealthRecordBundle = {
  schemaVersion: 2;
  vitalSigns: VitalSignRecord[];
  screenings: ScreeningResultRecord[];
  clinicalTests: ClinicalTestResultRecord[];
  conditions: ConditionRecord[];
  proceduresAndHospitalizations: ProcedureHospitalizationRecord[];
  familyHistory: FamilyHistoryRecord[];
  carePlans: CarePlanRecord[];
  medications: MedicationRecord[];
  medicationAdministrations: MedicationAdministrationRecord[];
  allergies: AllergyRecord[];
  preventiveCare: PreventiveCareRecord[];
  vaccinations: VaccinationRecord[];
  appointments: AppointmentRecord[];
  documents: HealthDocumentMetadata[];
  symptomEpisodes: SymptomEpisodeRecord[];
  injuryEpisodes: InjuryEpisodeRecord[];
  pubertyRecords: PubertyBodyChangeRecord[];
  menstrualCycles: MenstrualCycleRecord[];
  wellbeing: MentalWellbeingCheckIn[];
  schoolFunction: SchoolFunctionCheckIn[];
  substanceUse: SubstanceUseCheckIn[];
  socialContext: SocialProtectiveContextRecord[];
  safetyPlan?: SafetySupportPlan;
  emergencyCard?: EmergencyHealthCard;
  adultTransition?: AdultTransitionChecklist;
};

// Đây là data contract cho các lượt triển khai sâu sau này.
// Không đồng nghĩa các trường đang được thu thập, đồng bộ hoặc gửi sang Site Quản trị.
// Khi kích hoạt persistence phải có migration, privacy review, evidence review và regression gate riêng.
