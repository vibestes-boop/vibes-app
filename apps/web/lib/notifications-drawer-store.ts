'use client';

import { useSyncExternalStore } from 'react';

// -----------------------------------------------------------------------------
// notifications-drawer-store — globaler Open/Close-State für den
// Notifications-Drawer, dependency-frei via Reacts useSyncExternalStore.
//
// Vorher lief das über zustand — aber zustand ist nicht in apps/web/package.json
// deklariert (nur im Monorepo-Root, von der Mobile-App). Lokal löste das hoisted
// node_modules den Import auf, der isolierte Vercel-Build von apps/web jedoch
// nicht → „Module not found: Can't resolve 'zustand'". Da dies die einzige
// zustand-Nutzung im Web-Code war, ist ein eingebauter External-Store die
// schlankere Lösung (keine neue Dependency, kein Lockfile-Risiko).
//
// Identische Hook-API wie zuvor: useNotificationsDrawer() →
// { open, openDrawer, closeDrawer, toggleDrawer }.
// -----------------------------------------------------------------------------

let isOpen = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return isOpen;
}

// SSR/Hydration: Drawer startet immer geschlossen.
function getServerSnapshot(): boolean {
  return false;
}

// Stabile Action-Referenzen — außerhalb der Komponente, damit sich die
// Hook-Rückgabe nur ändert wenn sich `open` ändert.
const actions = {
  openDrawer: () => {
    if (!isOpen) {
      isOpen = true;
      emit();
    }
  },
  closeDrawer: () => {
    if (isOpen) {
      isOpen = false;
      emit();
    }
  },
  toggleDrawer: () => {
    isOpen = !isOpen;
    emit();
  },
};

export function useNotificationsDrawer() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { open, ...actions };
}
