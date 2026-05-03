// Serlo Brand Tokens — konsistent mit der App (tailwind.config.js)

export const BRAND = {
  // Farben
  gold: '#F5A623',
  goldLight: '#FFD166',
  red: '#EF4444',
  redLight: '#FF6B6B',
  black: '#0A0A0A',
  darkBg: '#111111',
  cardBg: '#1A1A1A',
  cardBgHover: '#222222',
  white: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textSub: 'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.08)',

  // Gradient Presets
  gradientGold: 'linear-gradient(135deg, #F5A623 0%, #FFD166 100%)',
  gradientRed: 'linear-gradient(135deg, #EF4444 0%, #FF6B6B 100%)',
  gradientDark: 'linear-gradient(180deg, #0A0A0A 0%, #1A1A1A 100%)',

  // Typography — Inter als primäre Font (via lib/fonts.ts geladen)
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",

  // Canvas — 9:16 Portrait (TikTok/Reels/Stories Standard)
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

// Häufige Coin-Emoji
export const COIN = '🪙';

// Hilfsfunktion: Zahl mit K/M formatieren
export function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}
