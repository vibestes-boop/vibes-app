'use client';

import { useEffect, useState } from 'react';
import { Heart, Flame, Laugh, Sparkles, Frown, HandMetal } from 'lucide-react';

// -----------------------------------------------------------------------------
// LiveReactionOverlay — floating-icons Animation. Per Reaction ein Icon,
// ~2s lang, driftet nach oben + fade-out. Pool-Cap bei 30, damit bei Spam
// keine DOM-Explosion entsteht.
//
// Wir zeigen NUR die eigenen Reactions. Andere User-Reactions zu zeigen
// wäre ein weiteres Realtime-Sub auf `live:{id}` Event `reaction` — kommt
// später wenn die UX-Tests das rechtfertigen (Performance-Kosten vs. Nutzen).
// -----------------------------------------------------------------------------

const ICONS = {
  heart: { Icon: Heart, color: 'text-rose-500' },
  fire: { Icon: Flame, color: 'text-orange-500' },
  clap: { Icon: HandMetal, color: 'text-amber-500' },
  laugh: { Icon: Laugh, color: 'text-yellow-500' },
  wow: { Icon: Sparkles, color: 'text-fuchsia-500' },
  sad: { Icon: Frown, color: 'text-sky-500' },
} as const;

interface FloatItem {
  id: number;
  key: keyof typeof ICONS;
  left: number;
  drift: number;
}

const MAX_ITEMS = 30;

export function LiveReactionOverlay({
  burst,
}: {
  burst: { key: string; id: number } | null;
}) {
  const [items, setItems] = useState<FloatItem[]>([]);

  // Neue Reaction in die Liste schieben
  useEffect(() => {
    if (!burst) return;
    const mapped = ICONS[burst.key as keyof typeof ICONS] ? (burst.key as keyof typeof ICONS) : 'heart';
    setItems((prev) => {
      const next = [
        ...prev,
        {
          id: burst.id,
          key: mapped,
          left: 30 + Math.random() * 40, // 30-70% horizontal
          drift: -20 + Math.random() * 40, // -20 bis +20px drift
        },
      ];
      return next.length > MAX_ITEMS ? next.slice(-MAX_ITEMS) : next;
    });

    // Auto-Entfernen nach 2.2s (Animation + Puffer)
    const timer = window.setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== burst.id));
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [burst]);

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-30 h-screen w-64 overflow-hidden lg:w-80">
      {items.map((item) => {
        const { Icon, color } = ICONS[item.key];
        return (
          <span
            key={item.id}
            className={`absolute bottom-10 animate-float-up ${color}`}
            style={
              {
                left: `${item.left}%`,
                '--drift': `${item.drift}px`,
              } as React.CSSProperties
            }
          >
            <Icon className="h-6 w-6 drop-shadow-lg" fill="currentColor" />
          </span>
        );
      })}

      {/* Keyframes inline, damit wir keinen Tailwind-Config-Eingriff brauchen */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            transform: translate(0, 0) scale(0.8);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--drift, 0), -380px) scale(1.1);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
