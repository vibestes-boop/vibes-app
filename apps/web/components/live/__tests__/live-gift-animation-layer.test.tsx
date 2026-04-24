/**
 * @jest-environment jsdom
 *
 * Unit-Tests für `components/live/live-gift-animation-layer.tsx` (v1.w.UI.17).
 *
 * Scope:
 *   - Presentational `LiveGiftAnimationView` rendert Container + N Cards
 *     proportional zur `bursts`-Prop-Länge
 *   - Jede Card zeigt Sender-Name, Gift-Name, Coin-Cost (toLocaleString('de-DE'))
 *   - `giftImage=null` rendert den 🎁-Fallback statt <img>
 *   - `giftImage` gesetzt rendert <img src=…> (kein <Image/>-Wrapper weil
 *     CDN-URLs nicht in next.config allowlisted sind)
 *   - Lane-System: Burst mit lane=0/1/2 trägt die jeweilige `left-[X%]`-Klasse
 *   - Gesamt-Container ist `aria-hidden="true"` (Screen-Reader-Quiet-Zone)
 *   - CSS-Variable `--drift` wird aus der Burst-Prop propagiert
 *
 * Keine Jest-Tests auf den Subscription-Container `LiveGiftAnimationLayer` —
 * Supabase-Realtime-Mocking in jsdom ist fragil; die Integration wird über
 * die Sandbox-Assertion-Skripte + manuellen Smoke-Test auf Preview verifiziert.
 */

import { render, screen } from '@testing-library/react';
import {
  LiveGiftAnimationView,
  type LiveGiftBurst,
} from '../live-gift-animation-layer';

function makeBurst(overrides: Partial<LiveGiftBurst> = {}): LiveGiftBurst {
  return {
    id: 'g-1',
    senderName: 'Zaur',
    giftName: 'Rose',
    giftImage: null,
    coinCost: 50,
    lane: 0,
    drift: 10,
    ...overrides,
  };
}

describe('LiveGiftAnimationView — Container', () => {
  it('rendert den Layer als pointer-events-none aria-hidden Overlay', () => {
    render(<LiveGiftAnimationView bursts={[]} />);
    const layer = screen.getByTestId('gift-animation-layer');
    expect(layer).not.toBeNull();
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.className).toContain('pointer-events-none');
    expect(layer.className).toContain('absolute');
    expect(layer.className).toContain('inset-0');
  });

  it('zeigt keine Burst-Cards bei leerer bursts-Prop', () => {
    render(<LiveGiftAnimationView bursts={[]} />);
    expect(screen.queryAllByTestId('gift-burst')).toHaveLength(0);
  });

  it('rendert N Burst-Cards proportional zur bursts-Prop-Länge', () => {
    render(
      <LiveGiftAnimationView
        bursts={[
          makeBurst({ id: 'a', lane: 0 }),
          makeBurst({ id: 'b', lane: 1 }),
          makeBurst({ id: 'c', lane: 2 }),
        ]}
      />,
    );
    expect(screen.getAllByTestId('gift-burst')).toHaveLength(3);
  });
});

describe('LiveGiftAnimationView — Burst-Card Content', () => {
  it('zeigt Sender-Name, Gift-Name und Coin-Cost mit de-DE-Tausendertrenner', () => {
    render(
      <LiveGiftAnimationView
        bursts={[
          makeBurst({
            senderName: 'Aisha',
            giftName: 'Goldherz',
            coinCost: 12500,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Aisha')).toBeInTheDocument();
    // de-DE formatiert 12500 als "12.500"
    expect(screen.getByText(/Goldherz · 🪙 12\.500/)).toBeInTheDocument();
  });

  it('rendert <img> wenn giftImage gesetzt ist', () => {
    const { container } = render(
      <LiveGiftAnimationView
        bursts={[makeBurst({ giftImage: 'https://cdn.example.com/rose.png' })]}
      />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/rose.png');
    // Emoji-Fallback DARF nicht gleichzeitig mit <img> gerendert sein
    expect(container.textContent).not.toMatch(/🎁/);
  });

  it('rendert 🎁-Emoji-Fallback wenn giftImage null ist', () => {
    const { container } = render(
      <LiveGiftAnimationView bursts={[makeBurst({ giftImage: null })]} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('🎁');
  });
});

describe('LiveGiftAnimationView — Lane-Positioning', () => {
  it('lane=0 nutzt left-[10%]', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst({ lane: 0 })]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('left-[10%]');
  });

  it('lane=1 nutzt left-[36%]', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst({ lane: 1 })]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('left-[36%]');
  });

  it('lane=2 nutzt left-[60%]', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst({ lane: 2 })]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('left-[60%]');
  });
});

describe('LiveGiftAnimationView — Drift-CSS-Variable', () => {
  it('propagiert --drift aus der Burst-Prop', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst({ drift: -17 })]} />);
    const card = screen.getByTestId('gift-burst');
    // jsdom spiegelt inline-style auf style.cssText; wir prüfen das style-Attribut.
    expect(card.getAttribute('style')).toContain('--drift: -17px');
  });

  it('positive drift-Werte werden ebenfalls gesetzt', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst({ drift: 23 })]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.getAttribute('style')).toContain('--drift: 23px');
  });
});

describe('LiveGiftAnimationView — Card-Styling-Invarianten', () => {
  it('trägt die animate-gift-burst-Klasse für die Keyframe-Animation', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst()]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('animate-gift-burst');
  });

  it('nutzt shadow-elevation-3 (Token aus dem Design-System)', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst()]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('shadow-elevation-3');
  });

  it('Gradient from-amber-400 via to-pink-500 als Brand-Look', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst()]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('from-amber-400/95');
    expect(card.className).toContain('to-pink-500/95');
  });
});
