import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

// One native subscription for the app, including long lists of press targets.
// Until the system answers, keep motion off rather than briefly overriding it.
let reduced = true;
let revision = 0;
let stop: (() => void) | undefined;
const listeners = new Set<() => void>();
const snapshot = () => reduced;
const serverSnapshot = () => true;

function publish(value: boolean) {
  if (reduced === value) return;
  reduced = value;
  listeners.forEach(listener => listener());
}

function refresh() {
  const request = ++revision;
  void AccessibilityInfo.isReduceMotionEnabled().then(value => {
    if (request === revision && listeners.size) publish(value);
  }).catch(() => {
    if (request === revision && listeners.size) publish(true);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      ++revision; // A late initial read must not overwrite a newer system event.
      publish(value);
    });
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    stop = () => { motion.remove(); app.remove(); };
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { ++revision; stop?.(); stop = undefined; }
  };
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
