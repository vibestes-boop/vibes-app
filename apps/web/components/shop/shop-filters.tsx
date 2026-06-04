"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  ArrowDownAZ,
  Boxes,
  FileText,
  Gem,
  LayoutGrid,
  Package,
  Percent,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductCategory } from "@shared/types";

// -----------------------------------------------------------------------------
// ShopFilters — Sidebar-Component für den Katalog. URL-driven State
// (SEO-friendly: filter zeigt in der URL, Teilbarkeit + Back/Forward).
// Jeder Filter-Klick macht `router.replace` innerhalb `useTransition`,
// damit der Feed-Grid per Server-Component neu rendert.
// -----------------------------------------------------------------------------

const CATEGORIES: Array<{
  id: ProductCategory | "all";
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "all", label: "Alle", Icon: LayoutGrid },
  { id: "physical", label: "Physisch", Icon: Package },
  { id: "digital", label: "Digital", Icon: FileText },
  { id: "service", label: "Service", Icon: Sparkles },
  { id: "collectible", label: "Collectibles", Icon: Gem },
];

const SORTS: Array<{ id: string; label: string }> = [
  { id: "popular", label: "Beliebt" },
  { id: "newest", label: "Neu" },
  { id: "price-asc", label: "Preis ↑" },
  { id: "price-desc", label: "Preis ↓" },
];

export function ShopFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const category = (params.get("category") ?? "all") as ProductCategory | "all";
  const sort = params.get("sort") ?? "popular";
  const onSaleOnly = params.get("sale") === "1";
  const freeShippingOnly = params.get("shipping") === "1";

  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";

  const applyParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const url = (qs ? `${pathname}?${qs}` : pathname) as Route;
      startTransition(() => router.replace(url));
    },
    [params, pathname, router],
  );

  const clearAll = () => {
    const q = params.get("q");
    const url = (pathname + (q ? `?q=${q}` : "")) as Route;
    startTransition(() => router.replace(url));
  };

  const anyActive =
    category !== "all" ||
    sort !== "popular" ||
    onSaleOnly ||
    freeShippingOnly ||
    minPrice !== "" ||
    maxPrice !== "";

  const renderFilters = () => (
    <>
      {/* Kategorien */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          Kategorie
        </div>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => applyParam({ category: c.id })}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition-colors",
                  active
                    ? "bg-foreground font-semibold text-background shadow-sm"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Sort */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ArrowDownAZ className="h-3.5 w-3.5" />
          Sortierung
        </div>
        <div className="flex flex-col gap-1">
          {SORTS.map((s) => {
            const active = sort === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => applyParam({ sort: s.id })}
                className={cn(
                  "h-9 rounded-xl px-3 text-left text-sm transition-colors",
                  active
                    ? "bg-foreground font-semibold text-background shadow-sm"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Toggle-Filter */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Boxes className="h-3.5 w-3.5" />
          Eigenschaften
        </div>
        <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted">
          <input
            type="checkbox"
            checked={onSaleOnly}
            onChange={(e) =>
              applyParam({ sale: e.target.checked ? "1" : null })
            }
            className="h-4 w-4 accent-foreground"
          />
          <Percent className="h-4 w-4 text-muted-foreground" />
          Nur im Sale
        </label>
        <label className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-muted">
          <input
            type="checkbox"
            checked={freeShippingOnly}
            onChange={(e) =>
              applyParam({ shipping: e.target.checked ? "1" : null })
            }
            className="h-4 w-4 accent-foreground"
          />
          <Truck className="h-4 w-4 text-muted-foreground" />
          Gratis Versand
        </label>
      </section>

      {/* Preis-Range */}
      <section className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          Preis (Coins)
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={minPrice}
            min={0}
            onBlur={(e) => applyParam({ min: e.target.value || null })}
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm tabular-nums"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={maxPrice}
            min={0}
            onBlur={(e) => applyParam({ max: e.target.value || null })}
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm tabular-nums"
          />
        </div>
      </section>
    </>
  );

  return (
    <aside
      className={cn(
        "border-b bg-card/50 p-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-6",
        isPending && "opacity-70",
      )}
      aria-label="Filter"
    >
      <details className="lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border bg-background px-4 py-3 text-sm font-semibold shadow-sm [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter & Sortierung
          </span>
          {anyActive && (
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
              aktiv
            </span>
          )}
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Katalog eingrenzen
            </h2>
            {anyActive && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Zurücksetzen
              </button>
            )}
          </div>
          {renderFilters()}
        </div>
      </details>

      <div className="hidden lg:flex lg:flex-col lg:gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Filter
          </h2>
          {anyActive && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Zurücksetzen
            </button>
          )}
        </div>
        {renderFilters()}
      </div>
    </aside>
  );
}
