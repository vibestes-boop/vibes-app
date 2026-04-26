/**
 * @jest-environment jsdom
 */

// -----------------------------------------------------------------------------
// SearchBox — v1.w.UI.70 Test-Suite.
//
// Testet die SearchBox-Komponente aus `components/search-box.tsx` (v1.w.UI.48).
//
// Architektur-Überblick der Komponente:
//   1. Debounce 220ms → Fetch /api/search/quick
//   2. Dropdown: ≤5 User + ≤4 Hashtags + "Alle Ergebnisse"-Footer
//   3. Keyboard: ↑/↓ navigieren, Enter → Auswählen, Escape → Schließen
//   4. Mousedown-Outside → Dropdown schließen
//   5. Form-Submit / Enter ohne aktives Item → /search?q=…
//   6. Clear-Button (X) → Input leeren
//
// Mock-Strategie:
//   - next/navigation: useRouter → { push: mockRouterPush }
//     useTransition in React 18 ruft die Callback synchron, Router.push
//     wird also sofort nach fireEvent-Aufruf registriert.
//   - global.fetch: jest.fn() mit gesteuerten Responses
//   - next/image: avatar_url: null in allen Fixtures → img-Element wird
//     nicht gerendert, kein Image-Mock nötig.
//   - Fake Timers für den 220ms-Debounce (jest.useFakeTimers)
// -----------------------------------------------------------------------------

import { act, fireEvent, render, screen } from '@testing-library/react';
import { SearchBox } from '../search-box';

// ── next/navigation Mock ──────────────────────────────────────────────────────
const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Vollständige Ergebnisse: 2 User + 2 Hashtags */
const FULL_RESULTS = {
  users: [
    { id: 'u1', username: 'zaur_dev', display_name: 'Zaur', avatar_url: null, verified: false },
    { id: 'u2', username: 'ali_m',    display_name: 'Ali',  avatar_url: null, verified: true  },
  ],
  hashtags: [
    { tag: 'tschetschenien', post_count: 42 },
    { tag: 'tech',           post_count: 17 },
  ],
};

/** Nur Hashtags, keine User */
const HASHTAG_ONLY_RESULTS = { users: [], hashtags: [{ tag: 'serlo', post_count: 8 }] };

/** Komplett leer */
const EMPTY_RESULTS = { users: [], hashtags: [] };

function mockFetch(data: object, ok = true) {
  return jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

/** Timers vorrücken + Microtask-Queue leeren */
async function tickDebounce(ms = 250) {
  await act(async () => { jest.advanceTimersByTime(ms); });
  await act(async () => { await Promise.resolve(); });
}

// ── Grundrendering ────────────────────────────────────────────────────────────

describe('SearchBox — Grundrendering', () => {
  it('rendert das Suchfeld und keinen Dropdown initial', () => {
    render(<SearchBox />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('übernimmt initialQuery als Input-Wert', () => {
    render(<SearchBox initialQuery="hallo" />);
    expect(screen.getByRole('searchbox')).toHaveValue('hallo');
  });

  it('zeigt Clear-Button wenn Input nicht leer', () => {
    render(<SearchBox initialQuery="x" />);
    expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument();
  });

  it('zeigt keinen Clear-Button wenn Input leer', () => {
    render(<SearchBox />);
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument();
  });
});

// ── Clear-Button ──────────────────────────────────────────────────────────────

describe('SearchBox — Clear-Button', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('leert den Input und entfernt den Dropdown', async () => {
    global.fetch = mockFetch(FULL_RESULTS);
    render(<SearchBox initialQuery="za" />);
    // Debounce laufen lassen und Dropdown öffnen
    await tickDebounce();

    // Clear klicken
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }));

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// ── Debounce + Fetch ──────────────────────────────────────────────────────────

describe('SearchBox — Debounce + Fetch (v1.w.UI.48)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterPush.mockClear();
    global.fetch = mockFetch(FULL_RESULTS);
  });
  afterEach(() => jest.useRealTimers());

  it('triggert keinen Fetch bei 1-Zeichen-Eingabe', async () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    await tickDebounce();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('triggert Fetch erst nach 220ms Debounce bei ≥2 Zeichen', async () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'za' } });

    // Noch vor dem Timeout: kein Fetch
    expect(global.fetch).not.toHaveBeenCalled();

    await tickDebounce();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/quick?q=za'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('debounced mehrere schnelle Eingaben zu einem einzigen Fetch', async () => {
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');

    fireEvent.change(input, { target: { value: 'z' } });
    fireEvent.change(input, { target: { value: 'za' } });
    fireEvent.change(input, { target: { value: 'zau' } });

    await tickDebounce();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=zau'),
      expect.anything(),
    );
  });

  it('triggert keinen weiteren Fetch wenn Input auf <2 Zeichen gekürzt wird', async () => {
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');

    // Erst Fetch auslösen
    fireEvent.change(input, { target: { value: 'za' } });
    await tickDebounce();
    (global.fetch as jest.Mock).mockClear();

    // Dann auf ein Zeichen kürzen
    fireEvent.change(input, { target: { value: 'z' } });
    await tickDebounce();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── Dropdown-Rendering ────────────────────────────────────────────────────────

describe('SearchBox — Dropdown-Rendering', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function renderAndOpen(query = 'za', results = FULL_RESULTS) {
    global.fetch = mockFetch(results);
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
    await tickDebounce();
  }

  it('öffnet Listbox mit User-Einträgen wenn Nutzer gefunden', async () => {
    await renderAndOpen();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('@zaur_dev')).toBeInTheDocument();
    expect(screen.getByText('@ali_m')).toBeInTheDocument();
  });

  it('zeigt Hashtag-Einträge wenn Hashtags gefunden', async () => {
    await renderAndOpen();
    expect(screen.getByText('#tschetschenien')).toBeInTheDocument();
    expect(screen.getByText('#tech')).toBeInTheDocument();
  });

  it('zeigt "Alle Ergebnisse"-Footer im Dropdown', async () => {
    await renderAndOpen('za');
    expect(screen.getByText(/Alle Ergebnisse/i)).toBeInTheDocument();
    expect(screen.getByText(/„za"/)).toBeInTheDocument();
  });

  it('öffnet Dropdown auch wenn nur Hashtags (keine User) gefunden', async () => {
    await renderAndOpen('serlo', HASHTAG_ONLY_RESULTS);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('#serlo')).toBeInTheDocument();
  });

  it('zeigt keinen Dropdown wenn Ergebnisse komplett leer', async () => {
    await renderAndOpen('xyzxyz', EMPTY_RESULTS);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('zeigt keinen Dropdown bei fehlgeschlagenem Fetch (ok: false)', async () => {
    global.fetch = mockFetch({}, false);
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'za' } });
    await tickDebounce();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// ── Keyboard-Navigation ───────────────────────────────────────────────────────

describe('SearchBox — Keyboard-Navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterPush.mockClear();
    global.fetch = mockFetch(FULL_RESULTS);
  });
  afterEach(() => jest.useRealTimers());

  /** Dropdown öffnen, Input-Element zurückgeben */
  async function setup(query = 'za') {
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: query } });
    await tickDebounce();
    return input;
  }

  it('ArrowDown wählt erstes Option-Element', async () => {
    const input = await setup();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    // restliche items nicht aktiv
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('ArrowDown zweimal wählt zweites Element', async () => {
    const input = await setup();
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // idx 0
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // idx 1
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp auf idx -1 bleibt bei keiner aktiven Auswahl', async () => {
    const input = await setup();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    // alle aria-selected=false: niemand ist aktiv
    expect(options.every(o => o.getAttribute('aria-selected') === 'false')).toBe(true);
  });

  it('ArrowDown kann nicht über das letzte Item hinaus', async () => {
    const input = await setup();
    // FULL_RESULTS: 2 user + 2 hashtag + 1 all = 5 items (idx 0-4)
    for (let i = 0; i < 10; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    // Letztes Item (idx 4) aktiv
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Escape schließt Dropdown', async () => {
    const input = await setup();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Enter auf User-Item navigiert zu /u/[username]', async () => {
    const input = await setup();
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // idx 0 = zaur_dev
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRouterPush).toHaveBeenCalledWith('/u/zaur_dev');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Enter auf Hashtag-Item navigiert zu /t/[tag]', async () => {
    const input = await setup();
    // idx 0 = zaur_dev, idx 1 = ali_m, idx 2 = tschetschenien
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 0
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 1
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // 2 = tschetschenien
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRouterPush).toHaveBeenCalledWith('/t/tschetschenien');
  });

  it('Enter auf "Alle Ergebnisse" navigiert zu /search?q=...', async () => {
    const input = await setup();
    // idx 4 = "Alle Ergebnisse" — 5× ArrowDown von idx -1
    for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=za'),
    );
  });

  it('Enter ohne aktives Item gibt keine Navigation aus', async () => {
    const input = await setup();
    // activeIdx = -1, Enter tut nichts
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});

// ── Klick-Navigation ──────────────────────────────────────────────────────────

describe('SearchBox — Klick-Navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterPush.mockClear();
    global.fetch = mockFetch(FULL_RESULTS);
  });
  afterEach(() => jest.useRealTimers());

  async function openDropdown(query = 'za') {
    render(<SearchBox />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
    await tickDebounce();
  }

  it('Klick auf User navigiert zu /u/[username]', async () => {
    await openDropdown();
    // options[0] = zaur_dev
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(mockRouterPush).toHaveBeenCalledWith('/u/zaur_dev');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Klick auf zweiten User navigiert zu /u/[username]', async () => {
    await openDropdown();
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(mockRouterPush).toHaveBeenCalledWith('/u/ali_m');
  });

  it('Klick auf Hashtag navigiert zu /t/[tag]', async () => {
    await openDropdown();
    // options[2] = tschetschenien
    fireEvent.click(screen.getAllByRole('option')[2]!);
    expect(mockRouterPush).toHaveBeenCalledWith('/t/tschetschenien');
  });

  it('Klick auf "Alle Ergebnisse" navigiert zu /search?q=za', async () => {
    await openDropdown();
    const options = screen.getAllByRole('option');
    fireEvent.click(options[options.length - 1]!);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=za'),
    );
  });
});

// ── Form-Submit ───────────────────────────────────────────────────────────────

describe('SearchBox — Form-Submit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouterPush.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('Form-Submit navigiert zu /search?q=... wenn kein Item aktiv', () => {
    global.fetch = mockFetch(EMPTY_RESULTS);
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'za' } });
    fireEvent.submit(input.closest('form')!);
    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining('/search?q=za'),
    );
  });

  it('Form-Submit tut nichts wenn Input <2 Zeichen hat', () => {
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'z' } });
    fireEvent.submit(input.closest('form')!);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('Form-Submit mit aktivem Item wählt dieses aus (kein Search-Navigate)', async () => {
    global.fetch = mockFetch(FULL_RESULTS);
    render(<SearchBox />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'za' } });
    await tickDebounce();

    // Erstes Item aktivieren via ArrowDown
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.submit(input.closest('form')!);

    // Navigiert zu User-Profil, nicht zu /search
    expect(mockRouterPush).toHaveBeenCalledWith('/u/zaur_dev');
    expect(mockRouterPush).not.toHaveBeenCalledWith(
      expect.stringContaining('/search'),
    );
  });
});
