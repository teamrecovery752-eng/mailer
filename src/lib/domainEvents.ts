// Domains are edited in one client component (the Settings page) but
// displayed in others (the Sidebar badge, the Dashboard connection
// banner, the Single/Bulk domain pickers) that are already mounted and
// won't naturally re-fetch on their own. Rather than a full page reload,
// broadcast a lightweight browser event whenever domains change so any
// listener can refetch immediately.
export const DOMAINS_UPDATED_EVENT = "domains-updated";

export function notifyDomainsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DOMAINS_UPDATED_EVENT));
  }
}
