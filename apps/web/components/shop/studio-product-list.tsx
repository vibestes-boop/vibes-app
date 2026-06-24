"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Trash2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudioProductRow } from "./studio-product-row";
import { useBulkDeleteProducts } from "@/hooks/use-shop";
import type { ShopProduct } from "@/lib/data/shop";

// -----------------------------------------------------------------------------
// StudioProductList — Produkt-Liste mit optionalem Auswahl-Modus (Häkchen) zum
// Mehrfach-Löschen. Ohne Auswahl-Modus identisch zur bisherigen Liste.
// -----------------------------------------------------------------------------

export function StudioProductList({
  products,
  isAdmin,
}: {
  products: ShopProduct[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkDel = useBulkDeleteProducts();

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = products.length > 0 && selected.size === products.length;
  const selectAll = () =>
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const doDelete = () =>
    bulkDel.mutate(Array.from(selected), {
      onSuccess: () => {
        setConfirmOpen(false);
        exitSelect();
        router.refresh();
      },
    });

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex min-h-[2rem] items-center justify-between gap-2">
        {selectMode ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                {allSelected ? "Keine" : "Alle"}
              </button>
              <span className="tabular-nums text-muted-foreground">
                {selected.size} ausgewählt
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={selected.size === 0 || bulkDel.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Löschen
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelect}>
                <X className="h-4 w-4" />
                Fertig
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <CheckSquare className="h-4 w-4" />
            Auswählen
          </button>
        )}
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {products.map((p) => (
          <StudioProductRow
            key={p.id}
            product={p}
            isAdmin={isAdmin}
            selectable={selectMode}
            selected={selected.has(p.id)}
            onToggleSelected={() => toggle(p.id)}
          />
        ))}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected.size} {selected.size === 1 ? "Produkt" : "Produkte"} löschen?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Die ausgewählten Produkte werden dauerhaft entfernt. Diese Aktion kann
            nicht rückgängig gemacht werden.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={bulkDel.isPending}
              onClick={doDelete}
            >
              {bulkDel.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Löschen"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
