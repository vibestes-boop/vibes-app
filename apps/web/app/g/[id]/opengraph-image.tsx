import { ImageResponse } from 'next/og';
import { getGuildById, getGuildMemberCount } from '@/lib/data/guilds';

// -----------------------------------------------------------------------------
// /g/[id]/opengraph-image — dynamisches OG-Bild für Guild-Detail-Seiten.
//
// Layout:
//   Dunkelblauer Gradient-Hintergrund, zentriert:
//   • Pod-Initials-Avatar (großer Kreis mit Guild-Farbe)
//   • Pod-Name (groß, weiß)
//   • Beschreibungs-Excerpt
//   • Mitgliederzahl + Serlo-Branding
// -----------------------------------------------------------------------------

export const runtime = 'edge';
export const revalidate = 3600;

export const alt = 'Serlo Pod';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Deterministic accent color aus Guild-ID
function guildColor(id: string): string {
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export default async function GuildOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [guild, memberCount] = await Promise.all([
    getGuildById(id).catch(() => null),
    getGuildMemberCount(id).catch(() => 0),
  ]);

  const name = guild?.name ?? 'Serlo Pod';
  const description = guild?.description?.slice(0, 120) ?? 'Eine Community auf Serlo.';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const accent = guildColor(id);
  const membersLabel = memberCount > 0
    ? `${memberCount.toLocaleString('de-DE')} Mitglieder`
    : 'Serlo Community';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16213e 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
          gap: '24px',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 700,
            color: '#fff',
            boxShadow: `0 0 60px ${accent}66`,
          }}
        >
          {initials}
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: name.length > 20 ? 48 : 64,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
              maxWidth: 800,
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        )}

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginTop: 8,
          }}
        >
          <div
            style={{
              background: `${accent}22`,
              border: `1.5px solid ${accent}55`,
              borderRadius: 999,
              padding: '8px 20px',
              fontSize: 20,
              color: accent,
              fontWeight: 600,
            }}
          >
            👥 {membersLabel}
          </div>
          <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            Serlo
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
