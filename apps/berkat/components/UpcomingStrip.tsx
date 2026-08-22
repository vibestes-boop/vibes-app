// „Demnächst" — der Sendeplan auf der Startseite.
//
// Der Zweck ist nicht, Termine anzuzeigen. Der Zweck ist, dass die Startseite
// **nie leer wirkt**: Ohne diesen Streifen sagt Berkat „Gerade ist niemand live"
// und damit faktisch „komm später mal wieder, vielleicht". Mit ihm sagt sie
// „heute um 20:00 bei zaur" — ein Grund, wiederzukommen, statt einer Absage.
//
// Antippen führt aufs Verkäufer-Profil und nicht auf eine Detailseite des
// Termins. Das ist Absicht: **Erinnert werden die Follower**, der Folgen-Knopf
// ist also die einzige Handlung, die hier etwas bewirkt. Eine eigene
// Termin-Seite hätte einen Knopf gebraucht, den es nicht gibt.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CalendarClock, Lock, Repeat } from 'lucide-react-native';
import { ui, radius, ratio, space } from '../theme/tokens';
import { formatSlot, formatUntil, nextPerSeries, type PlannedShow } from '../lib/useSchedule';
import { usePreparedByPlan } from '../lib/usePrepared';
import { Avatar } from './Avatar';
import { BerkatMark } from './BerkatMark';

/** So viele Vorschaubilder passen auf eine 168 Punkte breite Karte. */
const PEEK = 3;

type Props = {
  shows: PlannedShow[];
  onSelect: (hostId: string) => void;
};

export function UpcomingStrip({ shows, onSelect }: Props) {
  // Aus einer wöchentlichen Reihe wird EINE Karte. Vier gleiche nebeneinander
  // würden die anderen Verkäufer aus dem Streifen drängen — und die Frage, die
  // er beantwortet, ist „wann kommt als Nächstes was?", nicht „zeig mir einen
  // Kalender".
  const series = nextPerSeries(shows);

  // ⚠️ Vor dem frühen `return` — Hooks dürfen nicht bedingt laufen.
  //
  // Gefragt wird nur nach den Terminen, die tatsächlich als Karte erscheinen
  // (der jeweils nächste je Reihe), und in EINER Abfrage. Bei einer Reihe mit
  // vier Terminen die Ware aller vier zu holen, um die des ersten zu zeigen,
  // wäre viermal so viel für dasselbe Ergebnis.
  const planIds = useMemo(() => series.map((s) => s.next.id), [series]);
  const { byPlan } = usePreparedByPlan(planIds);

  if (series.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <CalendarClock size={15} color={ui.textMuted} />
        <Text style={s.headText}>Demnächst</Text>
        <Text style={s.hint}>Folge — dann erinnern wir dich</Text>
      </View>

      {/* ⚠️ EIN Termin ist kein Streifen.
          Bis zum 21.08.2026 stand auch bei einer einzigen Ankündigung eine
          168 Punkte schmale Hochkant-Karte in einem waagerechten Roller — und
          daneben blieb der halbe Bildschirm leer. Am Gerät gemeldet, und der
          Eindruck ist richtig: Eine Liste mit einem Element sieht nicht nach
          „das ist alles", sondern nach „hier fehlt etwas".

          Der Ausweg ist nicht, die Karte breiter zu machen (dann steht ein Turm
          über die volle Breite), sondern sie zu DREHEN: Bild links, Text
          rechts. Dieselben Angaben, dieselbe Reihenfolge, nur quer — und die
          Karte füllt die Zeile, weil sie es dann auch soll.

          Ab zwei Terminen ist der Roller wieder richtig: Dort ist das Anschneiden
          der zweiten Karte die Auskunft „da kommt noch mehr". */}
      {series.length === 1 ? (
        (() => {
          const { next: show, count } = series[0];
          const ready = byPlan.get(show.id) ?? [];
          return (
            <Pressable
              style={s.wide}
              onPress={() => onSelect(show.host_id)}
              accessibilityRole="button"
              accessibilityLabel={`${show.title} — ${formatSlot(show.scheduled_at)}${
                count > 1 ? ', jede Woche' : ''
              }${ready.length > 0 ? `, ${ready.length} Artikel` : ''}`}
            >
              <View style={s.wideThumb}>
                {show.cover_url ? (
                  <Image
                    source={{ uri: show.cover_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={140}
                  />
                ) : (
                  <BerkatMark size={28} color={ui.lineStrong} />
                )}
              </View>

              <View style={s.wideText}>
                <View style={s.cardHead}>
                  <Avatar uri={show.host?.avatar_url} name={show.host?.username} size={22} />
                  <Text numberOfLines={1} style={s.host}>
                    {show.host?.username ?? 'Verkäufer'}
                  </Text>
                  {show.women_only ? <Lock size={12} color={ui.success} /> : null}
                </View>

                {/* Ohne `minHeight`: Der Zweck dieser Mindesthöhe drüben im
                    Roller ist, dass alle Karten gleich hoch bleiben. Bei einer
                    einzigen gibt es nichts anzugleichen — und genau die 19
                    leeren Punkte unter einem kurzen Titel waren die zweite
                    Hälfte der Meldung. */}
                <Text numberOfLines={2} style={s.wideTitle}>
                  {show.title}
                </Text>

                {/* ⚠️ Eigene Zeitzeile, NICHT `s.when`.
                    Die trägt seit heute `marginTop: 'auto'`, um im Roller die
                    Zeiten aller Karten auf eine Höhe zu ziehen. Hier wäre das
                    falsch: Die Textspalte ist mittig ausgerichtet, und ein
                    automatischer Rand würde ihren Inhalt auseinanderziehen,
                    sobald das Bild die Karte höher macht als der Text. */}
                <View style={s.wideWhen}>
                  <Text style={s.slot}>{formatSlot(show.scheduled_at)}</Text>
                  <Text style={s.until}>{formatUntil(show.scheduled_at)}</Text>
                </View>

                {ready.length > 0 ? (
                  <View style={s.peekRow}>
                    {ready
                      .filter((item) => item.image_url)
                      .slice(0, PEEK)
                      .map((item) => (
                        <View key={item.id} style={s.peek}>
                          <Image
                            source={{ uri: item.image_url! }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={120}
                          />
                        </View>
                      ))}
                    <Text style={s.peekCount}>{ready.length} Artikel</Text>
                  </View>
                ) : null}

                {count > 1 ? (
                  <View style={s.weeklyPill}>
                    <Repeat size={10} color={ui.brand} />
                    <Text style={s.weeklyText}>jede Woche</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })()
      ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {series.map(({ next: show, count }) => {
          const ready = byPlan.get(show.id) ?? [];
          return (
          <Pressable
            key={show.id}
            style={s.card}
            onPress={() => onSelect(show.host_id)}
            accessibilityRole="button"
            accessibilityLabel={`${show.title} — ${formatSlot(show.scheduled_at)}${
              count > 1 ? ', jede Woche' : ''
            }${ready.length > 0 ? `, ${ready.length} Artikel` : ''}`}
          >
            <View style={s.cardHead}>
              <Avatar uri={show.host?.avatar_url} name={show.host?.username} size={26} />
              <Text numberOfLines={1} style={s.host}>
                {show.host?.username ?? 'Verkäufer'}
              </Text>
              {show.women_only ? <Lock size={12} color={ui.success} /> : null}
            </View>

            {/* Das Bild steht zwischen Kopf und Titel — dieselbe Reihenfolge
                wie auf den Live-Karten darunter (Verkäufer, Bild, Name), und
                dasselbe Seitenverhältnis `ratio.card` (4:5). ⚠️ Hier stand bis
                zum 21.08.2026 „derselbe quadratische Zuschnitt" — das war seit
                dem 18.08. falsch, als alle Stöber-Karten von 1:1 auf 4:5
                umgestellt wurden. Der Code war richtig, nur der Satz daneben
                nicht. Zwei Bildsprachen auf einer Startseite wären eine zu viel.

                Kein Text darüber: Der Kontrast über einem fremden Foto ist die
                einzige Stelle, an der Berkats zwei feste Flächen nicht greifen
                (§ 8) — und für einen Termin gibt es nichts, das dort stehen
                müsste. */}
            <View style={s.thumb}>
              {show.cover_url ? (
                <Image
                  source={{ uri: show.cover_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={140}
                />
              ) : (
                // Kein Platzhalter-Foto, nur eine ruhige Fläche mit der Ähre.
                // Ein Standardbild für alle sähe aus wie ein Fehler — und die
                // Karten im Streifen behalten so trotzdem dieselbe Höhe.
                <BerkatMark size={34} color={ui.lineStrong} />
              )}
            </View>

            <Text numberOfLines={2} style={s.title}>
              {show.title}
            </Text>

            <View style={s.when}>
              <Text style={s.slot}>{formatSlot(show.scheduled_at)}</Text>
              <Text style={s.until}>{formatUntil(show.scheduled_at)}</Text>
            </View>

            {/* ── Was an diesem Abend drankommt.
                Bis zum 19.08.2026 hatte eine Ankündigung Titel, Bild und
                Uhrzeit — und damit keinen Grund, pünktlich zu sein: Wer nicht
                weiß, was kommt, verpasst auch nichts. Die drei Vorschaubilder
                sind der ganze Zweck des Vorbereitens (HANDOFF 48).

                Nur Bilder, kein Text darauf: Die Kontrast-Ausnahme über fremden
                Fotos gilt hier so wenig wie beim Cover darüber. Die Zahl steht
                daneben auf der ruhigen Fläche. ────────────────────────────── */}
            {ready.length > 0 ? (
              <View style={s.peekRow}>
                {/* ⚠️ Nur Artikel MIT Foto bekommen eine Kachel. Am Gerät sofort
                    sichtbar geworden: Ein vorbereiteter Artikel ohne Bild ergab
                    ein leeres Quadrat, und drei davon nebeneinander sähen wie
                    ein Ladefehler aus. Die Zahl daneben zählt trotzdem ALLE —
                    sie ist die Auskunft, die Kacheln sind die Verlockung. */}
                {ready
                  .filter((item) => item.image_url)
                  .slice(0, PEEK)
                  .map((item) => (
                    <View key={item.id} style={s.peek}>
                      <Image
                        source={{ uri: item.image_url! }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={120}
                      />
                    </View>
                  ))}
                <Text style={s.peekCount}>{ready.length} Artikel</Text>
              </View>
            ) : null}

            {/* Das eigentliche Ritual-Signal: nicht „heute um 20:00", sondern
                „das ist immer so". Erst dadurch merkt sich jemand den Abend. */}
            {count > 1 ? (
              <View style={s.weeklyPill}>
                <Repeat size={10} color={ui.brand} />
                <Text style={s.weeklyText}>jede Woche</Text>
              </View>
            ) : null}
          </Pressable>
          );
        })}
      </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.sm,
  },
  headText: { fontSize: 13, fontWeight: '700', color: ui.text },
  // Die Erklärung steht neben der Überschrift und nicht auf jeder Karte —
  // einmal gesagt reicht, zwölfmal wäre Lärm.
  hint: { fontSize: 11, color: ui.textMuted, marginLeft: 'auto' },

  // ── Die quere Fassung, wenn genau EIN Termin ansteht ───────────────────────
  // Gleiche Fläche, gleiche Kante, gleiche Angaben wie die Roller-Karte — nur
  // nebeneinander statt untereinander. Das Bild behält sein 4:5, damit dieselben
  // Cover in beiden Fassungen gleich aussehen.
  // ⚠️ KEIN `padding` auf der Karte, und `overflow: 'hidden'`.
  //
  // Das Bild soll die Karte oben bis unten ausfüllen (21.08.2026 am Gerät
  // gefordert). Dafür muss zweierlei zusammenkommen: Die Karte selbst darf
  // keinen Innenabstand haben — sonst bleibt rundherum ein Streifen Papier
  // stehen — und sie muss beschneiden, damit das Bild die runde Ecke links
  // mitnimmt statt darüber hinauszustehen. Der Innenabstand wandert deshalb
  // in die Textspalte.
  wide: {
    flexDirection: 'row',
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    overflow: 'hidden',
    // Ein Boden, damit die Karte nicht einfällt: Ein Termin ohne vorbereitete
    // Artikel und ohne Wochen-Pille hätte sonst nur Kopfzeile, Titel und Zeit —
    // und ein 112 Punkte breites Bild in einer 90 Punkte hohen Karte sähe aus
    // wie ein liegendes Rechteck, nicht wie ein Cover.
    minHeight: 116,
  },
  // ⚠️ `alignSelf: 'stretch'` statt `aspectRatio`.
  //
  // Das ist der eigentliche Trick: In einer Zeile nimmt ein gestrecktes Kind
  // die volle Höhe der Zeile an — und die bestimmt die Textspalte daneben. Ein
  // festes Seitenverhältnis würde stattdessen die Höhe VORSCHREIBEN, und dann
  // bliebe unten oder oben wieder ein Rest. Das Bild ist damit immer genau so
  // hoch wie die Karte, egal wie lang der Titel wird.
  //
  // Keine eigene `borderRadius`: Die Karte beschneidet bereits, und zwei
  // Rundungen übereinander ergeben eine sichtbare Doppelkante.
  wideThumb: {
    width: 112,
    alignSelf: 'stretch',
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
    padding: space.md,
  },
  wideTitle: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },
  wideWhen: { marginTop: space.xs, flexDirection: 'row', alignItems: 'baseline', gap: 6 },

  row: { gap: space.md, paddingRight: space.md },
  card: {
    width: 168,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  host: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600', color: ui.textMuted },

  thumb: {
    aspectRatio: ratio.card,
    marginTop: space.sm,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /**
   * ⚠️ KEIN `minHeight` mehr.
   *
   * Hier standen 36 Punkte, damit die Zeitzeile über alle Karten hinweg auf
   * derselben Höhe sitzt — auch wenn ein Titel eine Zeile hat und der nächste
   * zwei. Der Preis dafür war ein LOCH: Unter einem einzeiligen Titel wie
   * „Sdsdsdsdsd" klafften 19 leere Punkte mitten in der Karte, und Berkats
   * Titel sind fast immer einzeilig. Eine Regel, die den seltenen Fall
   * ordentlich macht und den häufigen kaputt.
   *
   * Die Ausrichtung ist trotzdem nicht verloren — sie wird nur von unten
   * hergestellt statt von oben (siehe `when`).
   */
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: ui.text,
    marginTop: space.sm,
  },

  /**
   * `marginTop: 'auto'` schiebt Zeit, Vorschaubilder und Wochen-Pille an den
   * UNTEREN Rand der Karte. Weil die Karten im waagerechten Roller ohnehin auf
   * gleiche Höhe gestreckt werden, sitzen die Zeitzeilen damit exakt
   * nebeneinander — dasselbe Ziel wie die alte Mindesthöhe, aber ohne Loch:
   * Der Freiraum sammelt sich zwischen Titel und Zeit statt direkt unter dem
   * Titel, und dort fällt er nicht auf, weil er die Karte gliedert statt sie
   * zu zerreißen.
   */
  when: {
    marginTop: 'auto',
    paddingTop: space.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },

  peekRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.sm },
  peek: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  peekCount: { fontSize: 11, color: ui.textMuted, marginLeft: 2 },

  weeklyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  weeklyText: { fontSize: 10, fontWeight: '700', color: ui.brand },
  slot: { fontSize: 13, fontWeight: '700', color: ui.brand },
  until: { fontSize: 11, color: ui.textMuted },
});
