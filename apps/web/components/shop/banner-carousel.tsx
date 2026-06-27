"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ShopBanner } from "@/lib/data/shop";

// -----------------------------------------------------------------------------
// BannerCarousel — Werbe-Banner auf der Shop-Katalog-Seite (Parität mit der App).
// Auto-Swipe (4.5s) + Punkte + Klick → Ziel. Vermietbare Fläche / eigene Promos
// (shop_banners). Reine Anzeige; Impression-/Klick-Zähler kommen mit dem Ad-Server.
// -----------------------------------------------------------------------------

const REAL_CATEGORIES = new Set(["physical", "digital", "service", "collectible"]);

// App-Links ('tab:<key>') auf Web-Routen abbilden; '/route' + 'http' direkt.
function resolveHref(link: string | null): { href: string; external: boolean } | null {
  if (!link) return null;
  if (link.startsWith("http")) return { href: link, external: true };
  if (link.startsWith("/")) return { href: link, external: false };
  if (link.startsWith("tab:")) {
    const key = link.slice(4);
    if (REAL_CATEGORIES.has(key)) return { href: `/shop?category=${key}`, external: false };
    if (key === "sale") return { href: "/shop?sale=1", external: false };
    return { href: "/shop", external: false };
  }
  return null;
}

export function BannerCarousel({ banners }: { banners: ShopBanner[] }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const count = banners.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (count <= 1) return;
    timer.current = setInterval(() => setIdx((i) => (i + 1) % count), 4500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [count]);

  if (count === 0) return null;
  const active = banners[Math.min(idx, count - 1)];
  const target = resolveHref(active.link);

  const go = () => {
    if (!target) return;
    if (target.external) window.open(target.href, "_blank", "noopener,noreferrer");
    else router.push(target.href as Route);
  };

  return (
    <div className="mb-6">
      <div
        role={target ? "button" : undefined}
        tabIndex={target ? 0 : undefined}
        onClick={go}
        onKeyDown={(e) => target && (e.key === "Enter" || e.key === " ") && go()}
        className={`relative h-32 w-full overflow-hidden rounded-2xl sm:h-40 ${target ? "cursor-pointer" : ""}`}
        style={{ backgroundColor: active.bg_color || "#1f2937" }}
      >
        {active.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
        <div className="relative flex h-full flex-col justify-center gap-1 px-5 sm:px-8">
          {active.tag && (
            <span className="w-fit rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              {active.tag}
            </span>
          )}
          <h2 className="max-w-[80%] text-lg font-bold leading-tight text-white sm:text-2xl">
            {active.title}
          </h2>
          {active.subtitle && (
            <p className="max-w-[80%] text-xs text-white/85 sm:text-sm">{active.subtitle}</p>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Banner ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
