import type {
  AdminProfile,
  ApplicationDetail,
  ApplicationStatus,
  Content,
  ContentField,
  Course,
  Permission,
  RoleName,
  StaffMember,
} from '../api/types.ts';

/** Obviously fake people and a fake programme: nothing here is, or looks like, a real family. */

export const ALL_PERMISSIONS: Permission[] = [
  'applications:delete',
  'applications:export',
  'applications:read',
  'applications:update',
  'audit:read',
  'content:manage',
  'courses:read',
  'courses:write',
  'dashboard:read',
  'users:read',
];

const VIEWER: Permission[] = ['applications:read', 'courses:read', 'dashboard:read'];

/** What each role may do, as `back/app/panel/permissions.py` says. */
export const PERMISSIONS: Record<RoleName, Permission[]> = {
  viewer: VIEWER,
  coordinator: [...VIEWER, 'applications:update'],
  admin: ALL_PERMISSIONS,
};

export function profile(role: RoleName = 'admin'): AdminProfile {
  return {
    email: `${role}@example.test`,
    display_name:
      role === 'admin' ? 'Test Admin' : role === 'coordinator' ? 'Test Menecer' : 'Test Müşahidəçi',
    role,
    permissions: PERMISSIONS[role],
  };
}

/** 2026-10-18 15:30 in Baku. */
export const NOW = '2026-10-18T11:30:00Z';

export function ago(hours: number): string {
  return new Date(new Date(NOW).getTime() - hours * 3_600_000).toISOString();
}

export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    title: '5 dekabr 2026 – 10 yanvar 2027',
    start_date: '2026-12-05',
    end_date: '2027-01-10',
    schedule: 'Şənbə, 09:30–13:00',
    location: 'Bakı',
    age_min: 8,
    age_max: 13,
    price_minor: 65_000,
    second_child_price_minor: 50_000,
    currency: 'AZN',
    capacity: 20,
    registration_open: true,
    accepting_applications: true,
    seats: {
      capacity: 20,
      approved_children: 0,
      free_seats: 20,
      applications: { new: 0, contacted: 0, approved: 0, declined: 0 },
    },
    created_at: ago(1000),
    updated_at: ago(1000),
    ...overrides,
  };
}

export function makeApplication(
  id: string,
  overrides: Partial<ApplicationDetail> = {},
  courseId = 'course-1',
  courseTitle = '5 dekabr 2026 – 10 yanvar 2027',
): ApplicationDetail {
  return {
    id,
    created_at: ago(5),
    status: 'new',
    parent_name: `Valideyn ${id}`,
    phone: '+994 50 123 45 67',
    languages: ['Azərbaycan'],
    children: [
      { name: `Uşaq ${id}`, birth_date: '2016-03-14', age_at_course_start: 10, within_age_range: true },
    ],
    course: { id: courseId, title: courseTitle, start_date: '2026-12-05' },
    notes_count: 0,
    status_changed_at: null,
    consent_given_at: ago(5),
    privacy_notice_version: '2026-10-19',
    notes: [],
    ...overrides,
  };
}

export function applicationsOf(statuses: ApplicationStatus[]): ApplicationDetail[] {
  return statuses.map((status, index) =>
    makeApplication(`app-${index + 1}`, {
      status,
      parent_name: [
        'Aysel Test',
        'Leyla Nümunə',
        'Günel Sınaq',
        'Nigar Fake',
        'Fidan Demo',
        'Sevinc Test',
        'Lalə Nümunə',
        'Aynur Demo',
      ][index % 8],
      created_at: ago(5 + index * 24),
      children: [
        {
          name: [
            'Murad Test',
            'Ayan Nümunə',
            'Emil Sınaq',
            'Nərgiz Fake',
            'Kənan Demo',
            'Sara Test',
            'Elnur Nümunə',
            'Aylin Demo',
          ][index % 8] as string,
          birth_date: '2016-03-14',
          age_at_course_start: 10,
          within_age_range: true,
        },
      ],
    }),
  );
}

export function makeStaff(): StaffMember[] {
  return [
    {
      id: 'staff-1',
      email: 'admin@example.test',
      display_name: 'Test Admin',
      role: 'admin',
      is_active: true,
      last_login_at: ago(1),
    },
    {
      id: 'staff-2',
      email: 'menecer@example.test',
      display_name: 'Test Menecer',
      role: 'coordinator',
      is_active: true,
      last_login_at: ago(30),
    },
    {
      id: 'staff-3',
      email: 'baxan@example.test',
      display_name: 'Test Baxan',
      role: 'viewer',
      is_active: false,
      last_login_at: null,
    },
  ];
}

const field = (
  partial: Partial<ContentField> & Pick<ContentField, 'key' | 'section' | 'label' | 'kind'>,
): ContentField => ({
  max_length: null,
  min_items: 0,
  max_items: null,
  item: [],
  default: null,
  draft: null,
  published: null,
  changed: false,
  ...partial,
});

export function makeContent(): Content {
  return {
    sections: [
      { id: 'hero', label: 'Əsas bölmə' },
      { id: 'demo_day', label: 'Demo Day' },
      { id: 'faq', label: 'Tez-tez verilən suallar' },
      { id: 'founder', label: 'Qurucu' },
    ],
    fields: [
      field({
        key: 'hero.title_first',
        section: 'hero',
        label: 'Başlıq, 1-ci sətir',
        kind: 'text',
        max_length: 80,
        default: 'Kiçik ideyalar.',
      }),
      field({
        key: 'hero.subtitle',
        section: 'hero',
        label: 'Alt başlıq',
        kind: 'paragraph',
        max_length: 400,
        default: '{age_min}–{age_max} yaşlı uşaqlar üçün praktiki sahibkarlıq proqramı.',
      }),
      field({
        key: 'hero.primary_cta',
        section: 'hero',
        label: 'Əsas düymənin yazısı',
        kind: 'text',
        max_length: 40,
        default: 'Müraciət et',
      }),
      field({
        key: 'demo_day.items',
        section: 'demo_day',
        label: 'Demo Day-də nə olacaq',
        kind: 'strings',
        min_items: 1,
        max_items: 3,
        max_length: 100,
        default: ['Məhsul nümunəsi', 'Yekun təqdimat'],
      }),
      field({
        key: 'faq.items',
        section: 'faq',
        label: 'Suallar',
        kind: 'list',
        min_items: 1,
        max_items: 3,
        item: [
          { name: 'q', label: 'Sual', kind: 'text', max_length: 120, max_items: null },
          { name: 'a', label: 'Cavab', kind: 'paragraph', max_length: 300, max_items: null },
        ],
        default: [{ q: 'Qiymətə nələr daxildir?', a: 'Materiallar və sertifikat.' }],
      }),
      field({
        key: 'founder.photo',
        section: 'founder',
        label: 'Şəkil',
        kind: 'image',
        default: '/assets/babek.jpeg',
      }),
    ],
    placeholders: ['age_max', 'age_min', 'price'],
    has_unpublished_changes: false,
    publication: null,
  };
}
