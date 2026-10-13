import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSlidingSelection } from '../SlidingSelection';

// Reanimated-Mock mit Werten, die über Renders bestehen bleiben; withSpring springt
// sofort ans Ziel. Geprüft wird, wohin die Kapsel gleitet, nicht wie.
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  const { useRef } = jest.requireActual('react');
  return {
    ...mock,
    useSharedValue: (init: unknown) => {
      const ref = useRef(null);
      if (!ref.current) ref.current = { value: init };
      return ref.current;
    },
    withSpring: (to: number) => to,
  };
});

type Selection = ReturnType<typeof useSlidingSelection>;
const layout = (x: number, width: number, y = 0, height = 40) =>
  ({ nativeEvent: { layout: { x, y, width, height } } }) as unknown as LayoutChangeEvent;

function Probe({ selected, persistKey, underline, onSel }: { selected: string | null; persistKey?: string; underline?: number; onSel: (s: Selection) => void }) {
  onSel(useSlidingSelection(selected, { persistKey, underline }));
  return null;
}

function setup(selected: string | null, opts: { persistKey?: string; underline?: number } = {}) {
  let sel!: Selection;
  const screen = render(<Probe selected={selected} {...opts} onSel={(s) => { sel = s; }} />);
  const lay = (key: string, x: number, width: number) => act(() => { sel.onLayoutFor(key)(layout(x, width)); });
  return { screen, get sel() { return sel; }, lay, rerender: (next: string | null) => screen.rerender(<Probe selected={next} {...opts} onSel={(s) => { sel = s; }} />) };
}

it('legt die Kapsel auf die gewählte Option, sobald deren Lage bekannt ist', () => {
  const t = setup('b');
  expect(t.sel.visible).toBe(false);
  t.lay('a', 0, 80);
  t.lay('b', 90, 100);
  expect(t.sel.visible).toBe(true);
  expect(t.sel.shown.value).toBe(1);
  expect(t.sel.x.value).toBe(90);
  expect(t.sel.w.value).toBe(100);
});

it('gleitet beim Wechsel zur neuen Option und versteckt sich ohne Auswahl', () => {
  const t = setup('a');
  t.lay('a', 0, 80);
  t.lay('b', 90, 100);
  t.rerender('b');
  expect(t.sel.x.value).toBe(90);
  t.rerender(null);
  expect(t.sel.visible).toBe(false);
  expect(t.sel.shown.value).toBe(0);
});

it('behandelt einen leeren Schlüssel als Option (z. B. „Alle“)', () => {
  const t = setup('');
  t.lay('', 12, 70);
  expect(t.sel.visible).toBe(true);
  expect(t.sel.x.value).toBe(12);
});

it('setzt eine Unterstreichung an den unteren Rand der Option', () => {
  const t = setup('a', { underline: 2 });
  t.lay('a', 0, 80);
  expect(t.sel.y.value).toBe(38);
  expect(t.sel.h.value).toBe(2);
});

it('startet nach dem Neu-Einhängen an der alten Stelle (persistKey)', () => {
  const first = setup('a', { persistKey: 'test-tabs' });
  first.lay('a', 200, 80);
  first.screen.unmount();
  const second = setup('b', { persistKey: 'test-tabs' });
  expect(second.sel.visible).toBe(true);
  expect(second.sel.x.value).toBe(200);
  second.lay('b', 20, 80);
  expect(second.sel.x.value).toBe(20);
});
