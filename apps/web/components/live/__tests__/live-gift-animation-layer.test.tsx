/**
 * @jest-environment jsdom
 *
 * Unit-Tests für `components/live/live-gift-animation-layer.tsx` (v1.w.UI.17).
 *
 * Scope:
 *   - Presentational `LiveGiftAnimationView` rendert Container + N Bursts
 *     proportional zur `bursts`-Prop-Länge
 *   - Jeder Burst zeigt Sender-Name, Gift-Name, Coin-Cost (toLocaleString('de-DE'))
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

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
});

function makeBurst(overrides: Partial<LiveGiftBurst> = {}): LiveGiftBurst {
  return {
    id: 'g-1',
    giftId: null,
    senderName: 'Zaur',
    giftName: 'Rose',
    giftImage: null,
    giftEmoji: null,
    giftLottieUrl: null,
    giftVideoUrl: null,
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

  it('zeigt keine Bursts bei leerer bursts-Prop', () => {
    render(<LiveGiftAnimationView bursts={[]} />);
    expect(screen.queryAllByTestId('gift-burst')).toHaveLength(0);
  });

  it('rendert N Bursts proportional zur bursts-Prop-Länge', () => {
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

describe('LiveGiftAnimationView — Burst Content', () => {
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
    expect(screen.getByText('Aisha')).not.toBeNull();
    // de-DE formatiert 12500 als "12.500"
    expect(screen.getByText('Goldherz')).not.toBeNull();
    expect(screen.getByText(/12\.500/)).not.toBeNull();
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

describe('LiveGiftAnimationView — Styling-Invarianten', () => {
  it('trägt die animate-gift-burst-Klasse für die Keyframe-Animation', () => {
    render(<LiveGiftAnimationView bursts={[makeBurst()]} />);
    const card = screen.getByTestId('gift-burst');
    expect(card.className).toContain('animate-gift-burst');
  });

  it('rendert Premium-Video-Geschenke als Stage-Video statt Burst-Karte', () => {
    render(
      <LiveGiftAnimationView
        bursts={[
          makeBurst({
            giftId: 'chechen_tower_premium',
            giftVideoUrl: '/gifts/chechen_tower_premium.mp4',
          }),
        ]}
      />,
    );

    const layer = screen.getByTestId('gift-animation-layer');
    const stage = screen.getByTestId('premium-gift-stage');
    const video = screen.getByTestId('premium-gift-video');
    expect(layer.getAttribute('aria-hidden')).toBeNull();
    expect(stage).not.toBeNull();
    expect(stage.className).toContain('h-[58%]');
    expect(stage.className).toContain('overflow-visible');
    expect(stage.className).toContain('z-50');
    expect(video.getAttribute('src')).toBe('/gifts/chechen_tower_premium.mp4');
    expect(video.getAttribute('preload')).toBe('auto');
    expect(video.className).toContain('max-h-[720px]');
    expect(video.className).toContain('max-w-[118%]');
    expect(screen.queryByTestId('gift-burst')).toBeNull();
  });
});
