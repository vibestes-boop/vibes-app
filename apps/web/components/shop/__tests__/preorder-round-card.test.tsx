/**
 * @jest-environment jsdom
 *
 * PreorderRoundCard — Web-Parität zur mobilen GuildRoundCard. Fixiert, dass
 * alle i18n-Keys (shop.round.*) auflösen, die Fortschritts-Zahlen stimmen und
 * der „Ziel erreicht"-Zweig greift. Verifiziert die Komponente unabhängig von
 * der DB/RPC (die erst nach der Migration Daten liefert).
 */
import { render, screen } from '@testing-library/react';

import { PreorderRoundCard } from '../preorder-round-card';
import type { ActivePreorderRound } from '@/lib/data/shop';
import { TestI18nProvider } from '@/test-utils/i18n';

function makeRound(over: Partial<ActivePreorderRound> = {}): ActivePreorderRound {
  return {
    id: 'r1',
    product_id: 'p1',
    title: 'Fireside — Sammelrunde',
    target_qty: 80,
    closes_at: '2099-12-31T12:00:00Z',
    status: 'open',
    reserved_qty: 12,
    participant_count: 9,
    product: { id: 'p1', title: 'Fireside', cover_url: null, price_eur: 9.9 },
    ...over,
  };
}

function renderCard(round: ActivePreorderRound) {
  return render(
    <TestI18nProvider>
      <PreorderRoundCard round={round} />
    </TestI18nProvider>,
  );
}

describe('PreorderRoundCard', () => {
  it('zeigt Badge, Titel, reservierte Zahl und Teilnehmer', () => {
    renderCard(makeRound());
    expect(screen.getByText('Sammelbestellung läuft')).toBeInTheDocument();
    expect(screen.getByText('Fireside — Sammelrunde')).toBeInTheDocument();
    // RollupNumber startet bei 0 und zählt hoch → Ziel-Wert steht als aria-label fest.
    expect(screen.getByLabelText('12 von 80 reserviert')).toBeInTheDocument();
    expect(screen.getByText(/9 dabei/)).toBeInTheDocument();
  });

  it('zeigt den Ziel-erreicht-Zweig statt Deadline, wenn reserved >= target', () => {
    renderCard(makeRound({ reserved_qty: 80, target_qty: 80 }));
    expect(screen.getByText(/Ziel erreicht/)).toBeInTheDocument();
  });

  it('zeigt "Endet gleich", wenn die Deadline in der Vergangenheit liegt', () => {
    renderCard(makeRound({ closes_at: '2000-01-01T00:00:00Z' }));
    expect(screen.getByText('Endet gleich')).toBeInTheDocument();
  });
});
