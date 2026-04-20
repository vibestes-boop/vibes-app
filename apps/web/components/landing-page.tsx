import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Gamepad2, ShoppingBag, Radio, Sparkles, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// -----------------------------------------------------------------------------
// Landing-Page für ausgeloggte Besucher.
// Server-Component, rein markup-lastig; die Daten kommen via Props.
// -----------------------------------------------------------------------------

export type FeaturedCreator = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
};

export function LandingPage({ featured }: { featured: FeaturedCreator[] }) {
  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="container mx-auto flex flex-col items-center py-20 text-center lg:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
          Web-Beta · Phase 3 Feed
        </div>

        <h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-7xl">
          Live. Shop. Community.
          <br />
          <span className="text-muted-foreground">Jetzt auch im Browser.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Die Serlo Web-Version. Streame in 1080p60 vom PC, verkaufe professionell im Shop,
          folge deiner Community — ohne App-Download.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl">
            <Link href={'/login' as Route}>
              Einloggen
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href={'/signup' as Route}>Account erstellen</Link>
          </Button>
        </div>
      </section>

      {/* Value-Props */}
      <section className="container mx-auto grid gap-6 pb-20 md:grid-cols-3">
        <ValueCard
          icon={<Gamepad2 className="h-6 w-6" />}
          title="PC-Streamer"
          description="Gaming-Streams, IRL-Shows, Talk-Formate. Multi-Source-Deck mit Screenshare, Webcam, Mic — oder direkt aus OBS via WHIP-Ingest."
          badge="Phase 6"
        />
        <ValueCard
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Online-Händler"
          description="Professionelles Storefront mit Facetten-Filtern, Sale-Management, Order-Tracking und Revenue-Analytics. Bezahlung per Coins oder Stripe."
          badge="Phase 4"
        />
        <ValueCard
          icon={<Radio className="h-6 w-6" />}
          title="Creator"
          description="Desktop-Creator-Studio mit Scheduled Posts, Cloud-Drafts, Peak-Hours-Heatmap und Watch-Time-Analytics. Mehr Kontrolle als im Native-App."
          badge="Phase 9"
        />
      </section>

      {/* Discovery-Strip */}
      {featured.length > 0 && (
        <section className="container mx-auto pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Compass className="h-5 w-5 text-brand-gold" />
              Creator entdecken
            </h2>
            <span className="text-xs text-muted-foreground">
              Klick auf einen Account — kein Login nötig
            </span>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((c) => (
              <li key={c.username}>
                <Link
                  href={`/u/${c.username}` as Route}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={c.avatar_url ?? undefined} alt={c.display_name ?? c.username} />
                    <AvatarFallback>
                      {(c.display_name ?? c.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="w-full min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {c.display_name ?? `@${c.username}`}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatCount(c.follower_count)} Follower
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Serlo</span>
          <nav className="flex gap-6">
            <Link href={'/terms' as Route} className="hover:text-foreground">AGB</Link>
            <Link href={'/privacy' as Route} className="hover:text-foreground">Datenschutz</Link>
            <Link href={'/imprint' as Route} className="hover:text-foreground">Impressum</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString('de-DE');
}

function ValueCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  );
}
