// Preisvorschläge auf der Artikelseite — beide Sichten in einer Komponente.
//
// Der Käufer sieht genau einen Vorschlag (seinen), der Verkäufer alle. Das ist
// keine Fallunterscheidung im Client, sondern die RLS: Dieselbe Abfrage gibt
// jedem, was ihn angeht. Deshalb reicht hier eine Komponente mit `isSeller`.
//
// Bewusst KEIN eigener Bildschirm. Ein Vorschlag gehört an den Artikel, über
// den verhandelt wird — wer ihn auf einer Verwaltungsseite sucht, verhandelt
// nicht mehr.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Handshake } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { euroToCents } from '../lib/useStudio';
import { isOpen, type Offer } from '../lib/useOffers';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  offers: Offer[];
  isSeller: boolean;
  myUserId: string | null;
  /** Listenpreis — die Obergrenze für jeden Vorschlag. */
  priceCents: number;
  /** Angebot nimmt Vorschläge an und ist noch offen. */
  open: boolean;
  busy: boolean;
  onMake: (amountCents: number) => void;
  onRespond: (offerId: string, action: 'accept' | 'decline' | 'counter', counterCents?: number) => void;
  onWithdraw: (offerId: string) => void;
  /** Zusage einlösen — führt in den Kauf zum vereinbarten Preis. */
  onBuyAccepted: (offer: Offer) => void;
};

function statusText(offer: Offer): string {
  switch (offer.status) {
    case 'pending':
      return 'wartet auf Antwort';
    case 'accepted':
      return 'angenommen';
    case 'declined':
      return 'abgelehnt';
    case 'countered':
      return `Gegenvorschlag: ${formatEuro(offer.counter_cents)}`;
    case 'withdrawn':
      return 'zurückgezogen';
  }
}

export function OfferPanel({
  offers,
  isSeller,
  myUserId,
  priceCents,
  open,
  busy,
  onMake,
  onRespond,
  onWithdraw,
  onBuyAccepted,
}: Props) {
  const [draft, setDraft] = useState('');
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterDraft, setCounterDraft] = useState('');

  const cents = draft.trim() ? euroToCents(draft) : null;
  // Der Server lehnt beides ab — das vorher zu sagen ist freundlicher, als es
  // sich als Fehlermeldung abzuholen.
  const draftOk = cents !== null && cents > 100 && cents < priceCents;

  const mine = offers.find((o) => o.buyer_id === myUserId);
  const incoming = isSeller ? offers : [];

  // ── Käufer ────────────────────────────────────────────────────────────────
  if (!isSeller) {
    // Ein erledigter Vorschlag (abgelehnt, zurückgezogen) blockiert nicht: Der
    // Teil-Index lässt einen neuen zu, und wer abgelehnt wurde, darf es noch
    // einmal versuchen — das ist Handeln.
    if (mine && isOpen(mine)) {
      return (
        <View style={s.wrap}>
          <View style={s.head}>
            <Handshake size={16} color={ui.text} />
            <Text style={s.title}>Dein Vorschlag</Text>
          </View>
          <Text style={s.line}>
            {formatEuro(mine.amount_cents)} — {statusText(mine)}
          </Text>
          {mine.status === 'countered' ? (
            <Text style={s.hint}>
              Der Verkäufer schlägt {formatEuro(mine.counter_cents)} vor. Nimm ihn an, indem du
              einen neuen Vorschlag in dieser Höhe machst — oder zieh deinen zurück.
            </Text>
          ) : null}
          <Pressable
            style={s.ghost}
            disabled={busy}
            onPress={() => onWithdraw(mine.id)}
            accessibilityRole="button"
            accessibilityLabel="Vorschlag zurückziehen"
          >
            {busy ? (
              <ActivityIndicator color={ui.textMuted} />
            ) : (
              <Text style={s.ghostText}>Zurückziehen</Text>
            )}
          </Pressable>
        </View>
      );
    }

    if (mine && mine.status === 'accepted') {
      return (
        <View style={[s.wrap, s.wrapOk]}>
          <View style={s.head}>
            <Handshake size={16} color={ui.success} />
            <Text style={[s.title, { color: ui.success }]}>Angenommen</Text>
          </View>
          <Text style={s.line}>
            Der Verkäufer sagt {formatEuro(mine.amount_cents)} zu — nur für dich.
          </Text>
          <Pressable
            style={s.primary}
            disabled={busy}
            onPress={() => onBuyAccepted(mine)}
            accessibilityRole="button"
            accessibilityLabel={`Für ${formatEuro(mine.amount_cents)} kaufen`}
          >
            {busy ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <Text style={s.primaryText}>Für {formatEuro(mine.amount_cents)} kaufen</Text>
            )}
          </Pressable>
        </View>
      );
    }

    if (!open) return null;

    return (
      <View style={s.wrap}>
        <View style={s.head}>
          <Handshake size={16} color={ui.text} />
          <Text style={s.title}>Preis vorschlagen</Text>
        </View>
        {mine ? (
          <Text style={s.hint}>Dein letzter Vorschlag wurde {statusText(mine)}.</Text>
        ) : null}
        <View style={s.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Dein Preis in €"
            placeholderTextColor={ui.textMuted}
            keyboardType="decimal-pad"
            style={s.input}
          />
          <Pressable
            style={[s.send, !draftOk && s.off]}
            disabled={!draftOk || busy}
            onPress={() => {
              onMake(cents!);
              setDraft('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Vorschlag senden"
          >
            {busy ? (
              <ActivityIndicator color={ui.text} />
            ) : (
              <Text style={s.sendText}>Senden</Text>
            )}
          </Pressable>
        </View>
        {draft.trim() && !draftOk ? (
          <Text style={s.warn}>
            {cents !== null && cents >= priceCents
              ? 'Über dem Preis — dann kauf ihn lieber direkt. 🙂'
              : 'Über 1 € — darunter lohnt sich der Versand für niemanden.'}
          </Text>
        ) : null}
      </View>
    );
  }

  // ── Verkäufer ─────────────────────────────────────────────────────────────
  if (incoming.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Handshake size={16} color={ui.text} />
        <Text style={s.title}>Preisvorschläge</Text>
        <Text style={s.count}>{incoming.filter((o) => o.status === 'pending').length}</Text>
      </View>

      {incoming.map((offer) => (
        <View key={offer.id} style={s.offerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.line}>{formatEuro(offer.amount_cents)}</Text>
            <Text style={s.hint}>{statusText(offer)}</Text>
          </View>

          {offer.status === 'pending' ? (
            counterFor === offer.id ? (
              <View style={s.counterBox}>
                <TextInput
                  value={counterDraft}
                  onChangeText={setCounterDraft}
                  placeholder="Dein Preis"
                  placeholderTextColor={ui.textMuted}
                  keyboardType="decimal-pad"
                  style={[s.input, { width: 96 }]}
                  autoFocus
                />
                <Pressable
                  style={s.send}
                  disabled={busy}
                  onPress={() => {
                    const c = euroToCents(counterDraft);
                    if (c === null) return;
                    onRespond(offer.id, 'counter', c);
                    setCounterFor(null);
                    setCounterDraft('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Gegenvorschlag senden"
                >
                  <Text style={s.sendText}>OK</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.actions}>
                {/* Annehmen zuerst und als einziges gefüllt: Es ist die
                    Handlung, die zu Geld führt. Ablehnen ist eine Zeile, kein
                    Knopf — man soll nicht versehentlich absagen. */}
                <Pressable
                  style={s.accept}
                  disabled={busy}
                  onPress={() => onRespond(offer.id, 'accept')}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatEuro(offer.amount_cents)} annehmen`}
                >
                  <Text style={s.acceptText}>Annehmen</Text>
                </Pressable>
                <Pressable
                  style={s.small}
                  disabled={busy}
                  onPress={() => setCounterFor(offer.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Gegenvorschlag machen"
                >
                  <Text style={s.smallText}>Kontern</Text>
                </Pressable>
                <Pressable
                  style={s.small}
                  disabled={busy}
                  onPress={() => onRespond(offer.id, 'decline')}
                  accessibilityRole="button"
                  accessibilityLabel="Vorschlag ablehnen"
                >
                  <Text style={s.smallText}>Ablehnen</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    gap: space.sm,
  },
  /* Angenommen ist eine Bestätigung — grün, wie Frauen-Only und „du führst".
     Nicht gold: Gold ist der Kauf, und der kommt erst mit dem Knopf darin. */
  wrapOk: { borderColor: ui.success, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  line: { fontSize: 15, fontWeight: '700', color: ui.text },
  hint: { fontSize: 12, color: ui.textMuted, lineHeight: 17 },
  warn: { fontSize: 12, color: ui.live },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 15,
    color: ui.text,
  },
  send: {
    height: 42,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 14, fontWeight: '700', color: ui.text },
  off: { opacity: 0.45 },

  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 6,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  counterBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  accept: {
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { fontSize: 13, fontWeight: '700', color: ui.goldInk },
  small: { paddingVertical: 6, paddingHorizontal: 4 },
  smallText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },

  primary: {
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },

  ghost: {
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
});
