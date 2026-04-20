import { redirect } from 'next/navigation';

// /settings Root: wir redirecten auf /settings/billing solange Profil-Einstellungen
// noch nicht gebaut sind (Phase 11). Damit ist der Link in der Nav zumindest
// nicht kaputt.
export default function SettingsIndexPage() {
  redirect('/settings/billing');
}
