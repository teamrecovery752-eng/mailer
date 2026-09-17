// Deliberately stricter than the send routes' inline regex — this runs
// during list cleaning, where the goal is to catch obviously-bad entries
// before they ever reach a provider (leading/trailing dots, spaces
// embedded from a bad CSV export, no TLD, etc).
const EMAIL_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}
