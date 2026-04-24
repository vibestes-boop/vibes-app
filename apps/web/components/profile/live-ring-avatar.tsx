import Link from 'next/link';
import type { Route } from 'next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * LiveRingAvatar — v1.w.UI.16.
 *
 * Wrapper um den shadcn/Radix-`Avatar`, der den Avatar eines Users bekommt,
 * der gerade eine Live-Session hostet, in einen gradienten „Live-Ring" +
 * schwebendes rotes „LIVE"-Badge kleidet. Wenn der User nicht live ist,
 * fällt die Komponente auf den Default-Avatar zurück, wahlweise mit dem
 * bisherigen `ring-4 ring-background`-Hairline (wie der Profil-Hero ihn
 * vorher inline hatte).
 *
 * D3-Pattern aus UI_AUDIT_WEB: TikTok-Signatur-Farbverlauf (Pink → Rot →
 * Amber) auf einem schmalen Ring um den kreisrunden Avatar, Inner-Background
 * in der Site-Theme-Farbe damit der Ring visuell als „Donut" liest und sich
 * nicht mit dem Avatar-Rand überlappt. Das rote „LIVE"-Pill überragt den
 * Avatar am unteren Rand — dieselbe Positionierung wie TikTok/Instagram.
 *
 * Warum kein einfaches `ring-4 ring-pink-500`? Ein solider Ring ist statisch,
 * der Gradient gibt dem Live-Indikator den „Puls/Aufmerksamkeit"-Effekt.
 * Wichtig dabei: der Ring ist rein visuell (padding-innen + bg-gradient auf
 * dem Wrapper, danach ein zweiter Background-Ring innen) — kein `ring-X`-
 * Utility, weil Tailwind-Ring nur Single-Color erlaubt.
 *
 * Accessibility:
 *   - Wenn live UND `liveHref` gesetzt: Link-Wrapper mit `aria-label` der
 *     Screen-Readern erklärt, wohin der Klick führt
 *   - LIVE-Badge ist `aria-hidden` weil der Label schon im Link-Anchor sitzt,
 *     und Text-duplicate Screen-Reader-Ansagen nervt
 *   - Für nicht-live Avatare kein Link — bei Bedarf wickelt der Aufrufer
 *     selbst einen in sein Layout (z. B. Profil-Hero zeigt keinen Klick-
 *     Indikator, weil der User schon auf seiner eigenen Profil-Seite ist)
 */
export interface LiveRingAvatarProps {
  /** Avatar-Bild-URL. Fällt auf `fallback` zurück wenn nicht gesetzt. */
  src: string | null | undefined;
  /** Alt-Text fürs Avatar-Image + Basis für Fallback-Initial. */
  alt: string;
  /** Initialen für den Fallback (max. 2 Zeichen empfohlen). */
  fallback: string;
  /**
   * Live-Status des Users. Wenn `true`, rendert den Gradient-Ring + das
   * rote „LIVE"-Pill; wenn `false`, fällt auf Standard-Ring (`ring-4
   * ring-background`) zurück.
   */
  live: boolean;
  /**
   * Optionale Live-Session-ID: wenn gesetzt und `live=true`, wird der
   * Avatar zum klickbaren Link auf `/live/[id]`. Ohne `liveHref` ist der
   * Avatar auch im Live-State nicht klickbar (sinnvoll in Kontexten, wo
   * die Session-ID noch nicht aufgelöst ist oder der Klick anderweitig
   * behandelt wird).
   */
  liveHref?: Route | string;
  /**
   * Tailwind-Klassen für die Größe des Inneren Avatars — `h-24 w-24` o. Ä.
   * Der Gradient-Ring sitzt außen herum und vergrößert die Gesamt-Silhouette
   * um 2× `ringThickness`.
   */
  sizeClassName: string;
  /** Dicke des Gradient-Rings in px (Tailwind-Spacing-Pair). Default: 3px via `p-[3px]`. */
  ringThickness?: 'sm' | 'md' | 'lg';
  /** Optional: wrapper-Klassen für Layout-Anpassung (z. B. `shrink-0`). */
  className?: string;
  /** Accessible-Label für den Live-Link. Locale-Bereitstellung via i18n beim Aufrufer. */
  liveLinkLabel?: string;
  /** Accessible-Label für das LIVE-Badge. Locale-Bereitstellung via i18n. */
  liveBadgeLabel?: string;
}

const RING_PADDING: Record<NonNullable<LiveRingAvatarProps['ringThickness']>, string> = {
  sm: 'p-[2px]',
  md: 'p-[3px]',
  lg: 'p-[4px]',
};

export function LiveRingAvatar({
  src,
  alt,
  fallback,
  live,
  liveHref,
  sizeClassName,
  ringThickness = 'md',
  className,
  liveLinkLabel,
  liveBadgeLabel = 'LIVE',
}: LiveRingAvatarProps) {
  // Fall 1: nicht live. Standard-Avatar mit dezentem background-Ring.
  if (!live) {
    return (
      <Avatar className={cn(sizeClassName, 'ring-4 ring-background', className)}>
        <AvatarImage src={src ?? undefined} alt={alt} />
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
    );
  }

  // Fall 2: live. Gradient-Ring + LIVE-Badge. Content ist immer derselbe —
  // nur der äußere Wrapper ändert sich je nach `liveHref`.
  const avatarContent = (
    <>
      {/* Gradient-Ring: bg-gradient auf dem äußeren Wrapper, Inner-Padding
          schiebt den Avatar nach innen, Background-Token der Seite trennt
          den Ring optisch vom Avatar-Rand. */}
      <span
        className={cn(
          'relative block shrink-0 rounded-full bg-gradient-to-tr from-pink-500 via-red-500 to-amber-400',
          RING_PADDING[ringThickness],
          className,
        )}
      >
        <span className="block rounded-full bg-background p-[2px]">
          <Avatar className={cn(sizeClassName, 'block')}>
            <AvatarImage src={src ?? undefined} alt={alt} />
            <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
          </Avatar>
        </span>
        {/* LIVE-Badge — unten mittig, überlappt den Ring leicht damit der
            Anker klar „auf" dem Avatar sitzt statt daneben zu schweben.
            Rote Fill + weiße Typo = TikTok/IG-Signatur. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-elevation-2"
        >
          {liveBadgeLabel}
        </span>
      </span>
    </>
  );

  // Link-Wrapper optional — wenn `liveHref` fehlt, bleibt der Avatar statisch.
  if (liveHref) {
    return (
      <Link
        href={liveHref as Route}
        aria-label={liveLinkLabel ?? `${alt} — Live ansehen`}
        className="inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}
