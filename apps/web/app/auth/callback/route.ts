import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth Callback — handles Magic-Link, OAuth (Google/Apple) and Password-Reset flows.
 *
 * Supabase redirects here with either:
 *   - `?code=...` → exchangeable for a session (PKCE flow used by @supabase/ssr)
 *   - `?code=...&type=recovery` → password-reset recovery link (v1.w.UI.216)
 *   - `?token_hash=...&type=...` → Einmal-Marke aus der Mail-Vorlage (24.08.2026)
 *   - `?error=...&error_description=...` → OAuth rejection / user cancel
 *
 * The `?next=...` param (URL-encoded) tells us where to land after success.
 * Defaults to `/` if not provided.
 *
 * Post-auth routing:
 *   - type=recovery → /auth/reset-password (skip profile check — session is ephemeral)
 *   - User has profile row with username → redirect to `next`
 *   - User authenticated but no profile / missing username → redirect to `/onboarding`
 *
 * ── ⚠️ WARUM ES DEN `token_hash`-WEG GIBT (24.08.2026) ───────────────────────
 *
 * Bis dahin trugen die Mails `{{ .ConfirmationURL }}`, und der zeigt auf
 * `<projekt>.supabase.co`. Abgesendet wurden sie aber von `mail.serlo.ch`.
 * Absender und Ziel gehörten damit nicht zusammen — und genau daran erkennt ein
 * Spamfilter Phishing. Gmail hat die erste echte Mail nicht bloss aussortiert,
 * sondern mit der ROTEN Warnung „Diese Nachricht könnte gefährlich sein"
 * versehen. Das ist schlimmer als gar keine Mail: Es beschädigt den Ruf der
 * Domain, und wer die Warnung sieht, klickt zu Recht nicht.
 *
 * Mit `{{ .TokenHash }}` zeigt der Link auf UNSERE Domain, und diese Route löst
 * die Marke serverseitig gegen Supabase ein (`verifyOtp`). Absender und Ziel
 * stimmen wieder überein.
 *
 * ── ⚠️ UND WARUM DER FREMD-SCHEMA-ZWEIG DARIN BLEIBEN MUSS ──────────────────
 *
 * Die Mail-Vorlage ist EINE für alle. Dieselbe „Passwort zurücksetzen"-Mail geht
 * an Web-Nutzer und an App-Nutzer — die Serlo-App fordert sie mit
 * `redirectTo: 'vibes://reset-password'` an, Berkat entsprechend mit `berkat://`.
 * Wer hier nur an das Web denkt, schickt App-Nutzer auf eine Webseite, auf der
 * sie nichts anfangen können.
 *
 * Deshalb: Zeigt `redirect_to` auf ein App-Schema, hängen wir die Sitzung als
 * Fragment an und geben ab. Das ist ZEICHENGLEICH das, was Supabase heute selbst
 * schickt — die Apps brauchen also keine Änderung und kein neues Binary.
 */

/** Die Marken-Arten, die Supabase in Mails verschickt. Alles andere lehnen wir ab. */
const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

/**
 * Schemata unserer eigenen Apps.
 *
 * ⚠️ Die Liste ist eine Weiterleitungs-Erlaubnis und keine Kosmetik: `redirect_to`
 * kommt zwar aus der Mail-Vorlage und ist damit schon durch Supabases eigene
 * Redirect-Liste gegangen, aber wir hängen hier die Sitzung an. Ein Ziel, das
 * nicht uns gehört, bekäme sie mit.
 */
const APP_SCHEMES = ['vibes://', 'berkat://'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const redirectTo = searchParams.get('redirect_to');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  // OAuth/Magic-Link failure from the provider — bounce back to /login with a message.
  if (errorParam) {
    const msg = errorDescription ?? errorParam;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Fehlender Auth-Code.')}`);
  }

  const supabase = await createClient();

  // ── Sitzung herstellen ────────────────────────────────────────────────────
  let authError: { message: string } | null = null;

  if (tokenHash) {
    // Der neue Weg. `type` MUSS zur Marke passen — Supabase prüft das, aber eine
    // erfundene Art würde sonst als Typfehler erst zur Laufzeit auffallen.
    const otpType = OTP_TYPES.find((t) => t === type);
    if (!otpType) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Dieser Link ist unvollständig. Fordere ihn neu an.')}`,
      );
    }
    ({ error: authError } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    }));
  } else {
    ({ error: authError } = await supabase.auth.exchangeCodeForSession(code!));
  }

  if (authError) {
    // ⚠️ Die häufigste Ursache ist ein abgelaufener oder bereits benutzter Link,
    // nicht ein Fehler des Nutzers. Supabases Meldung dazu ist englisch und
    // technisch; die Anmeldeseite zeigt sie an, deshalb hier etwas, das sagt,
    // was zu tun ist.
    const expired = /expired|invalid|already/i.test(authError.message);
    const msg = expired
      ? 'Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einen neuen an.'
      : authError.message;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }

  // ── Rücksprung in die App ─────────────────────────────────────────────────
  //
  // Muss VOR der Profil-Prüfung stehen: Ein App-Nutzer soll nicht durch das
  // Web-Onboarding geschickt werden, nur weil sein Profil dort unvollständig
  // aussieht.
  if (redirectTo && APP_SCHEMES.some((s) => redirectTo.startsWith(s))) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Session konnte nicht erstellt werden.')}`,
      );
    }

    // Fragment, nicht Abfrage-Zeichenkette — Fragmente werden nicht an Server
    // gesendet und stehen in keinem Zugriffsprotokoll. Dieselbe Form, die
    // Supabase heute selbst schickt (siehe `lib/useGoogleSignIn.ts`).
    const fragment = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      ...(type ? { type } : {}),
    });
    return NextResponse.redirect(`${redirectTo}#${fragment.toString()}`);
  }

  // v1.w.UI.216 — Password-Reset recovery: session is now active, send straight
  // to the reset-password page. Skip profile-check (user may have no profile yet
  // and the session is ephemeral / scoped to this operation).
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // Check profile state — onboarding needed?
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Session konnte nicht erstellt werden.')}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.username) {
    // First login or incomplete profile — send through onboarding.
    // Preserve `next` so we can return there once onboarding completes.
    return NextResponse.redirect(
      `${origin}/onboarding?next=${encodeURIComponent(next)}`,
    );
  }

  // Defense against open-redirect: only allow same-origin relative `next`.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(`${origin}${safeNext}`);
}
