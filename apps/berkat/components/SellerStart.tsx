// Die ersten Schritte eines neuen Verkäufers.
//
// WARUM
// Phase 0 heißt: fünf Verkäufer, acht Wochen, wöchentlich zwei Stunden. Das
// Werkzeug dafür steht — aber wer mühsam überzeugt wurde und dann auf
// „Verkaufen" tippt, sah bisher ein Formular und sonst nichts. Kein Hinweis,
// was zuerst zu tun ist, keine Auskunft darüber, ob er auf dem richtigen Weg
// ist. Bei fünf Leuten, die man einzeln geholt hat, entscheidet genau das, ob
// sie ein ZWEITES Mal senden.
//
// DIE REIHENFOLGE IST DER RAT
// Sie ist nicht nach Aufwand sortiert, sondern nach dem, was ohne das andere
// verpufft:
//
//   1. Profil — die ersten Zuschauer sehen nach, wer da sendet. Ein leeres
//      Profil kostet Vertrauen, das die Show erst mühsam wieder aufbaut.
//   2. Termin — Hebel Nr. 1 der Ausgangsanalyse. Er löst die Erinnerung an
//      alle Follower aus; ohne Ankündigung sendet man vor leerem Raum.
//   3. Regal — was jemand bei dir tun kann, wenn du NICHT sendest, also
//      94 % der Zeit.
//   4. Show — die eigentliche Tat. Zuletzt, weil eine Show mit leerem Profil
//      und ohne Ankündigung eine verschenkte Show ist.
//
// KEIN DAUERHAFTER MAHNER
// Die Karte verschwindet, sobald alle vier erledigt sind — restlos, ohne
// Abschluss-Feier. Das Design-Gesetz verlangt Maßhalten: Gefeiert werden
// Peaks (erster Zuschlag, erster Verkauf), nicht das Ausfüllen einer Liste.
// Und nichts davon ist eine Frist: Es gibt keinen Streak, keinen Countdown,
// keine Erinnerung.

import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { ui, radius, space } from '../theme/tokens';

export type StartStep = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  /** Ziel, wenn der Schritt woanders erledigt wird. Sonst steht er nur da. */
  target?: string;
};

/**
 * Ist das Profil ausgefüllt?
 *
 * Eigene Mini-Abfrage, weil der Sitzungs-Speicher nur `username`,
 * `avatar_url` und `women_only_verified` hält — `bio` und `display_name`
 * fehlen dort. Ein Bild ODER ein Satz genügt: Wer beides verlangt, macht aus
 * einer Hilfe eine Hürde.
 */
export function useProfileFilled(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'profile-filled', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, bio, display_name')
        .eq('id', userId!)
        .maybeSingle();
      const row = data as { avatar_url: string | null; bio: string | null } | null;
      return Boolean(row?.avatar_url || row?.bio?.trim());
    },
  });
}

/**
 * „Schon mal gemacht?" — für die beiden Schritte, deren Haken sonst wieder verfällt.
 *
 * ── ⚠️ WARUM ES DAS BRAUCHT (24.08.2026) ────────────────────────────────────
 *
 * Von Zaur gemeldet: *„Wieso kommt ‚Deine ersten Schritte' immer wieder? Wenn
 * man das einmal durchmacht, hat man es doch gelernt."* Er hat recht, und der
 * Fehler saß in einer Entscheidung, die für sich genommen richtig war.
 *
 * Der Kopf dieser Datei sagt: keine Tabelle, kein Fortschritts-Feld, alle
 * Zustände aus Daten, die es ohnehin gibt. Gut gedacht — nur wurde dabei die
 * falsche Frage gestellt. Zwei der vier Schritte hingen an **Gegenwart** statt
 * an **Vergangenheit**:
 *
 *   Termin  `plannedShows.length > 0`  → nur ZUKÜNFTIGE Termine. Ist der Abend
 *                                        vorbei, ist der Haken weg.
 *   Regal   `standing.length > 0`      → nur `status = 'listed'`. Alles
 *                                        verkauft, Haken weg.
 *
 * Beides trifft ausgerechnet den Verkäufer, der es RICHTIG macht: Wer sendet
 * und verkauft, bekommt die Anfänger-Liste zurück. Eine Liste, die einem das
 * Gelernte wieder abspricht, ist schlimmer als keine.
 *
 * Das Prinzip bleibt: keine neue Tabelle, kein Fortschritts-Feld, nichts zum
 * Zurücksetzen. Gezählt wird über Zeilen, die ohnehin liegen bleiben — ein
 * abgelaufener Termin und ein verkaufter Artikel verschwinden nicht, sie
 * wechseln nur den Status.
 *
 * ⚠️ Deshalb steht hier BEWUSST kein `status`-Filter. Wer einen hinzufügt,
 * baut genau den Fehler wieder ein.
 */
export function useSellerEverStarted(userId: string | null) {
  const announced = useQuery({
    queryKey: ['berkat', 'ever-announced', userId],
    enabled: Boolean(userId),
    // Die Antwort ändert sich einmal im Leben eines Verkäufers von nein auf ja.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('scheduled_lives')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', userId!)
        .eq('app', 'berkat');
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const listed = useQuery({
    queryKey: ['berkat', 'ever-listed', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('live_auctions')
        // `session_id IS NULL` = Regal, nicht Show-Ware. Die Lese-Policy
        // `live_auctions_select_standing` gibt auch verkaufte und
        // zurückgezogene Zeilen frei — genau darauf beruht das „schon mal".
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId!)
        .is('session_id', null);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  return {
    everAnnounced: announced.data ?? false,
    everListed: listed.data ?? false,
  };
}

export function SellerStart({
  steps,
  onOpen,
}: {
  steps: StartStep[];
  onOpen: (target: string) => void;
}) {
  const done = steps.filter((s) => s.done).length;

  // Restlos weg, sobald alles steht. Eine Karte, die dauerhaft „4 von 4" sagt,
  // ist Dekoration und nimmt dem Reiter oben den Platz.
  if (done === steps.length) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>Deine ersten Schritte</Text>
        <Text style={s.count}>
          {done} von {steps.length}
        </Text>
      </View>

      <View style={s.bar}>
        <View style={[s.barFill, { width: `${(done / steps.length) * 100}%` }]} />
      </View>

      {steps.map((step, index) => {
        const row = (
          <>
            <View style={[s.mark, step.done && s.markDone]}>
              {step.done ? <Check size={13} color={ui.successInk} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.label, step.done && s.labelDone]}>{step.label}</Text>
              {/* Der Hinweis nur bei OFFENEN Schritten — bei erledigten wäre
                  er eine Erklärung für etwas, das schon getan ist. */}
              {!step.done ? <Text style={s.hint}>{step.hint}</Text> : null}
            </View>
            {!step.done && step.target ? (
              <ChevronRight size={17} color={ui.textMuted} />
            ) : null}
          </>
        );

        // Nur offene Schritte mit Ziel sind antippbar. Ein erledigter Schritt
        // als Knopf würde jemanden zurückschicken, der schon fertig ist.
        return !step.done && step.target ? (
          <Pressable
            key={step.key}
            style={({ pressed }) => [s.row, index > 0 && s.rowSplit, pressed && s.rowPressed]}
            onPress={() => onOpen(step.target!)}
            accessibilityRole="button"
            accessibilityLabel={`${step.label} — ${step.hint}`}
          >
            {row}
          </Pressable>
        ) : (
          <View key={step.key} style={[s.row, index > 0 && s.rowSplit]}>
            {row}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  bar: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    marginTop: space.sm,
    marginBottom: space.xs,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: radius.pill, backgroundColor: ui.success },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  rowSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  rowPressed: { opacity: 0.6 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: { backgroundColor: ui.success, borderColor: ui.success },
  label: { fontSize: 14, fontWeight: '600', color: ui.text },
  labelDone: { color: ui.textMuted, textDecorationLine: 'line-through' },
  hint: { fontSize: 12, color: ui.textMuted, marginTop: 2, lineHeight: 17 },
});
