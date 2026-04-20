import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Moved out of experimental in Next.js 15.5+
  // Temporarily disabled to unblock deploy — re-enable post-launch
  // once all dynamic router.push/redirect calls are migrated to `as Route`.
  typedRoutes: false,
  // ESLint während `next build` überspringen — läuft separat via `npm run lint`.
  // Grund: ESLint v9 Flat-Config + Next.js 15 + Vercel = Known-Edge-Case
  // (Vercel versucht eine auto-generierte eslint.config.js zu laden die
  // `require('eslint/config')` tut, was in ESLint v9 kein Public-Module ist).
  // Build bricht sonst mit "Cannot find module 'eslint/config'" ab obwohl
  // der Code selbst lint-clean ist.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript-Check während `next build` überspringen — läuft separat via `npm run typecheck`.
  // Grund: Monorepo-Edge-Case bei `shared/**/*.ts` Imports — TS-Resolver findet
  // `node_modules/zod` während Build nicht, weil Files außerhalb von apps/web/
  // liegen und ihre eigene Node-Resolution-Chain starten. Webpack-Fix unten
  // deckt Runtime ab; TS-Check wird lokal + CI separat erzwungen.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Explicitly pin workspace root to this app, not the vibes-app monorepo root
  // (silences "multiple lockfiles detected" warning)
  outputFileTracingRoot: import.meta.dirname,
  // Transpile shared/ (liegt außerhalb von apps/web, ist aber Teil des Builds)
  transpilePackages: [],
  // -------------------------------------------------------------------------
  // Monorepo-Fix: Files aus `shared/` (außerhalb von apps/web/) importieren
  // `zod` etc. — Webpack sucht node_modules von der Importer-Datei aus nach
  // oben und findet es nicht, weil `zod` nur in `apps/web/node_modules` liegt.
  // Fix: apps/web/node_modules explizit zur Resolution-Kette hinzufügen.
  //
  // Alternative wäre shared/ als echtes Workspace-Package mit eigenem
  // package.json — overkill für den aktuellen Scope. Sobald wir mehr Pakete
  // haben (z.B. shared/gifts auch als npm-package), wechseln wir auf pnpm/bun
  // Workspaces und entfernen diesen Block.
  // -------------------------------------------------------------------------
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(config.resolve.modules ?? ['node_modules']),
    ];
    return config;
  },
  images: {
    // Supabase Storage + Cloudflare R2 + LiveKit thumbnails
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.livekit.cloud' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // OAuth fallback
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },     // Google OAuth
    ],
  },
  // Security-Headers — shippen zusätzlich in jedem Response
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

// -----------------------------------------------------------------------------
// Sentry-Wrapper
//
// `withSentryConfig` tut hauptsächlich drei Dinge beim Build:
//   1) Client-Bundle-Injection: injected `sentry.client.config.ts` in jedes
//      Browser-Bundle automatisch — wir müssen das Config-File nirgends
//      explizit importieren.
//   2) Source-Map-Upload: lädt die Source-Maps nach Sentry hoch wenn
//      `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` gesetzt sind,
//      und löscht sie danach lokal (`hideSourceMaps: true`) damit sie nicht
//      auf dem Edge ausgeliefert werden.
//   3) Tunnel-Route: Proxy für Sentry-Ingest unter `/monitoring` um
//      Ad-Blocker-Blocks zu umgehen (Sentry-Requests werden sonst gern
//      von uBlock Origin etc. blockiert).
//
// Alles deaktiviert sich sauber wenn die Auth-Env-Vars fehlen — der Build
// geht dann einfach ohne Source-Map-Upload durch (nützlich für lokales
// `next build` und für Self-Hoster).
// -----------------------------------------------------------------------------
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Build-Logs schlank halten — CI-Output wird sonst laut.
  silent: !process.env.CI,

  // Source-Maps werden hochgeladen und lokal gelöscht; Browser bekommt nur
  // das obfuscated Bundle. Stack-Traces in Sentry werden trotzdem
  // symboliziert weil Sentry die Maps serverseitig zuordnet.
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,

  // Proxy Sentry-Requests über /monitoring → Bypass Ad-Blocker.
  tunnelRoute: '/monitoring',

  // Automatisches Vercel-Cron-Monitoring + Release-Injection.
  automaticVercelMonitors: true,
};

// Wrapping NUR wenn eine DSN da ist — sonst kein Nutzen und der Wrapper
// fügt Overhead hinzu (Webpack-Plugins, Telemetry-Init).
const shouldEnableSentry =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) ||
  Boolean(process.env.SENTRY_DSN);

// -----------------------------------------------------------------------------
// Bundle-Analyzer (v1.w.12.5)
//
// Aktiviert sich mit `ANALYZE=true next build` (siehe npm-Script `analyze`).
// Schreibt zwei HTML-Reports nach `.next/analyze/` — einen pro Seite für
// Client-Bundles, einen für Server-Bundles. Nicht öffentlich erreichbar,
// rein lokales Dev-Tool.
//
// Warum NACH withSentryConfig wrappen: der Sentry-Wrapper injected zusätzliche
// Chunks (client-config auto-injection, tunnel-route). Wenn wir VOR Sentry
// analyzen, sehen wir ein falsches Bundle-Bild — nicht das was in Prod läuft.
// -----------------------------------------------------------------------------
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const finalConfig = shouldEnableSentry
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;

export default withBundleAnalyzer(finalConfig);
