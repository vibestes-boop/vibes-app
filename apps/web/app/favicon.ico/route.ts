const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#F43F5E"/>
      <stop offset="100%" stop-color="#D946EF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#050508"/>
  <path d="M196 140c-40 0-72 32-72 72v16c0 32 20 56 48 68l72 28c20 8 32 24 32 44 0 24-20 44-48 44-24 0-44-12-52-32l-44 20c20 40 60 64 100 64 60 0 108-44 108-104 0-44-28-76-68-92l-60-24c-20-8-28-20-28-32 0-20 16-32 36-32 16 0 32 8 40 24l44-20c-16-32-48-52-84-52z" fill="url(#g)"/>
</svg>`;

export function GET() {
  return new Response(ICON_SVG, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/svg+xml; charset=utf-8',
    },
  });
}
