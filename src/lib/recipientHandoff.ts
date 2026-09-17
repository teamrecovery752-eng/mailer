// A cleaned list from the List Cleaning page hands off to the Bulk Email
// page through sessionStorage rather than a query string or global state
// — it's a one-shot transfer (read once, then cleared), tab-scoped, and
// avoids stuffing potentially thousands of rows into a URL.
const KEY = "mailer:cleanedRecipients";

export function stashCleanedRecipients(data: any[], columns: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ data, columns }));
  } catch {
    // sessionStorage can throw in rare cases (private browsing quirks,
    // storage full) — the handoff is a convenience, not essential, so
    // fail silently rather than block navigation.
  }
}

export function takeCleanedRecipients(): { data: any[]; columns: string[] } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY); // one-shot: don't re-load on a later visit
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.data)) return null;
    return { data: parsed.data, columns: Array.isArray(parsed.columns) ? parsed.columns : [] };
  } catch {
    return null;
  }
}
