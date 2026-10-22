// What the admin panel publishes for the page: two files that nginx serves from the content volume. The page never
// talks to the panel or the database. Contract owned by back/ (back/app/panel/services/snapshots.py, content.py).
const CONTENT_URL = '/content';
const TIMEOUT_MS = 2000;
const LARGEST_FILE_BYTES = 1_000_000;

export type PublicCourse = {
  id: string;
  title: string;
  startDate: string;
  schedule: string;
  location: string;
  ageMin: number;
  ageMax: number;
  priceMinor: number;
  secondChildPriceMinor: number;
  capacity: number;
  seatsLeft: number;
  isAcceptingApplications: boolean;
};

export type PublicContent = {
  /** The published places by key (unchecked: `content/registry.ts` checks each one against its place). */
  site: Record<string, unknown>;
  /** The courses open for registration, or null when the list could not be read. */
  courses: PublicCourse[] | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown, least: number, most: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= least && value <= most;
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 300;
}

/** One course of courses.json, or null if anything about it is not as the contract says. */
export function parseCourse(value: unknown): PublicCourse | null {
  if (!isRecord(value)) return null;
  const { id, title, start_date, schedule, location, currency } = value;
  const { age_min, age_max, price_minor, second_child_price_minor, capacity, seats_left } = value;
  const accepting = value.accepting_applications;
  const isValid =
    isShortText(id) &&
    isShortText(title) &&
    typeof start_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(start_date) &&
    isShortText(schedule) &&
    isShortText(location) &&
    currency === 'AZN' &&
    isWholeNumber(age_min, 0, 25) &&
    isWholeNumber(age_max, 0, 25) &&
    isWholeNumber(price_minor, 0, 10_000_000) &&
    isWholeNumber(second_child_price_minor, 0, 10_000_000) &&
    isWholeNumber(capacity, 1, 500) &&
    isWholeNumber(seats_left, 0, 500) &&
    typeof accepting === 'boolean';
  if (!isValid) return null;
  return {
    id,
    title,
    startDate: start_date,
    schedule,
    location,
    ageMin: age_min,
    ageMax: age_max,
    priceMinor: price_minor,
    secondChildPriceMinor: second_child_price_minor,
    capacity,
    seatsLeft: seats_left,
    isAcceptingApplications: accepting,
  };
}

export function parseCourses(file: unknown): PublicCourse[] | null {
  if (!isRecord(file) || !Array.isArray(file.courses)) return null;
  return file.courses.flatMap((entry: unknown) => {
    const course = parseCourse(entry);
    return course ? [course] : [];
  });
}

export function parseSite(file: unknown): Record<string, unknown> {
  return isRecord(file) && isRecord(file.content) ? file.content : {};
}

/**
 * The text of the answer, or null if it is longer than the cap. The size is checked before reading (the declared
 * length) and while reading (the bytes that arrive), so a file that is far too big is never held in memory.
 */
async function readCapped(response: Response): Promise<string | null> {
  if (Number(response.headers.get('content-length')) > LARGEST_FILE_BYTES) return null;
  const reader = response.body?.getReader();
  if (reader === undefined) return null; // an answer without a body holds no JSON
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > LARGEST_FILE_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** The file's JSON, or null for anything that goes wrong: a missing file, a slow answer, a page that is not JSON. */
async function readJson(name: string): Promise<unknown> {
  try {
    const response = await fetch(`${CONTENT_URL}/${name}`, {
      // Revalidate every time: a seat taken a minute ago must not be offered from the browser's cache.
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const isJson = response.headers.get('content-type')?.includes('json') ?? false;
    if (!response.ok || !isJson) return null;
    const text = await readCapped(response);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

/** Reads both files at once. It never throws: without them the page shows what it was built with. */
export async function loadPublicContent(): Promise<PublicContent> {
  const [site, courses] = await Promise.all([readJson('site.json'), readJson('courses.json')]);
  return { site: parseSite(site), courses: parseCourses(courses) };
}
