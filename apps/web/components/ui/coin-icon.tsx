// CoinIcon — zentrale SERLO-Münze fürs Web (ersetzt 🪙-Emoji / Lucide-Coins).
// Plain <img> auf /serlo-coin.png (Asset in public/). Größe via className (h-4 w-4 …).
export function CoinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/serlo-coin.png"
      alt=""
      aria-hidden="true"
      className={`inline-block shrink-0 object-contain ${className}`}
    />
  );
}
