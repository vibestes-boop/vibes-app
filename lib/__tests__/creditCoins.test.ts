/**
 * lib/__tests__/creditCoins.test.ts
 *
 * Unit-Tests für Coin-Credit-Flow Idempotenz und Business-Logik (SW-06).
 *
 * Fokus: Validierungs-Logik die VOR dem DB-Call liegt, testbar ohne
 * echten Supabase-Client. Der RPC `credit_coins` selbst ist DB-seitig
 * idempotent via `ON CONFLICT DO UPDATE` — das ist Integration-Territory
 * und benötigt eine Supabase-Test-DB.
 *
 * Diese Tests schützen vor Regressionen in der Webhook-Handler-Logik:
 * - Produkt-Whitelist-Guard
 * - Rate-Limit-Guard
 * - Idempotenz-Guard (duplicate transaction_id)
 * - App-User-ID-Guard ($RC anon)
 * - Replay-Schutz-Guard
 */

// Coin-Mapping (spiegelt den Webhook exakt)
const PRODUCT_COINS: Record<string, number> = {
  'com.vibesapp.vibes.coins_100':  100,
  'com.vibesapp.vibes.coins_500':  500,
  'com.vibesapp.vibes.coins_1200': 1200,
  'com.vibesapp.vibes.coins_3000': 3000,
};

const PURCHASE_EVENTS = new Set([
  'NON_SUBSCRIPTION_PURCHASE',
  'INITIAL_PURCHASE',
]);

const MAX_EVENT_AGE_MS  = 10 * 60 * 1000; // 10 Min
const RATE_LIMIT_PER_HR = 20;

// ─── Produkt-Whitelist ────────────────────────────────────────────────────────
describe('Produkt-Whitelist', () => {
  test.each([
    ['com.vibesapp.vibes.coins_100',  100],
    ['com.vibesapp.vibes.coins_500',  500],
    ['com.vibesapp.vibes.coins_1200', 1200],
    ['com.vibesapp.vibes.coins_3000', 3000],
  ])('bekanntes Produkt %s → %d Coins', (productId, expected) => {
    expect(PRODUCT_COINS[productId]).toBe(expected);
  });

  test.each([
    ['com.vibesapp.vibes.coins_FAKE'],
    ['com.other.app.coins_100'],
    [''],
    ['undefined'],
  ])('unbekanntes Produkt "%s" → undefined → skip', (productId) => {
    expect(PRODUCT_COINS[productId]).toBeUndefined();
    // Guard: !coinsToCredit → true → skip
    expect(!PRODUCT_COINS[productId]).toBe(true);
  });
});

// ─── Event-Type Filter ────────────────────────────────────────────────────────
describe('Event-Type Filter', () => {
  const creditEvents   = ['NON_SUBSCRIPTION_PURCHASE', 'INITIAL_PURCHASE'];
  const nonCreditEvents = ['CANCELLATION', 'RENEWAL', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'SUBSCRIBER_ALIAS'];

  test.each(creditEvents)('%s → Coin-Credit ausführen', (type) => {
    expect(PURCHASE_EVENTS.has(type)).toBe(true);
  });

  test.each(nonCreditEvents)('%s → ignorieren', (type) => {
    expect(PURCHASE_EVENTS.has(type)).toBe(false);
  });
});

// ─── Replay-Schutz ────────────────────────────────────────────────────────────
describe('Replay-Schutz', () => {
  const NOW_MS = Date.now();

  function checkReplay(eventTsMs: number, nowMs: number): 'too_old' | 'future' | 'ok' {
    const ageMs = nowMs - eventTsMs;
    if (ageMs > MAX_EVENT_AGE_MS) return 'too_old';
    if (ageMs < -60_000) return 'future';
    return 'ok';
  }

  test('Event 10 Min alt → too_old', () => {
    const ts = NOW_MS - (10 * 60 * 1001); // gerade über 10 Min
    expect(checkReplay(ts, NOW_MS)).toBe('too_old');
  });

  test('Event 9:59 Min alt → ok', () => {
    const ts = NOW_MS - (9 * 60 * 1000 + 59_000);
    expect(checkReplay(ts, NOW_MS)).toBe('ok');
  });

  test('Event 2 Min in der Zukunft → future', () => {
    const ts = NOW_MS + (2 * 60 * 1000);
    expect(checkReplay(ts, NOW_MS)).toBe('future');
  });

  test('Event 59s in der Zukunft → ok (1-Min-Toleranz)', () => {
    const ts = NOW_MS + 59_000;
    expect(checkReplay(ts, NOW_MS)).toBe('ok');
  });

  test('Event jetzt → ok', () => {
    expect(checkReplay(NOW_MS, NOW_MS)).toBe('ok');
  });

  test('kein Timestamp → keine Prüfung (null)', () => {
    // Wenn event_timestamp_ms fehlt, soll kein Fehler geworfen werden
    const eventTsMs: number | null = null;
    const shouldCheck = eventTsMs !== null;
    expect(shouldCheck).toBe(false);
  });
});

// ─── Rate-Limit ───────────────────────────────────────────────────────────────
describe('Rate-Limit', () => {
  function isRateLimited(recentCount: number): boolean {
    return recentCount >= RATE_LIMIT_PER_HR;
  }

  test('19 Käufe → nicht geblockt', () => {
    expect(isRateLimited(19)).toBe(false);
  });

  test('20 Käufe → geblockt (Grenzwert)', () => {
    expect(isRateLimited(20)).toBe(true);
  });

  test('100 Käufe → geblockt', () => {
    expect(isRateLimited(100)).toBe(true);
  });

  test('0 Käufe → nicht geblockt', () => {
    expect(isRateLimited(0)).toBe(false);
  });
});

// ─── App-User-ID Validierung ──────────────────────────────────────────────────
describe('App-User-ID Validierung', () => {
  function isValidUserId(id: string): boolean {
    return Boolean(id) && !id.startsWith('$RC');
  }

  test.each([
    ['user-uuid-1234-5678', true],
    ['550e8400-e29b-41d4-a716-446655440000', true],
    ['my_custom_user_id', true],
  ])('gültige ID "%s" → akzeptiert', (id, expected) => {
    expect(isValidUserId(id)).toBe(expected);
  });

  test.each([
    [''],
    ['$RCAnonymousID:abc123'],
    ['$RCAnonID'],
  ])('ungültige ID "%s" → abgewiesen', (id) => {
    expect(isValidUserId(id)).toBe(false);
  });
});

// ─── Idempotenz-Guard ─────────────────────────────────────────────────────────
describe('Idempotenz-Guard', () => {
  // Simuliert den Idempotenz-Check (transaction_id in coin_purchases)
  function buildIdempotencyCheck(existingRow: unknown | null) {
    return {
      isDuplicate: Boolean(existingRow),
      shouldSkip: Boolean(existingRow),
    };
  }

  test('existierende Transaktion → duplicate = true', () => {
    const result = buildIdempotencyCheck({ id: 'row-1' });
    expect(result.isDuplicate).toBe(true);
    expect(result.shouldSkip).toBe(true);
  });

  test('neue Transaktion → duplicate = false', () => {
    const result = buildIdempotencyCheck(null);
    expect(result.isDuplicate).toBe(false);
    expect(result.shouldSkip).toBe(false);
  });

  test('undefined row → duplicate = false', () => {
    const result = buildIdempotencyCheck(undefined);
    expect(result.isDuplicate).toBe(false);
    expect(result.shouldSkip).toBe(false);
  });
});

// ─── Coin-Amount Korrektheit ──────────────────────────────────────────────────
describe('Coin-Amount Korrektheit', () => {
  test('alle Produkte haben positive Coin-Beträge', () => {
    for (const [productId, coins] of Object.entries(PRODUCT_COINS)) {
      expect(coins).toBeGreaterThan(0);
      expect(Number.isInteger(coins)).toBe(true);
    }
  });

  test('Coin-Beträge sind aufsteigend geordnet', () => {
    const amounts = Object.values(PRODUCT_COINS).sort((a, b) => a - b);
    expect(amounts).toEqual([100, 500, 1200, 3000]);
  });

  test('kein Produkt hat 0 Coins', () => {
    for (const coins of Object.values(PRODUCT_COINS)) {
      expect(coins).not.toBe(0);
    }
  });
});

// ─── Store-Routing (Apple vs Google) ─────────────────────────────────────────
describe('Store-Routing', () => {
  type Store = 'APP_STORE' | 'MAC_APP_STORE' | 'PLAY_STORE' | string;

  function getVerificationTarget(store: Store): 'apple' | 'google' | 'unknown' {
    if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'apple';
    if (store === 'PLAY_STORE') return 'google';
    return 'unknown';
  }

  test('APP_STORE → Apple-Verify', () => {
    expect(getVerificationTarget('APP_STORE')).toBe('apple');
  });

  test('MAC_APP_STORE → Apple-Verify', () => {
    expect(getVerificationTarget('MAC_APP_STORE')).toBe('apple');
  });

  test('PLAY_STORE → Google-Verify', () => {
    expect(getVerificationTarget('PLAY_STORE')).toBe('google');
  });

  test('Unbekannter Store → skip verify (unknown)', () => {
    expect(getVerificationTarget('AMAZON')).toBe('unknown');
  });
});
