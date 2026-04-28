'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { AtSign, CheckCircle2, AlertCircle, Globe, Mountain, ChevronDown, X } from 'lucide-react';

import { updateProfile } from '@/app/actions/profile';
import { AvatarUploadField, type AvatarUploadFieldLabels } from '@/components/settings/avatar-upload-field';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <ProfileEditForm /> — v1.w.UI.20 + v1.w.UI.159.
//
// Clientseitige Form für Anzeigename + Bio + Website + Teip.
// Submit geht über die Server-Action `updateProfile` (app/actions/profile.ts).
//
// v1.w.UI.159: Website-URL-Feld + Teip (Тейп / Chechen Clan) Picker.
// Parity mit mobile `app/settings.tsx`.
// -----------------------------------------------------------------------------

const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 200;
const WEBSITE_MAX = 200;

// Full Chechen clan list (identical to mobile app/settings.tsx TEIP_LIST)
const TEIP_LIST: string[] = [...new Set([
  'Аллерой', 'Белгатой', 'Беной', 'Билтой', 'Гендаргеной', 'Зандакъой',
  'Курчалой', 'Нохчмахкахой', 'Саьлий', 'Симсой', 'Центарой', 'Цонтарой',
  'Чермой', 'Эрсаной', 'Элстанжхой',
  'Варандой', 'Гордалой', 'Дай', 'Дишний', 'Зумсой', 'Кулой',
  'Кхяккхой', 'Нашхой', 'Суьлий', 'Хаккой', 'Чаьнтий',
  'Аккхий', 'Га1алай', 'Садой', 'Хиндой', 'Хьалхарой',
  'Болхой', 'Ведений', 'Ишхой', 'Маьлхий', 'Пешхой',
  'Сатой', 'Харачой', 'Химой', 'Шатой', 'Шикарой', 'Шуьйтой',
  'Майстой', 'Мелхий', 'Тумсой', 'Хьачарой',
  'Барчхой', 'Дарбанхой', 'Кийчой', 'Регахой',
  'Саьдой', 'Цикарой', 'Чеберлой', 'Энгеной',
  'Белхарой', 'Бовткой', 'Гуной', 'Хилдехьарой',
  'Балой', 'Терлой', 'Хьарахой',
  'Айткхаллой', 'Арсалой', 'Атагой', 'Ахархой', 'Аьккхий',
  'Баьсний', 'Белгой', 'Бийтарой', 'Бовхой', 'Борзой',
  'Булгучой', 'Вашандарой', 'Гала1ай', 'Галай', 'Гантой',
  'Гарангой', 'Гатой', 'Гачалкой', 'Гелдагой', 'Гендашой',
  'Гехой', 'Гилой', 'Гичалой', 'Гойтой',
  'Гудермесой', 'Гумкой', 'Гунашой', 'Дурдхой', 'Жевой',
  'Зогой', 'Зоьрхой', 'Зоьпхой', 'Ингушой', 'Ирзой',
  'Кей', 'Кеший', 'Кортой', 'Курой', 'Кхерой',
  'Лаьмрой', 'Лашкарой', 'Лебой', 'Маккхой', 'Мартанхой',
  'Махкой', 'Минкой', 'Мочхой', 'Муцалхой', 'Нашах',
  'Никарой', 'Ножой', 'Оьздой', 'Памятой',
  'Пхьарчхой', 'Сесанхой', 'Сирхой', 'Старой',
  'Тарской', 'Тасой', 'Туркой', 'Хамхой',
  'Ханкалой', 'Хилой', 'Холой',
  'Хьоькхой', 'Чинхой', 'Чкъарой', 'Шаройхой', 'Ширдий',
  'Эгашбатой', 'Элисханхой', 'Эрпалой',
])].sort((a, b) => a.localeCompare(b, 'ru'));

export interface ProfileEditFormLabels {
  displayName: string;
  displayNameHint: string;
  bio: string;
  bioHint: string;
  username: string;
  usernameHint: string;
  save: string;
  saving: string;
  saved: string;
  errorFallback: string;
  /** v1.w.UI.21 — Avatar-Labels; an AvatarUploadField durchgereicht. */
  avatar: AvatarUploadFieldLabels;
}

export interface ProfileEditFormProps {
  initialDisplayName: string;
  initialBio: string;
  /** v1.w.UI.159 — Website-URL, leer wenn nicht gesetzt. */
  initialWebsite?: string;
  /** v1.w.UI.159 — Teip-Name oder null. */
  initialTeip?: string | null;
  /** Username wird readonly angezeigt; Rename ist out-of-scope. */
  username: string;
  /** v1.w.UI.21 — Aktuelle Avatar-URL aus DB; `null` wenn keiner gesetzt. */
  initialAvatarUrl: string | null;
  /** User-ID wird im AvatarUploadField für den R2-Key-Pfad gebraucht. */
  userId: string;
  labels: ProfileEditFormLabels;
}

export function ProfileEditForm({
  initialDisplayName,
  initialBio,
  initialWebsite = '',
  initialTeip = null,
  username,
  initialAvatarUrl,
  userId,
  labels,
}: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [website, setWebsite] = useState(initialWebsite);
  const [teip, setTeip] = useState<string | null>(initialTeip);
  const [teipOpen, setTeipOpen] = useState(false);
  const [teipSearch, setTeipSearch] = useState('');
  const teipDropdownRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'success' }
    | { kind: 'error'; message: string; field?: string }
  >({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();

  // Close teip dropdown on outside click
  useEffect(() => {
    if (!teipOpen) return;
    function handler(e: MouseEvent) {
      if (teipDropdownRef.current && !teipDropdownRef.current.contains(e.target as Node)) {
        setTeipOpen(false);
        setTeipSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [teipOpen]);

  const displayNameTooLong = displayName.length > DISPLAY_NAME_MAX;
  const bioTooLong = bio.length > BIO_MAX;
  const websiteTooLong = website.length > WEBSITE_MAX;
  const displayNameEmpty = displayName.trim().length === 0;
  const clientInvalid = displayNameTooLong || bioTooLong || websiteTooLong || displayNameEmpty;

  const filteredTeips = teipSearch.trim()
    ? TEIP_LIST.filter((t) => t.toLowerCase().includes(teipSearch.toLowerCase()))
    : TEIP_LIST;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (clientInvalid || isPending) return;

    const fd = new FormData();
    fd.set('display_name', displayName);
    fd.set('bio', bio);
    fd.set('website', website);
    if (teip) fd.set('teip', teip);

    startTransition(async () => {
      const result = await updateProfile(fd);
      if (result.ok) {
        setStatus({ kind: 'success' });
        setTimeout(() => {
          setStatus((prev) => (prev.kind === 'success' ? { kind: 'idle' } : prev));
        }, 3000);
      } else {
        setStatus({
          kind: 'error',
          message: result.error || labels.errorFallback,
          field: result.field,
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6"
      data-testid="profile-edit-form"
    >
      {status.kind === 'success' && (
        <div
          className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
          data-testid="profile-edit-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{labels.saved}</span>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          role="alert"
          data-testid="profile-edit-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{status.message}</span>
        </div>
      )}

      {/* Avatar — eigener Upload-Flow via R2 (v1.w.UI.21). */}
      <AvatarUploadField
        initialAvatarUrl={initialAvatarUrl}
        userId={userId}
        displayName={initialDisplayName || username}
        labels={labels.avatar}
      />

      {/* Username — readonly. */}
      <div className="space-y-1">
        <label htmlFor="profile-username" className="text-sm font-medium text-foreground">
          {labels.username}
        </label>
        <div className="relative">
          <AtSign
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="profile-username"
            type="text"
            value={username}
            readOnly
            disabled
            aria-disabled
            className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-muted-foreground"
            data-testid="profile-username-input"
          />
        </div>
        <p className="text-xs text-muted-foreground">{labels.usernameHint}</p>
      </div>

      {/* Display Name */}
      <div className="space-y-1">
        <label htmlFor="profile-display-name" className="text-sm font-medium text-foreground">
          {labels.displayName}
        </label>
        <input
          id="profile-display-name"
          name="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX + 20}
          aria-invalid={displayNameTooLong || displayNameEmpty || undefined}
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            displayNameTooLong || (displayNameEmpty && status.kind === 'error' && status.field === 'display_name')
              ? 'border-red-500'
              : 'border-border',
          )}
          data-testid="profile-display-name-input"
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{labels.displayNameHint}</p>
          <span
            className={cn(
              'text-xs tabular-nums',
              displayNameTooLong ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
            data-testid="profile-display-name-counter"
          >
            {displayName.length}/{DISPLAY_NAME_MAX}
          </span>
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1">
        <label htmlFor="profile-bio" className="text-sm font-medium text-foreground">
          {labels.bio}
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={BIO_MAX + 50}
          aria-invalid={bioTooLong || undefined}
          className={cn(
            'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            bioTooLong ? 'border-red-500' : 'border-border',
          )}
          data-testid="profile-bio-input"
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{labels.bioHint}</p>
          <span
            className={cn(
              'text-xs tabular-nums',
              bioTooLong ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
            data-testid="profile-bio-counter"
          >
            {bio.length}/{BIO_MAX}
          </span>
        </div>
      </div>

      {/* Website — v1.w.UI.159 */}
      <div className="space-y-1">
        <label htmlFor="profile-website" className="text-sm font-medium text-foreground">
          Website
        </label>
        <div className="relative">
          <Globe
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="profile-website"
            name="website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://deine-website.com"
            maxLength={WEBSITE_MAX + 20}
            className={cn(
              'w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
              websiteTooLong ? 'border-red-500' : 'border-border',
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">Dein Link im Profil (optional)</p>
      </div>

      {/* Teip (Clan) — v1.w.UI.159 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          🏔️ Тейп (Clan)
        </label>
        <div className="relative" ref={teipDropdownRef}>
          <button
            type="button"
            onClick={() => { setTeipOpen((o) => !o); setTeipSearch(''); }}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'border-border',
            )}
          >
            <span className="flex items-center gap-2 text-sm">
              <Mountain className="h-4 w-4 text-muted-foreground" />
              {teip ? `🏔️ ${teip}` : <span className="text-muted-foreground">Auswählen…</span>}
            </span>
            <div className="flex items-center gap-1">
              {teip && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setTeip(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setTeip(null); } }}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Teip entfernen"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', teipOpen && 'rotate-180')} />
            </div>
          </button>

          {teipOpen && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {/* Search */}
              <div className="border-b border-border p-2">
                <input
                  autoFocus
                  type="text"
                  value={teipSearch}
                  onChange={(e) => setTeipSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto py-1">
                {filteredTeips.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">Kein Ergebnis</li>
                ) : (
                  filteredTeips.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => { setTeip(name); setTeipOpen(false); setTeipSearch(''); }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent',
                          teip === name && 'font-semibold text-primary',
                        )}
                      >
                        {name}
                        {teip === name && <span className="ml-auto text-primary">✓</span>}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Wird in deinem Profil angezeigt (optional)</p>
      </div>

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={clientInvalid || isPending}
          data-testid="profile-save-button"
          className={cn(
            'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors',
            'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isPending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}
