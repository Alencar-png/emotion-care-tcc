// ========================
// Enums
// ========================

export enum UserRole {
  SUPER_ADMIN = "superAdmin",
  COMPANY_ADMIN = "companyAdmin",
  MEDICAL_TECHNICAL = "medicalTechnical",
  VIEWER = "viewer",
}

export enum OnboardingStatus {
  PENDING_SETUP = "pending_setup",
  WELCOME_COMPLETED = "welcome_completed",
  DEPARTMENTS_CONFIGURED = "departments_configured",
  EMPLOYEES_IMPORTED = "employees_imported",
  CALL_SCHEDULED = "call_scheduled",
  COMPLETED = "completed",
}

// ========================
// Auth
// ========================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  user_id: number;
  role: UserRole;
  company_id: number | null;
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    company_id: number | null;
  };
}

// ========================
// Pagination
// ========================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ========================
// Company
// ========================

export interface Company {
  id: number;
  name: string;
  trade_name: string | null;
  cnpj: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  responsible_name: string;
  responsible_email: string | null;
  responsible_phone: string | null;
  max_employees: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  onboarding_status?: string | null;
  onboarding_completed_at?: string | null;
  onboarding_current_step?: number | null;
  plan_type?: string | null;
}

export interface OnboardingStatusResponse {
  onboarding_status: string | null;
  onboarding_current_step: number;
  onboarding_completed_at: string | null;
  company_name: string;
  company_id: number;
  plan_type: string | null;
  must_change_password: boolean;
}

export interface CompanyCreate {
  name: string;
  trade_name?: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  responsible_name: string;
  responsible_email?: string;
  responsible_phone?: string;
  max_employees?: number;
}

export interface CompanyUpdate extends Partial<CompanyCreate> {
  is_active?: boolean;
}

// ========================
// Department
// ========================

export interface Department {
  id: number;
  name: string;
  description: string | null;
  company_id: number;
  is_active: boolean;
  created_at: string | null;
}

export interface DepartmentCreate {
  name: string;
  description?: string;
  company_id: number;
}

export interface DepartmentUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

// ========================
// JobRole
// ========================

export interface JobRole {
  id: number;
  title: string;
  description: string | null;
  company_id: number;
  is_active: boolean;
  created_at: string | null;
}

export interface JobRoleCreate {
  title: string;
  description?: string;
  company_id: number;
}

export interface JobRoleUpdate {
  title?: string;
  description?: string;
  is_active?: boolean;
}

// ========================
// Employee
// ========================

export interface Employee {
  id: number;
  name: string;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  company_id: number;
  department_id: number | null;
  job_role_id: number | null;
  location: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  department_name: string | null;
  job_role_title: string | null;
}

export interface EmployeeCreate {
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  company_id: number;
  department_id?: number;
  job_role_id?: number;
  location?: string;
}

export interface EmployeeUpdate {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  department_id?: number;
  job_role_id?: number;
  location?: string;
  is_active?: boolean;
}

// ========================
// Import
// ========================

export interface ImportPreviewRow {
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  phone?: string | null;
  department_name?: string | null;
  job_role_title?: string | null;
  location?: string | null;
  _valid?: boolean;
  [key: string]: string | null | boolean | undefined;
}

export interface ImportPreview {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: ImportPreviewRow[];
  errors: { row: number; error: string }[];
}

export interface ImportRow {
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  department_name?: string;
  job_role_title?: string;
  location?: string;
}

// ========================
// License
// ========================

export interface LicenseInfo {
  company_id: number;
  company_name: string;
  max_employees: number;
  current_employees: number;
  remaining: number;
  is_at_limit: boolean;
}

// ========================
// User
// ========================

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  company_id: number | null;
  company_name?: string | null;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  company_id?: number | null;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  company_id?: number | null;
}

// ========================
// Questionnaires
// ========================

export enum Periodicity {
  ANNUAL = "annual",
  SEMIANNUAL = "semiannual",
  QUARTERLY = "quarterly",
  MONTHLY = "monthly",
}

export enum QuestionnaireStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export enum CustomQuestionType {
  OPEN_TEXT = "open_text",
  MULTIPLE_CHOICE = "multiple_choice",
  SINGLE_CHOICE = "single_choice",
  LIKERT_SCALE = "likert_scale",
}

export interface Instrument {
  id: number;
  code: string;
  name: string;
  description: string | null;
  version: string | null;
  is_active: boolean;
  created_at: string | null;
  dimension_count?: number;
  question_count?: number;
}

export interface Question {
  id: number;
  code: string;
  text: string;
  scale_type: string;
  scale_labels: Array<string | { value: number; label: string }> | null;
  display_order: number;
  is_reverse_scored: boolean;
}

export interface Dimension {
  id: number;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  questions?: Question[];
  question_count?: number;
}

export interface CustomQuestion {
  id: number;
  text: string;
  question_type: string;
  options: string[] | null;
  display_order: number;
  is_required: boolean;
}

export interface CustomQuestionCreate {
  text: string;
  question_type?: string;
  options?: string[] | null;
  display_order?: number;
  is_required?: boolean;
}

export interface QuestionnaireConfig {
  id: number;
  company_id: number;
  instrument_id: number;
  name: string;
  description: string | null;
  periodicity: string;
  status: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  instrument_name?: string | null;
  dimension_count?: number;
  custom_question_count?: number;
}

export interface QuestionnaireConfigCreate {
  company_id: number;
  instrument_id: number;
  name: string;
  description?: string;
  periodicity?: string;
  dimension_ids: number[];
  custom_questions: CustomQuestionCreate[];
}

export interface QuestionnaireConfigUpdate {
  name?: string;
  description?: string;
  periodicity?: string;
  status?: string;
  dimension_ids?: number[];
  custom_questions?: CustomQuestionCreate[];
  is_active?: boolean;
}

export interface QuestionnaireConfigDetail extends QuestionnaireConfig {
  selected_dimensions: Dimension[];
  custom_questions: CustomQuestion[];
}

export interface QuestionnairePreview {
  config_id: number;
  config_name: string;
  instrument_name: string;
  periodicity: string;
  total_questions: number;
  dimensions: Array<{
    name: string;
    description: string | null;
    questions: Array<{
      code: string | null;
      text: string;
      scale_type: string | null;
      scale_labels: Array<string | { value: number; label: string }> | null;
      is_custom: boolean;
      question_type?: string | null;
      options?: string[] | null;
      is_required: boolean;
    }>;
  }>;
  custom_questions: Array<{
    code: string | null;
    text: string;
    scale_type: string | null;
    scale_labels: Array<string | { value: number; label: string }> | null;
    is_custom: boolean;
    question_type?: string | null;
    options?: string[] | null;
    is_required: boolean;
  }>;
}

// ========================
// Campaigns
// ========================

export enum CampaignStatus {
  DRAFT = "draft",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum ChannelType {
  EMAIL = "email",
  SMS = "sms",
  LINK = "link",
}

export enum ParticipantStatus {
  PENDING = "pending",
  SENT = "sent",
  OPENED = "opened",
  STARTED = "started",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export interface Campaign {
  id: number;
  company_id: number;
  config_id: number;
  created_by: number;
  name: string;
  description: string | null;
  start_date: string | null;
  deadline: string | null;
  status: string;
  channels: string[];
  auto_resend_enabled: boolean;
  auto_resend_interval_days: number | null;
  anonymization_threshold: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  config_name?: string | null;
  total_participants?: number;
  total_responses?: number;
  response_rate?: number;
}

export interface CampaignCreate {
  company_id: number;
  config_id: number;
  name: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  channels?: string[];
  employee_ids: number[];
  auto_resend_enabled?: boolean;
  auto_resend_interval_days?: number;
  anonymization_threshold?: number;
}

export interface CampaignUpdate {
  name?: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  status?: string;
  channels?: string[];
  employee_ids?: number[];
  auto_resend_enabled?: boolean;
  auto_resend_interval_days?: number;
  anonymization_threshold?: number;
  is_active?: boolean;
}

export interface CampaignParticipant {
  id: number;
  campaign_id: number;
  employee_id: number;
  token: string;
  status: string;
  channel: string | null;
  sent_at: string | null;
  opened_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  resend_count: number;
  employee_name?: string | null;
  employee_email?: string | null;
  employee_department?: string | null;
}

export interface CampaignDetail extends Campaign {
  instrument_name?: string | null;
  participants: CampaignParticipant[];
  status_counts?: Record<string, number>;
}

export interface CampaignSendRequest {
  channel: string;
  participant_ids?: number[] | null;
}

export interface CampaignSendResponse {
  campaign_id: number;
  channel: string;
  total_sent: number;
  total_failed: number;
  details: Array<Record<string, unknown>>;
}

// ========================
// Responses
// ========================

export interface Response {
  id: number;
  campaign_id: number;
  participant_id: number;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
}

export interface ResponseAnswer {
  id: number;
  response_id: number;
  question_id: number | null;
  custom_question_id: number | null;
  numeric_value: number | null;
  text_value: string | null;
}

export interface PublicQuestionnaireInfo {
  campaign_name: string;
  company_name: string;
  instrument_name: string;
  total_dimensions: number;
  total_questions: number;
  deadline: string | null;
  is_expired: boolean;
  is_already_completed: boolean;
}

export interface PublicQuestionnaireForm {
  campaign_name: string;
  company_name: string;
  instrument_name: string;
  deadline: string | null;
  dimensions: Array<{
    dimension_id: number;
    name: string;
    description: string | null;
    questions: Array<{
      id: number;
      code: string;
      text: string;
      scale_type: string;
      scale_labels: Array<{ value: number; label: string }> | null;
      is_reverse_scored: boolean;
    }>;
  }>;
  custom_questions: Array<{
    id: number;
    text: string;
    question_type: string;
    options: string[] | null;
    is_required: boolean;
  }>;
  total_questions: number;
}

export interface AnswerSubmit {
  question_id?: number | null;
  custom_question_id?: number | null;
  numeric_value?: number | null;
  text_value?: string | null;
}

export interface ResponseSubmit {
  answers: AnswerSubmit[];
  is_complete?: boolean;
}

// ========================
// Admin Responses
// ========================

export interface AdminResponseListItem {
  id: number;
  campaign_id: number;
  campaign_name: string | null;
  participant_id: number;
  employee_name: string | null;
  employee_email: string | null;
  department_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
  total_answers: number;
}

export interface AdminResponseAnswer {
  id: number;
  question_id: number | null;
  custom_question_id: number | null;
  numeric_value: number | null;
  text_value: string | null;
  question_text: string | null;
  question_code: string | null;
  dimension_name: string | null;
  scale_type: string | null;
  scale_labels: Array<{ value: number; label: string }> | null;
  is_reverse_scored: boolean;
  is_custom: boolean;
  question_type: string | null;
  options: string[] | null;
}

export interface AdminResponseDetail {
  id: number;
  campaign_id: number;
  campaign_name: string | null;
  config_name: string | null;
  instrument_name: string | null;
  participant_id: number;
  employee_name: string | null;
  employee_email: string | null;
  department_name: string | null;
  job_role_title: string | null;
  started_at: string | null;
  completed_at: string | null;
  is_complete: boolean;
  total_answers: number;
  answers: AdminResponseAnswer[];
  company_id: number | null;
}

export interface CampaignFilterItem {
  id: number;
  name: string;
  status: string;
}

// ========================
// Analytics
// ========================

export enum RiskLevel {
  HEALTHY = "healthy",
  INTERMEDIATE = "intermediate",
  RISK = "risk",
}

export interface DimensionResult {
  dimension_id: number;
  dimension_name: string;
  dimension_code: string;
  average_score: number;
  risk_level: string;
  response_count: number;
}

export interface SectorDimensionResult {
  department_id: number;
  department_name: string;
  dimension_id: number;
  dimension_name: string;
  average_score: number;
  risk_level: string;
  response_count: number;
  is_anonymized: boolean;
}

export interface SectorSummary {
  department_id: number;
  department_name: string;
  average_score: number;
  risk_level: string;
  response_count: number;
  dimension_count: number;
  is_sector_restricted?: boolean;
}

export interface AnonymityThresholds {
  score_min: number;
  sector_min: number;
}

export interface CampaignResult {
  id: number;
  campaign_id: number;
  company_id: number;
  computed_at: string | null;
  total_invited: number;
  total_responses: number;
  response_rate: number;
  overall_risk_score: number;
  risk_level: string;
  is_score_restricted?: boolean;
  dimension_results: DimensionResult[];
  sector_summaries: SectorSummary[];
  anonymity_thresholds?: AnonymityThresholds;
}

export interface AnalyticsSummary {
  company_id: number;
  company_name: string;
  total_campaigns: number;
  total_completed_campaigns: number;
  latest_campaign_id: number | null;
  latest_campaign_name: string | null;
  latest_risk_score: number | null;
  latest_risk_level: string | null;
  latest_response_rate: number | null;
  latest_dimension_results: DimensionResult[];
  latest_sector_summaries: SectorSummary[];
  campaign_history: Array<{
    campaign_id: number;
    campaign_name: string;
    computed_at: string;
    overall_risk_score: number;
    risk_level: string;
    response_rate: number;
    total_responses: number;
    total_invited: number;
  }>;
  response_timeline: Array<{
    hour: string;
    responses: number;
    rate: number;
  }>;
  is_score_restricted?: boolean;
  total_responses?: number;
  anonymity_thresholds?: AnonymityThresholds;
}

// Dashboard Summary
export interface DashboardDepartment {
  department_id: number;
  department_name: string;
  risk_level: string;
  average_score: number;
  total_employees: number;
  evaluated_employees: number;
  is_sector_restricted?: boolean;
}

export interface DashboardActiveCampaign {
  campaign_id: number;
  name: string;
  start_date: string | null;
  deadline: string | null;
  total_invited: number;
  total_responded: number;
  response_rate_by_department: Array<{
    department_name: string;
    rate: number;
  }>;
}

export interface DashboardCriticalDimension {
  dimension_name: string;
  score: number;
  risk_level: string;
}

export interface DashboardSummary {
  company_id: number;
  company_name: string;
  company_cnpj: string;
  overall_risk_level: string | null;
  overall_risk_score: number | null;
  total_employees: number;
  evaluated_employees: number;
  last_evaluation_date: string | null;
  departments: DashboardDepartment[];
  active_campaign: DashboardActiveCampaign | null;
  critical_dimensions: DashboardCriticalDimension[];
  intermediate_dimensions: DashboardCriticalDimension[];
  job_roles: Array<{
    job_role_id: number;
    job_role_title: string;
    average_score: number;
    risk_level: string;
    evaluated_employees: number;
    total_employees: number;
    is_sector_restricted?: boolean;
  }>;
  total_campaigns: number;
  completed_campaigns: number;
  is_score_restricted?: boolean;
  total_responses?: number;
  anonymity_thresholds?: AnonymityThresholds;
}

// ========================
// Módulo 06/07 — PGR
// ========================

export enum ActionPlanStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export interface PGRRisk {
  id: number;
  company_id: number;
  campaign_id: number;
  dimension_id: number;
  risk_axis: string;
  source: string | null;
  possible_damages: string | null;
  severity: number;
  probability: number;
  risk_level: string;
  control_measures: string | null;
  average_score: number;
  original_risk_level: string;
  created_at: string | null;
}

export interface ActionPlan {
  id: number;
  pgr_risk_id: number;
  measure: string;
  responsible_person: string | null;
  deadline: string | null;
  status: string;
  classification: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  risk_axis?: string;
  original_risk_level?: string;
  average_score?: number;
  evidences_count?: number;
  // Campos 5W2H (NC_ACTION_EDIT)
  what_action?: string | null;
  why_action?: string | null;
  who_responsible?: string | null;
  where_action?: string | null;
  when_action?: string | null;
  how_action?: string | null;
  how_much?: string | null;
  indicator?: string | null;
  last_edited_by?: number | null;
  last_edited_at?: string | null;
  editor_name?: string | null;
}

export interface ActionPlanUpdate {
  measure?: string;
  responsible_person?: string;
  deadline?: string;
  status?: string;
  classification?: string;
  notes?: string;
}

export interface ActionPlan5W2HUpdate {
  measure?: string;
  responsible_person?: string;
  deadline?: string;
  status?: string;
  classification?: string;
  notes?: string;
  what_action?: string;
  why_action?: string;
  who_responsible?: string;
  where_action?: string;
  when_action?: string;
  how_action?: string;
  how_much?: string;
  indicator?: string;
}

export interface ActionPlanVersion {
  id: number;
  action_plan_id: number;
  version_type: string;
  data_json: Record<string, unknown>;
  edited_by: number | null;
  edited_at: string | null;
  notes: string | null;
  editor_name: string | null;
}

export interface ActionEvidence {
  id: number;
  action_plan_id: number;
  file_name: string;
  file_path: string;
  uploaded_by: number | null;
  uploaded_at: string;
  description: string | null;
  uploader_name?: string;
}

export interface PGRVersion {
  id: number;
  company_id: number;
  campaign_id: number;
  version_number: number;
  generated_at: string;
  generated_by: number | null;
  pdf_path: string | null;
  notes: string | null;
  generator_name?: string;
  campaign_name?: string;
  // NC_PGR_FILTER: campos granulares
  granular_mode?: string | null;
  group_name?: string | null;
}

// NC_PGR_FILTER: tipos para PGR Granular
export type GranularMode = "sector" | "location" | "activity";

export interface GranularGroup {
  group_key: string;
  group_name: string;
  respondent_count: number;
  eligible: boolean;
}

export interface GranularPreviewResponse {
  granular_mode: GranularMode;
  mode_label: string;
  total_groups: number;
  eligible_groups: number;
  ineligible_groups: number;
  groups: GranularGroup[];
}

export interface GranularGeneratedVersion {
  version_id: number;
  version_number: number;
  group_name: string;
  group_key: string;
  respondent_count: number;
  total_dimensions_at_risk: number;
  granular_mode: GranularMode;
}

export interface GranularGenerateResponse {
  message: string;
  granular_mode: GranularMode;
  mode_label: string;
  generated: GranularGeneratedVersion[];
  skipped_warnings: string[];
}

export interface PGROverview {
  company_id: number;
  latest_campaign_id: number | null;
  latest_campaign_name: string | null;
  total_risks: number;
  critical_risks: number;
  action_plans_total: number;
  action_plans_completed: number;
  action_plans_in_progress: number;
  action_plans_pending: number;
  action_plans_overdue: number;
  latest_version: PGRVersion | null;
  completion_percentage: number;
}

export interface DimensionDelta {
  dimension_id: number;
  dimension_name: string;
  score_a: number;
  score_b: number;
  delta: number;
  risk_level_a: string;
  risk_level_b: string;
}

export interface SectorDelta {
  department_id: number;
  department_name: string;
  score_a: number;
  score_b: number;
  delta: number;
}

export interface CampaignComparison {
  campaign_a: { id: number; name: string; computed_at: string };
  campaign_b: { id: number; name: string; computed_at: string };
  dimension_deltas: DimensionDelta[];
  sector_deltas: SectorDelta[];
  overall_delta: { score_a: number; score_b: number; delta: number };
}
