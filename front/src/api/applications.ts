// Contract owned by back/ (see back/app/schemas/application.py).
const API_URL = import.meta.env.VITE_API_URL ?? '';
const REQUEST_TIMEOUT_MS = 10_000;

export type ApplicationPayload = {
  parent_name: string;
  phone: string;
  children: { name: string; birth_date: string }[];
  languages: string[];
};

export async function submitApplication(payload: ApplicationPayload): Promise<{ id: string }> {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // A hung connection must fail (and show the WhatsApp fallback), never spin forever.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Application request failed: ${response.status}`);
  return response.json();
}
