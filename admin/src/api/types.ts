/** The panel API's answers, as `back/app/panel/schemas/` describes them. The API owns this contract. */

export type ApplicationStatus = 'new' | 'contacted' | 'approved' | 'declined';
export type RoleName = 'viewer' | 'coordinator' | 'admin';

export type Permission =
  | 'dashboard:read'
  | 'applications:read'
  | 'applications:update'
  | 'applications:export'
  | 'applications:delete'
  | 'courses:read'
  | 'courses:write'
  | 'content:manage'
  | 'audit:read'
  | 'users:read';

// --- session

export interface AdminProfile {
  email: string;
  display_name: string;
  role: RoleName;
  permissions: Permission[];
}

export interface Session {
  admin: AdminProfile;
  csrf_token: string;
  idle_timeout_seconds: number;
}

export interface SignInRequest {
  email: string;
  password: string;
  code: string;
}

// --- applications

export interface Child {
  name: string;
  birth_date: string;
  age_at_course_start: number;
  within_age_range: boolean;
}

export interface CourseReference {
  id: string;
  title: string;
  start_date: string;
}

export interface ApplicationSummary {
  id: string;
  created_at: string;
  status: ApplicationStatus;
  parent_name: string;
  phone: string;
  languages: string[];
  children: Child[];
  course: CourseReference;
  notes_count: number;
}

export interface Note {
  id: string;
  body: string;
  created_at: string;
  author: string | null;
}

export interface ApplicationDetail extends ApplicationSummary {
  status_changed_at: string | null;
  consent_given_at: string | null;
  privacy_notice_version: string | null;
  notes: Note[];
}

export interface ApplicationFilter {
  search?: string | null;
  statuses?: ApplicationStatus[];
  course_id?: string | null;
  language?: string | null;
  created_from?: string | null;
  created_to?: string | null;
}

export interface ApplicationSearch extends ApplicationFilter {
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface ApplicationPage {
  items: ApplicationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface Pulse {
  applications_total: number;
  new_applications: number;
  latest_application_at: string | null;
}

// --- courses

export interface StatusCounts {
  new: number;
  contacted: number;
  approved: number;
  declined: number;
}

export interface Seats {
  capacity: number;
  approved_children: number;
  free_seats: number;
  applications: StatusCounts;
}

export interface Course {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  schedule: string;
  location: string;
  age_min: number;
  age_max: number;
  price_minor: number;
  second_child_price_minor: number;
  currency: string;
  capacity: number;
  registration_open: boolean;
  accepting_applications: boolean;
  seats: Seats;
  created_at: string;
  updated_at: string;
}

export interface CoursePage {
  items: Course[];
  total: number;
  limit: number;
  offset: number;
}

export interface CourseInput {
  title: string;
  start_date: string;
  end_date: string | null;
  schedule: string;
  location: string;
  age_min: number;
  age_max: number;
  price_minor: number;
  second_child_price_minor: number;
  capacity: number;
  registration_open: boolean;
}

export type CourseChanges = Partial<CourseInput>;

// --- dashboard

export interface DashboardTotals {
  applications: number;
  by_status: StatusCounts;
  approved_children: number;
  free_seats: number;
}

export interface DailyCount {
  day: string;
  applications: number;
}

export interface Dashboard {
  generated_at: string;
  totals: DashboardTotals;
  courses: Course[];
  latest_applications: ApplicationSummary[];
  dynamics: DailyCount[];
}

// --- the landing page's content

export type FieldKind = 'text' | 'paragraph' | 'link' | 'phone' | 'digits' | 'image' | 'strings' | 'list';

/** One item of a list: its parts by name, each a line, a paragraph or a list of lines. */
export type ItemValue = Record<string, string | string[]>;

/** What a place holds: a line, a list of lines, or a list of items made of named parts. */
export type ContentValue = string | string[] | ItemValue[] | null;

export interface ItemField {
  name: string;
  label: string;
  kind: FieldKind;
  max_length: number;
  max_items: number | null;
}

export interface ContentField {
  key: string;
  section: string;
  label: string;
  kind: FieldKind;
  max_length: number | null;
  min_items: number;
  max_items: number | null;
  item: ItemField[];
  default: ContentValue;
  draft: ContentValue;
  published: ContentValue;
  changed: boolean;
}

export interface ContentSection {
  id: string;
  label: string;
}

export interface Publication {
  version: number;
  published_at: string;
  published_by: string | null;
}

export interface Content {
  sections: ContentSection[];
  fields: ContentField[];
  placeholders: string[];
  has_unpublished_changes: boolean;
  publication: Publication | null;
}

export interface MediaAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
}

// --- staff

export interface StaffMember {
  id: string;
  email: string;
  display_name: string;
  role: RoleName;
  is_active: boolean;
  last_login_at: string | null;
}

export interface StaffList {
  items: StaffMember[];
  total: number;
}
