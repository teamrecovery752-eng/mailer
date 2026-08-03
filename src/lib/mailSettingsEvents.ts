// Settings are edited in one client component (the Settings page) but
// displayed in others (the Sidebar badge, the Dashboard connection
// banner) that are already mounted and won't naturally re-fetch on their
// own. Rather than a full page reload, broadcast a lightweight browser
// event when settings are saved so any listener can refetch immediately.
export const MAIL_SETTINGS_UPDATED_EVENT = "mail-settings-updated";

export function notifyMailSettingsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAIL_SETTINGS_UPDATED_EVENT));
  }
}
