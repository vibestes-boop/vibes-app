import { notFound } from 'next/navigation';
import fs from 'node:fs';
import path from 'node:path';
import { HeroLab } from '@/components/hero/hero-lab';
import { DEFAULT_HERO_LAYOUT, type HeroLayout } from '@/components/hero/hero-horizon';

// /hero-lab — DEV-ONLY Kompositions-Werkzeug für den Landing-Hero.
// In Produktion nicht erreichbar (404). Liest die Schnipsel aus public/hero/
// und das gespeicherte Layout aus public/hero/hero-layout.json.

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Hero-Lab (dev)', robots: { index: false, follow: false } };

export default function HeroLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const dir = path.join(process.cwd(), 'public', 'hero');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.(png|webp|jpe?g)$/i.test(f))
    : [];

  let layout: HeroLayout = DEFAULT_HERO_LAYOUT;
  try {
    layout = JSON.parse(fs.readFileSync(path.join(dir, 'hero-layout.json'), 'utf8')) as HeroLayout;
  } catch {
    /* noch kein Layout gespeichert — Default reicht */
  }

  return <HeroLab files={files} initialLayout={layout} />;
}
