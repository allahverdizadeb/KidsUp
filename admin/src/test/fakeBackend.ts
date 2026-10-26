import type {
  ApplicationDetail,
  ApplicationSearch,
  ApplicationStatus,
  ApplicationSummary,
  Content,
  ContentField,
  ContentValue,
  Course,
  Permission,
  Publication,
  RoleName,
  Seats,
  Session,
  StaffMember,
} from '../api/types.ts';
import {
  NOW,
  PERMISSIONS,
  ago,
  applicationsOf,
  makeContent,
  makeCourse,
  makeStaff,
  profile,
} from './fixtures.ts';

export const PASSWORD = 'correct horse battery staple';
export const CODE = '123456';
const CSRF = 'csrf-token-for-tests';
const BASE = '/api/admin';

export interface Recorded {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

interface Answer {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: string;
}

interface Failure {
  method: string;
  path: RegExp;
  status: number;
  body: unknown;
  times: number;
}

export interface FakeOptions {
  role?: RoleName;
  signedIn?: boolean;
  applications?: ApplicationDetail[];
  courses?: Course[];
  content?: Content;
  staff?: StaffMember[];
  /** What the API says the idle time of a session is (it says 900). */
  idleSeconds?: number;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The panel's API as far as the screens use it, kept in memory: sessions, applications with the seats of their
 * courses, courses, the page's content with its draft and publications, pictures and staff. It applies the same
 * rules the real one does where a screen depends on them (the CSRF token, the roles, the seats), so a screen is
 * tested against behaviour and not against canned answers.
 */
export class FakeBackend {
  role: RoleName;
  signedIn: boolean;
  applications: ApplicationDetail[];
  courses: Course[];
  content: Content;
  staff: StaffMember[];
  idleSeconds: number;
  requests: Recorded[] = [];
  private failures: Failure[] = [];
  private nextCourse = 2;
  private nextPicture = 1;
  private nextNote = 1;
  private version = 0;
  private published = new Map<string, ContentValue>();

  constructor(options: FakeOptions = {}) {
    this.role = options.role ?? 'admin';
    this.signedIn = options.signedIn ?? true;
    this.applications =
      options.applications ?? applicationsOf(['new', 'new', 'contacted', 'approved', 'declined']);
    this.courses = options.courses ?? [makeCourse()];
    this.content = options.content ?? makeContent();
    this.staff = options.staff ?? makeStaff();
    this.idleSeconds = options.idleSeconds ?? 900;
  }

  // --- the browser's fetch

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries((init.headers ?? {}) as Record<string, string>)) {
      headers[name.toLowerCase()] = value;
    }
    const path = url.startsWith(BASE) ? url.slice(BASE.length) : url;
    let body: unknown = init.body ?? undefined;
    if (typeof init.body === 'string') body = JSON.parse(init.body);
    this.requests.push({ method, path, body, headers });

    const answer = this.answer(method, path, body, headers);
    if (answer.status === 204) return new Response(null, { status: 204 });
    return new Response(answer.raw ?? JSON.stringify(answer.body ?? {}), {
      status: answer.status,
      headers: { 'Content-Type': answer.raw ? 'text/csv' : 'application/json', ...answer.headers },
    });
  };

  /** The next `times` requests matching are refused with this answer. */
  failNext(method: string, path: RegExp | string, status: number, body: unknown = {}, times = 1): void {
    const pattern =
      typeof path === 'string' ? new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : path;
    this.failures.push({ method: method.toUpperCase(), path: pattern, status, body, times });
  }

  called(method: string, path: RegExp | string): Recorded[] {
    return this.requests.filter(
      (request) =>
        request.method === method.toUpperCase() &&
        (typeof path === 'string' ? request.path === path : path.test(request.path)),
    );
  }

  // --- helpers the tests use

  application(id: string): ApplicationDetail {
    const found = this.applications.find((application) => application.id === id);
    if (!found) throw new Error(`no application ${id}`);
    return found;
  }

  course(id = 'course-1'): Course {
    return this.withSeats(this.courses.find((course) => course.id === id) as Course);
  }

  field(key: string): ContentField {
    return this.content.fields.find((candidate) => candidate.key === key) as ContentField;
  }

  // --- the rules

  private session(): Session {
    return { admin: profile(this.role), csrf_token: CSRF, idle_timeout_seconds: this.idleSeconds };
  }

  private may(permission: Permission): boolean {
    return PERMISSIONS[this.role].includes(permission);
  }

  private withSeats(course: Course): Course {
    const mine = this.applications.filter((application) => application.course.id === course.id);
    const count = (status: ApplicationStatus) =>
      mine.filter((application) => application.status === status).length;
    const approved = mine
      .filter((application) => application.status === 'approved')
      .reduce((sum, application) => sum + application.children.length, 0);
    const seats: Seats = {
      capacity: course.capacity,
      approved_children: approved,
      free_seats: Math.max(0, course.capacity - approved),
      applications: {
        new: count('new'),
        contacted: count('contacted'),
        approved: count('approved'),
        declined: count('declined'),
      },
    };
    return { ...course, seats, accepting_applications: course.registration_open && seats.free_seats > 0 };
  }

  private summary(application: ApplicationDetail): ApplicationSummary {
    return {
      id: application.id,
      created_at: application.created_at,
      status: application.status,
      parent_name: application.parent_name,
      phone: application.phone,
      languages: application.languages,
      children: application.children,
      course: application.course,
      notes_count: application.notes.length,
    };
  }

  private fieldFor(key: string): ContentField | undefined {
    return this.content.fields.find((candidate) => candidate.key === key);
  }

  private describeContent(): Content {
    const fields = this.content.fields.map((field) => {
      const published = this.published.get(field.key) ?? null;
      return { ...field, published, changed: !same(field.draft, published) };
    });
    return {
      ...this.content,
      fields,
      has_unpublished_changes: fields.some((field) => field.changed),
    };
  }

  private answer(method: string, target: string, body: unknown, headers: Record<string, string>): Answer {
    const [path = '', query = ''] = target.split('?');
    const failure = this.failures.find(
      (candidate) => candidate.method === method && candidate.path.test(target),
    );
    if (failure) {
      failure.times -= 1;
      if (failure.times <= 0) this.failures = this.failures.filter((candidate) => candidate !== failure);
      return { status: failure.status, body: failure.body };
    }

    if (method === 'POST' && path === '/sessions') {
      const attempt = body as { email: string; password: string; code: string };
      if (
        attempt.email !== profile(this.role).email ||
        attempt.password !== PASSWORD ||
        attempt.code !== CODE
      ) {
        return {
          status: 401,
          body: { detail: 'The e-mail, the password or the code is wrong.', code: 'invalid_credentials' },
        };
      }
      this.signedIn = true;
      return { status: 201, body: this.session() };
    }
    if (!this.signedIn)
      return { status: 401, body: { detail: 'Not authenticated.', code: 'not_authenticated' } };
    if (method === 'GET' && path === '/sessions/current') return { status: 200, body: this.session() };
    if (method === 'DELETE' && path === '/sessions/current') {
      this.signedIn = false;
      return { status: 204 };
    }
    if (method !== 'GET' && headers['x-csrf-token'] !== CSRF) {
      return { status: 403, body: { detail: 'Missing or wrong CSRF token.', code: 'csrf_failed' } };
    }
    const refused: Answer = { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };

    if (method === 'GET' && path.startsWith('/dashboard')) {
      return this.may('dashboard:read') ? this.dashboard() : refused;
    }
    if (path.startsWith('/applications')) {
      if (!this.may('applications:read')) return refused;
      return this.applicationsRoute(method, path, body, query);
    }
    if (path.startsWith('/courses')) return this.coursesRoute(method, path, body, refused);
    if (path.startsWith('/content') || path.startsWith('/media')) {
      if (!this.may('content:manage')) return refused;
      return this.contentRoute(method, path, body, headers);
    }
    if (method === 'GET' && path === '/users') {
      return this.may('users:read')
        ? { status: 200, body: { items: this.staff, total: this.staff.length } }
        : refused;
    }
    return { status: 404, body: { detail: 'Not found.' } };
  }

  private dashboard(): Answer {
    const courses = this.courses.map((course) => this.withSeats(course));
    const byStatus = { new: 0, contacted: 0, approved: 0, declined: 0 };
    for (const application of this.applications) byStatus[application.status] += 1;
    const newest = [...this.applications]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 7);
    const today = new Date(NOW);
    const dynamics = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(today.getTime() - (29 - index) * 86_400_000).toISOString().slice(0, 10);
      const applications = this.applications.filter(
        (application) => application.created_at.slice(0, 10) === day,
      ).length;
      return { day, applications };
    });
    return {
      status: 200,
      body: {
        generated_at: NOW,
        totals: {
          applications: this.applications.length,
          by_status: byStatus,
          approved_children: courses.reduce((sum, course) => sum + course.seats.approved_children, 0),
          free_seats: courses
            .filter((course) => course.registration_open)
            .reduce((sum, course) => sum + course.seats.free_seats, 0),
        },
        courses,
        latest_applications: newest.map((application) => this.summary(application)),
        dynamics,
      },
    };
  }

  private applicationsRoute(method: string, path: string, body: unknown, query: string): Answer {
    if (method === 'GET' && path === '/applications/pulse') {
      const newest = [...this.applications].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        status: 200,
        body: {
          applications_total: this.applications.length,
          new_applications: this.applications.filter((application) => application.status === 'new').length,
          latest_application_at: newest?.created_at ?? null,
        },
      };
    }
    if (method === 'POST' && path === '/applications/search')
      return { status: 200, body: this.search(body as ApplicationSearch) };
    if (method === 'POST' && path === '/applications/export') {
      if (!this.may('applications:export'))
        return { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };
      const rows = this.filtered(body as ApplicationSearch).map(
        (application) => `${application.id};${application.status}`,
      );
      return {
        status: 200,
        raw: ['id;status', ...rows].join('\n'),
        headers: { 'Content-Disposition': 'attachment; filename="muracietler-2026-10-18.csv"' },
      };
    }
    const match = /^\/applications\/([^/]+)(?:\/notes(?:\/([^/]+))?)?$/.exec(path);
    if (!match) return { status: 404, body: { detail: 'Not found.' } };
    const application = this.applications.find((candidate) => candidate.id === match[1]);
    if (!application)
      return { status: 404, body: { detail: 'No such application.', code: 'application_not_found' } };

    if (path.endsWith('/notes') && method === 'POST') {
      if (!this.may('applications:update'))
        return { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };
      const note = {
        id: `note-${this.nextNote++}`,
        body: (body as { body: string }).body,
        created_at: NOW,
        author: profile(this.role).display_name,
      };
      application.notes.push(note);
      return { status: 201, body: note };
    }
    if (match[2] && method === 'DELETE') {
      if (!this.may('applications:delete'))
        return { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };
      application.notes = application.notes.filter((note) => note.id !== match[2]);
      return { status: 204 };
    }
    if (method === 'GET')
      return { status: 200, body: { ...application, notes_count: application.notes.length } };
    if (method === 'PATCH') {
      if (!this.may('applications:update'))
        return { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };
      return this.changeStatus(application, (body as { status: ApplicationStatus }).status);
    }
    if (method === 'DELETE') {
      if (!this.may('applications:delete'))
        return { status: 403, body: { detail: 'Forbidden.', code: 'forbidden' } };
      if (query !== 'confirm=true') {
        return { status: 422, body: { detail: 'Confirm the deletion.', code: 'confirmation_required' } };
      }
      this.applications = this.applications.filter((candidate) => candidate !== application);
      return { status: 204 };
    }
    return { status: 405, body: {} };
  }

  private changeStatus(application: ApplicationDetail, status: ApplicationStatus): Answer {
    if (application.status === status) return { status: 200, body: application };
    if (application.status === 'approved' && !this.may('applications:delete')) {
      return {
        status: 403,
        body: { detail: 'Only an admin takes an approval back.', code: 'approval_locked' },
      };
    }
    if (status === 'approved') {
      const course = this.course(application.course.id);
      const needed = application.children.length;
      if (course.seats.free_seats < needed) {
        return {
          status: 409,
          body: {
            detail: 'The course has too few free places.',
            code: 'not_enough_seats',
            needed,
            free_seats: course.seats.free_seats,
          },
        };
      }
    }
    application.status = status;
    application.status_changed_at = NOW;
    return { status: 200, body: { ...application, notes_count: application.notes.length } };
  }

  private filtered(search: ApplicationSearch): ApplicationDetail[] {
    const word = (search.search ?? '').toLocaleLowerCase('tr');
    const digits = (search.search ?? '').replace(/\D/g, '');
    return this.applications.filter((application) => {
      if (search.statuses?.length && !search.statuses.includes(application.status)) return false;
      if (search.course_id && application.course.id !== search.course_id) return false;
      if (!word) return true;
      const names = [application.parent_name, ...application.children.map((child) => child.name)];
      return (
        names.some((name) => name.toLocaleLowerCase('tr').includes(word)) ||
        (digits.length >= 3 && application.phone.replace(/\D/g, '').includes(digits))
      );
    });
  }

  private search(search: ApplicationSearch) {
    const found = this.filtered(search).sort((a, b) =>
      search.sort === 'oldest'
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
    const limit = search.limit ?? 25;
    const offset = search.offset ?? 0;
    return {
      items: found.slice(offset, offset + limit).map((application) => this.summary(application)),
      total: found.length,
      limit,
      offset,
    };
  }

  private coursesRoute(method: string, path: string, body: unknown, refused: Answer): Answer {
    if (!this.may('courses:read')) return refused;
    if (method === 'GET' && path.startsWith('/courses')) {
      const items = this.courses.map((course) => this.withSeats(course));
      return { status: 200, body: { items, total: items.length, limit: 100, offset: 0 } };
    }
    if (!this.may('courses:write')) return refused;
    if (method === 'POST' && path === '/courses') {
      const input = body as Partial<Course>;
      if (input.end_date && input.start_date && input.end_date < input.start_date) {
        return { status: 422, body: { detail: [{ loc: ['body'], type: 'value_error' }] } };
      }
      const course = makeCourse({
        ...input,
        id: `course-${this.nextCourse++}`,
        created_at: NOW,
        updated_at: NOW,
        currency: 'AZN',
        registration_open: input.registration_open ?? false,
      });
      this.courses.push(course);
      return { status: 201, body: this.withSeats(course) };
    }
    const match = /^\/courses\/([^/]+)$/.exec(path);
    const course = this.courses.find((candidate) => candidate.id === match?.[1]);
    if (!course) return { status: 404, body: { detail: 'No such course.', code: 'course_not_found' } };
    if (method === 'PATCH') {
      const changes = body as Partial<Course>;
      const approved = this.withSeats(course).seats.approved_children;
      if (changes.capacity !== undefined && changes.capacity < approved) {
        return {
          status: 409,
          body: {
            detail: 'The course has more approved children than that.',
            code: 'capacity_below_approved',
            approved_children: approved,
          },
        };
      }
      const start = changes.start_date ?? course.start_date;
      const end = 'end_date' in changes ? changes.end_date : course.end_date;
      if (end && end < start) {
        return {
          status: 422,
          body: {
            detail: 'The course would make no sense that way.',
            code: 'invalid_course',
            field: 'end_date',
          },
        };
      }
      Object.assign(course, changes, { updated_at: NOW });
      return { status: 200, body: this.withSeats(course) };
    }
    if (method === 'DELETE') {
      this.courses = this.courses.filter((candidate) => candidate !== course);
      return { status: 204 };
    }
    return { status: 405, body: {} };
  }

  private contentRoute(method: string, path: string, body: unknown, headers: Record<string, string>): Answer {
    if (method === 'GET' && path === '/content') return { status: 200, body: this.describeContent() };
    if (method === 'PUT' && path === '/content') {
      const values = (body as { values: Record<string, ContentValue> }).values;
      for (const [key, value] of Object.entries(values)) {
        const field = this.fieldFor(key);
        if (!field)
          return {
            status: 422,
            body: { detail: 'No such place on the site.', code: 'unknown_content_key', key },
          };
        if (typeof value === 'string' && value.trim() === '') {
          return {
            status: 422,
            body: {
              detail: 'The value does not fit that place.',
              code: 'invalid_content',
              key,
              rule: 'empty',
            },
          };
        }
        if (typeof value === 'string' && field.max_length && value.length > field.max_length) {
          return {
            status: 422,
            body: {
              detail: 'The value does not fit that place.',
              code: 'invalid_content',
              key,
              rule: 'too_long',
            },
          };
        }
      }
      for (const [key, value] of Object.entries(values)) (this.fieldFor(key) as ContentField).draft = value;
      return { status: 200, body: this.describeContent() };
    }
    if (method === 'POST' && path === '/content/publications') {
      const keys = (body as { keys?: string[] } | undefined)?.keys;
      for (const key of keys ?? []) {
        if (!this.fieldFor(key))
          return {
            status: 422,
            body: { detail: 'No such place on the site.', code: 'unknown_content_key', key },
          };
      }
      for (const field of this.content.fields) {
        if (keys && !keys.includes(field.key)) continue;
        if (field.draft === null) this.published.delete(field.key);
        else this.published.set(field.key, field.draft);
      }
      this.version += 1;
      const publication: Publication = {
        version: this.version,
        published_at: NOW,
        published_by: profile(this.role).display_name,
      };
      this.content.publication = publication;
      return { status: 201, body: publication };
    }
    if (method === 'POST' && path === '/media') {
      const type = headers['content-type'] ?? '';
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
        return {
          status: 422,
          body: {
            detail: 'The file is not an image the site accepts.',
            code: 'invalid_image',
            reason: 'unsupported_type',
          },
        };
      }
      const id = `00000000-0000-4000-8000-${String(this.nextPicture++).padStart(12, '0')}`;
      return {
        status: 201,
        body: { id, url: `/media/${id}.webp`, width: 640, height: 480, byte_size: 1234, created_at: ago(0) },
      };
    }
    return { status: 404, body: { detail: 'Not found.' } };
  }
}
