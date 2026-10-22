import { RegistrationClosedError } from './registrationClosed';

// Contract owned by back/ (see back/app/schemas/application.py).
const API_URL = import.meta.env.VITE_API_URL ?? '';
const REQUEST_TIMEOUT_MS = 10_000;

export type ApplicationPayload = {
  parent_name: string;
  phone: string;
  children: { name: string; birth_date: string }[];
  languages: string[];
  // The course applied for, from the list of open courses. Left out, the API takes the one open course.
  course_id?: string;
  // The parent's explicit yes and the version of the privacy notice it was given for (SEC-F-16).
  consent: true;
  privacy_notice_version: string;
};

/** Resolves once the API has stored the application (201). Nothing from the answer is used, so none of it is trusted. */
export async function submitApplication(payload: ApplicationPayload): Promise<void> {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // A hung connection must fail (and show the WhatsApp fallback), never spin forever.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // 409: the course takes no applications now (closed, full, or none to choose) - not a fault to retry.
  if (response.status === 409) throw new RegistrationClosedError();
  if (!response.ok) throw new Error(`Application request failed: ${response.status}`);
}
