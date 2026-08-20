// Was an einem angekündigten Abend drankommt — die Käufer-Sicht auf das
// Vorbereitete.
//
// WARUM ES DAS BRAUCHT
// Abschnitt 48 hat die Verkäufer-Hälfte gebaut: Artikel lassen sich vor der Show
// anlegen. Der Sinn davon liegt aber auf der anderen Seite — „Käufer sehen die
// Artikel vor dem Start, das ist der Grund, warum sich Vorbereiten lohnt"
// (HANDOFF 26, Schritt 3). Ohne diese Ansicht wäre die ganze Vorbereitung ein
// Verkäufer-Werkzeug ohne Publikum: Die „Demnächst"-Karte zeigt drei
// Vorschaubilder und eine Zahl, aber wer wissen will, WAS kommt, kam nirgends
// hin.
//
// ⚠️ Kein Kaufweg und keine eigene Route. Ein vorbereiteter Artikel ist nichts,
// was man kaufen kann — er hat einen Startpreis, keine laufende Uhr und keine
// Session. Ihn auf `/listing/<id>` zu schicken wäre falsch: Diese Seite ist die
// Fläche für die Vertragserklärung (HANDOFF 21), und hier gibt es keine. Ein
// Blatt sagt „schau her, das kommt" — und ist zugleich der Ort, an dem später
// die Glocke („sag mir, wenn der drankommt") und das Vorabgebot sitzen werden.

import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bell, BellRing, Gavel, X } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import type { PreparedAuction } from '../lib/usePrepared';
import { prebidErrorText, useMyPrebid, usePrebidActions } from '../lib/usePrebid';
import { reminderErrorText, useMyReminder, useReminderActions } from '../lib/useReminders';
import { useSession } from '../lib/session';
import { euroToCents } from '../lib/useStudio';
import { BerkatMark } from './BerkatMark';
import { radius, ratio, space, ui } from '../theme/tokens';

type Props = {
  items: PreparedAuction[];
  /** „morgen 20:00" — kommt fertig aus `showWhen()`, hier wird nicht gerechnet. */
  when: string;
};

export function LineupPreview({ items, when }: Props) {
  const [peek, setPeek] = useState<PreparedAuction | null>(null);
  if (items.length === 0) return null;

  return (
    <View style={s.wrap}>
      {/* Die Überschrift nennt die ZAHL, nicht nur „Vorschau": Sie ist der
          Unterschied zwischen „da kommt was" und „da kommen elf Sachen". */}
      <Text style={s.head}>
        {items.length === 1 ? '1 Artikel dabei' : `${items.length} Artikel dabei`}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
            onPress={() => setPeek(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ab ${formatEuro(item.start_price_cents)}`}
          >
            <View style={s.thumb}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : (
                // Kein Platzhalter-Foto — dieselbe Entscheidung wie bei der
                // Termin-Karte ohne Cover: Ein Standardbild für alle sähe aus
                // wie ein Fehler.
                <BerkatMark size={22} color={ui.lineStrong} />
              )}
            </View>
            <Text numberOfLines={2} style={s.tileTitle}>
              {item.title}
            </Text>
            {/* „ab" ist hier kein Schmuckwort: Es ist ein Startpreis, kein
                Preis. Ohne das läse sich „5 €" wie ein Festpreis, und die
                Enttäuschung käme in der Show. */}
            <Text style={s.tilePrice}>ab {formatEuro(item.start_price_cents)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={peek !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPeek(null)}
      >
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Kommt in der Show</Text>
            <Pressable
              hitSlop={10}
              onPress={() => setPeek(null)}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <X size={22} color={ui.text} />
            </Pressable>
          </View>

          {peek ? (
            <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
              <View style={s.hero}>
                {peek.image_url ? (
                  <Image
                    source={{ uri: peek.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={160}
                  />
                ) : (
                  <BerkatMark size={44} color={ui.lineStrong} />
                )}
              </View>

              <View style={s.body}>
                <Text style={s.price}>ab {formatEuro(peek.start_price_cents)}</Text>
                <Text style={s.title}>{peek.title}</Text>

                <View style={s.chips}>
                  {peek.size ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>Gr. {peek.size}</Text>
                    </View>
                  ) : null}
                  <View style={s.chip}>
                    <Text style={s.chipText}>
                      Schritt {formatEuro(peek.min_increment_cents)}
                    </Text>
                  </View>
                  {peek.buy_now_cents ? (
                    <View style={s.chip}>
                      <Text style={s.chipText}>
                        Sofort {formatEuro(peek.buy_now_cents)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Die ehrliche Auskunft. Sie steht hier, weil das Blatt sonst
                    wie eine Artikelseite aussähe, auf der nur der Kaufknopf
                    fehlt — und der Besucher suchte ihn. */}
                <Text style={s.note}>
                  Geboten wird live, {when}. Folge dem Verkäufer, dann erinnern wir dich
                  15 Minuten vorher.
                </Text>

                {/* Die zwei Handlungen, die aus dem Zusehen ein Mitmachen
                    machen — der leise Weg zuerst.

                    Eigene Komponenten, damit ihre Hooks nur laufen, solange das
                    Blatt offen ist, und damit der frühe `return null` oben keine
                    Hook-Reihenfolge bricht. */}
                <ReminderRow item={peek} />
                <PrebidPanel item={peek} when={when} />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

/**
 * „Sag mir Bescheid, wenn der drankommt."
 *
 * Der leise Weg, und für die meisten der richtige: Wer genau EINEN Artikel will,
 * will kein Höchstgebot abgeben — er will dabei sein, wenn der aufgerufen wird.
 * Deshalb steht die Glocke ÜBER dem Gebots-Feld: erst die Einladung, dann die
 * Verpflichtung.
 *
 * Eine Zeile, kein Kasten. Sie verspricht wenig und soll auch so aussehen —
 * der Kasten darunter ist der, in dem es um Geld geht.
 */
function ReminderRow({ item }: { item: PreparedAuction }) {
  const myUserId = useSession((state) => state.userId);
  const { data: on } = useMyReminder(item.id, myUserId);
  const { toggle } = useReminderActions(myUserId);
  const [notice, setNotice] = useState<string | null>(null);

  // Am eigenen Artikel gibt es nichts vorzumerken — die Policy lehnt es ab, und
  // ein Knopf, der garantiert scheitert, ist eine Einladung ins Leere.
  if (myUserId && myUserId === item.seller_id) return null;

  const active = Boolean(on);

  return (
    <View>
      <Pressable
        style={({ pressed }) => [s.remind, active && s.remindOn, pressed && { opacity: 0.7 }]}
        disabled={toggle.isPending}
        onPress={() => {
          if (!myUserId) {
            router.push('/login');
            return;
          }
          void toggle
            .mutateAsync({ auctionId: item.id, on: !active })
            .then(() => setNotice(null))
            .catch((error: unknown) =>
              setNotice(
                reminderErrorText(error instanceof Error ? error.message : String(error)),
              ),
            );
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={
          active ? 'Nicht mehr benachrichtigen' : 'Benachrichtige mich, wenn der Artikel drankommt'
        }
      >
        {active ? (
          <BellRing size={16} color={ui.success} />
        ) : (
          <Bell size={16} color={ui.text} />
        )}
        <Text style={[s.remindText, active && s.remindTextOn]}>
          {active ? 'Wir sagen dir Bescheid' : 'Sag mir Bescheid, wenn der drankommt'}
        </Text>
      </Pressable>
      {notice ? <Text style={s.prebidWarn}>{notice}</Text> : null}
    </View>
  );
}

/**
 * „Bis hierhin will ich gehen" — vor der Show.
 *
 * ⚠️ Das ist ein GEBOT, kein Merkzettel. Der Text sagt das deutlich, weil die
 * Fläche drumherum eine Vorschau ist: Wer hier eine Zahl einträgt, gibt eine
 * Willenserklärung ab, die der Server beim Start der Auktion einlöst. Deshalb
 * steht der Betrag danach als Zustand da („Dein Höchstgebot") und nicht als
 * Feld, das man versehentlich noch einmal absendet.
 *
 * Zurückziehen geht nur, solange die Auktion nicht läuft — die Begründung steht
 * in `usePrebid.ts` und im Kopf von `20260819150000`.
 */
function PrebidPanel({ item, when }: { item: PreparedAuction; when: string }) {
  const myUserId = useSession((state) => state.userId);
  const { data: myMax, isLoading } = useMyPrebid(item.id, myUserId);
  const { place, cancel } = usePrebidActions();
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Am eigenen Artikel gibt es nichts zu bieten — der Server lehnt es ohnehin
  // ab (`seller_cannot_bid`), aber ein Feld anzubieten, das garantiert scheitert,
  // wäre eine Einladung ins Leere.
  if (myUserId && myUserId === item.seller_id) return null;

  const cents = amount.trim() ? euroToCents(amount) : null;
  // Der Server verlangt mindestens den Startpreis. Das vorher zu sagen ist
  // freundlicher, als es sich als Fehlermeldung abzuholen.
  const enough = cents !== null && cents >= item.start_price_cents;
  const busy = place.isPending || cancel.isPending;

  if (isLoading) return null;

  if (myMax != null) {
    return (
      <View style={s.prebid}>
        <View style={s.prebidHead}>
          <Gavel size={15} color={ui.brand} />
          <Text style={s.prebidTitle}>Dein Höchstgebot: {formatEuro(myMax)}</Text>
        </View>
        <Text style={s.prebidHint}>
          Wir bieten für dich mit — in Schritten, nie mehr als nötig und nie über deinem
          Maximum. Du musst {when} nicht dabei sein.
        </Text>
        {notice ? <Text style={s.prebidWarn}>{notice}</Text> : null}
        <Pressable
          style={({ pressed }) => [s.prebidGhost, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={() =>
            void cancel
              .mutateAsync(item.id)
              .then(() => setNotice(null))
              .catch((error: unknown) =>
                setNotice(
                  prebidErrorText(error instanceof Error ? error.message : String(error)),
                ),
              )
          }
          accessibilityRole="button"
        >
          <Text style={s.prebidGhostText}>Vorabgebot zurückziehen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.prebid}>
      <View style={s.prebidHead}>
        <Gavel size={15} color={ui.brand} />
        <Text style={s.prebidTitle}>Schon jetzt mitbieten</Text>
      </View>
      <Text style={s.prebidHint}>
        Sag, wie weit du gehen würdest. Wir bieten {when} für dich mit — in Schritten,
        nie mehr als nötig.
      </Text>

      <View style={s.prebidRow}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder={`ab ${formatEuro(item.start_price_cents)}`}
          placeholderTextColor={ui.textMuted}
          keyboardType="decimal-pad"
          style={s.prebidInput}
        />
        <Pressable
          style={({ pressed }) => [
            s.prebidCta,
            (!enough || busy) && s.prebidCtaOff,
            pressed && { opacity: 0.85 },
          ]}
          disabled={!enough || busy}
          onPress={() => {
            // Ohne Konto kann niemand bieten. Der Weg dorthin ist ein Knopf,
            // kein grauer Knopf ohne Erklärung — die Sackgasse aus HANDOFF 22.
            if (!myUserId) {
              router.push('/login');
              return;
            }
            void place
              .mutateAsync({ auctionId: item.id, maxCents: cents! })
              .then(() => {
                setAmount('');
                setNotice(null);
              })
              .catch((error: unknown) =>
                setNotice(
                  prebidErrorText(error instanceof Error ? error.message : String(error)),
                ),
              );
          }}
          accessibilityRole="button"
          accessibilityLabel="Höchstgebot hinterlegen"
        >
          <Text style={s.prebidCtaText}>Hinterlegen</Text>
        </Pressable>
      </View>

      {amount.trim() && !enough ? (
        <Text style={s.prebidWarn}>
          Mindestens {formatEuro(item.start_price_cents)} — das ist der Startpreis.
        </Text>
      ) : null}
      {notice ? <Text style={s.prebidWarn}>{notice}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: space.xs, marginBottom: space.md },
  head: { fontSize: 12, fontWeight: '700', color: ui.textMuted, marginBottom: space.sm },

  row: { gap: space.sm, paddingRight: space.md },
  // 96 Punkte: schmal genug, dass drei nebeneinander andeuten „da ist noch
  // mehr", breit genug für zwei Zeilen Titel.
  tile: { width: 96 },
  thumb: {
    aspectRatio: ratio.card,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 12, fontWeight: '600', color: ui.text, marginTop: 5 },
  tilePrice: { fontSize: 12, fontWeight: '700', color: ui.text, marginTop: 1 },

  sheet: { flex: 1, backgroundColor: ui.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: ui.text },

  hero: {
    width: '100%',
    aspectRatio: ratio.card,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: space.lg },
  price: { fontSize: 22, fontWeight: '700', color: ui.text },
  title: { fontSize: 17, fontWeight: '600', color: ui.text, marginTop: 2 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: ui.text },

  note: { fontSize: 13, color: ui.textMuted, marginTop: space.lg, lineHeight: 19 },

  // ── Vormerken ──────────────────────────────────────────────────────────────
  // Kontur statt Fläche: Es ist eine Einladung, kein Kaufweg. Gold wäre hier
  // falsch — das gehört dem Gebot darunter.
  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.line,
  },
  remindOn: { borderColor: ui.success, backgroundColor: ui.sunken },
  remindText: { flex: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  remindTextOn: { color: ui.success },

  // ── Vorabgebot ─────────────────────────────────────────────────────────────
  // Eigene Fläche mit Rahmen, nicht nur ein Knopf: Hier wird geboten, und das
  // muss sich vom Rest des Blattes abheben, der reine Vorschau ist.
  prebid: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.card,
  },
  prebidHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prebidTitle: { fontSize: 15, fontWeight: '700', color: ui.text },
  prebidHint: { fontSize: 12, color: ui.textMuted, marginTop: space.xs, lineHeight: 17 },

  prebidRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  prebidInput: {
    flex: 1,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  // Gold, weil es der Kaufweg ist — dieselbe Farbe wie der Gebots-Knopf im
  // Raum. Ein Vorabgebot ist ein Gebot, kein Merkzettel.
  prebidCta: {
    height: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prebidCtaOff: { opacity: 0.45 },
  prebidCtaText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },

  prebidGhost: { marginTop: space.md, paddingVertical: space.sm },
  prebidGhostText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
  prebidWarn: { fontSize: 12, color: ui.live, marginTop: space.sm },
});
