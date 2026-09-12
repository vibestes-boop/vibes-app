/**
 * Deine Versandsätze — und der Urlaubsmodus
 * ============================================================================
 *
 * Aus der Liste in Übergabe 69, Punkt 3: „Kein Bildschirm für die eigenen
 * Versandsätze — ein Verkäufer kann seine Pauschalen nirgends ansehen."
 *
 * ⚠️ ANSEHEN, NICHT ÄNDERN — und das ist eine Entscheidung, keine Lücke.
 *
 * Die Sätze sind Berkats Vorgaben (`berkat_shipping_rates` mit
 * `seller_id IS NULL`). Eigene Sätze liest die Anzeige schon und zieht sie den
 * Vorgaben vor — nur das Formular dafür fehlt absichtlich: Seit Connect
 * (Übergabe 99) landet das Porto zwar beim verbundenen Verkäufer, aber wer den
 * Satz selbst bestimmt, bestimmt auch, was der Käufer in der Kasse sieht. Das
 * gehört in eine Phase, in der es mehr als einen Verkäufer gibt.
 *
 * Der Urlaub steht auf demselben Bildschirm, weil er dieselbe Frage
 * beantwortet: **Wie kommt meine Ware zum Käufer — und kommt sie gerade
 * überhaupt?**
 *
 * ── ⚠️ AUS KARTE UND PILLEN WURDE EINE LISTE (11.09.2026) ──────────────────
 *
 * Am Gerät gemeldet: „vibecodet, unübersichtlich". Vier Dinge waren es:
 *
 *   1. Deutschland stand ganz UNTEN — sortiert nach Länderkürzel (AT, CH, DE).
 *      Der Hauptmarkt zuletzt.
 *   2. Österreich und Schweiz hatten denselben Satz und dieselbe Entschuldigung
 *      („nur ein Satz — auch ein Brief kostet so viel"), jede zweimal.
 *   3. Drei Absätze Prosa. Die Seite erklärte sich ständig selbst.
 *   4. Eine Rahmen-Karte mit Pillen für den Urlaub — statt der Liste, die das
 *      Konto seit dem 26.08. hat (Übergabe 94: „die GRUPPE trägt die Fläche,
 *      die Zeile nur eine Haarlinie").
 *
 * Jetzt: dasselbe Muster wie `(tabs)/account.tsx`. Länder mit identischen
 * Sätzen werden zu EINER Gruppe („Österreich und Schweiz"), Deutschland kommt
 * zuerst, und jeder Satz Erklärung ist entweder ein Zeilen-Hinweis oder weg.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Palmtree } from 'lucide-react-native';

import { PressFeedback } from '../components/PressFeedback';
import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { formatCents } from '../lib/useShipping';
import { SHIPPING_TIERS } from '../lib/useShippingTier';
import { useBerkatSeller } from '../lib/useBerkatSeller';
import {
  VACATION_PRESETS,
  onVacation,
  useSetVacation,
  vacationLabel,
} from '../lib/useVacation';
import { radius, space, ui } from '../theme/tokens';

const COUNTRY_NAME: Record<string, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
};

type Rate = {
  country: string;
  tier: number;
  label: string;
  cents: number;
  seller_id: string | null;
};

type ZoneRow = { tier: number; label: string; examples: string; cents: number };
type Zone = { title: string; rows: ZoneRow[] };

const countryName = (code: string) => COUNTRY_NAME[code] ?? code;

/** „Österreich und Schweiz" — oder bei dreien „A, B und C". */
function joinNames(codes: string[]): string {
  const names = codes.map(countryName);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** „bis übermorgen" → „Bis übermorgen": als Zeile in einer Liste, nicht als Pille im Satz. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ShippingScreen() {
  // Kein StatusBar-Aufruf: Berkat hat zwei feste Flächen und setzt sie global
  // im Wurzel-Layout (Übergabe 4). Nur der Live-Raum weicht ab.
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: seller } = useBerkatSeller(myUserId);
  const setVacation = useSetVacation();
  const away = onVacation(seller?.vacation_until);

  const { data: rates = [] } = useQuery({
    queryKey: ['berkat', 'shipping-rates', myUserId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Rate[]> => {
      const { data, error } = await supabase
        .from('berkat_shipping_rates')
        .select('country, tier, label, cents, seller_id')
        .order('country')
        .order('tier');
      if (error) throw error;
      return (data ?? []) as Rate[];
    },
  });

  /**
   * Je Land und Stufe genau eine Zeile — der eigene Satz schlägt die Vorgabe.
   * Dieselbe Regel wie serverseitig; sie steht hier nur, weil dieser Bildschirm
   * ALLE Stufen zeigt statt der einen, die für einen Korb gilt.
   *
   * Danach: Länder mit identischen Sätzen zu einer Gruppe zusammenlegen.
   * Deutschland zuerst, der Rest nach Namen — nicht nach Kürzel, sonst steht
   * der Hauptmarkt hinter Österreich.
   */
  const zones = useMemo<Zone[]>(() => {
    const byCountry = new Map<string, Map<number, Rate>>();
    for (const r of rates) {
      if (r.seller_id !== null && r.seller_id !== myUserId) continue;
      const tiers = byCountry.get(r.country) ?? new Map<number, Rate>();
      const seen = tiers.get(r.tier);
      if (!seen || (seen.seller_id === null && r.seller_id !== null)) tiers.set(r.tier, r);
      byCountry.set(r.country, tiers);
    }

    const order = [...byCountry.keys()].sort((a, b) => {
      if (a === 'DE') return -1;
      if (b === 'DE') return 1;
      return countryName(a).localeCompare(countryName(b), 'de');
    });

    // Map hält die Einfügereihenfolge — die Deutschland-Gruppe bleibt vorn.
    const bySignature = new Map<string, { codes: string[]; rows: ZoneRow[] }>();
    for (const code of order) {
      const tiers = byCountry.get(code)!;
      const rows: ZoneRow[] = SHIPPING_TIERS.filter((t) => tiers.has(t.tier)).map((t) => ({
        tier: t.tier,
        label: t.label,
        examples: t.examples,
        cents: tiers.get(t.tier)!.cents,
      }));
      const signature = rows.map((r) => `${r.tier}:${r.cents}`).join('|');
      const existing = bySignature.get(signature);
      if (existing) existing.codes.push(code);
      else bySignature.set(signature, { codes: [code], rows });
    }

    return [...bySignature.values()].map((z) => ({ title: joinNames(z.codes), rows: z.rows }));
  }, [rates, myUserId]);

  const setAway = (days: number | null) =>
    void setVacation
      .mutateAsync(days)
      .then(() =>
        setNotice(
          days === null
            ? 'Willkommen zurück — dein Regal ist wieder offen.'
            : 'Eingetragen — deine Angebote sind bis dahin ausgeblendet.',
        ),
      )
      .catch((e: unknown) =>
        setNotice(e instanceof Error ? e.message : 'Das ließ sich nicht ändern.'),
      );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable
          hitSlop={10}
          onPress={() => goBack('/(tabs)/account')}
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headTitle}>Versand</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {/* ── Urlaub ───────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Urlaub</Text>
        <View style={styles.group}>
          {/* Die Zustandszeile: was gerade gilt, und in einem Satz, was das
              heisst. Nicht antippbar — die Handlung steht darunter. */}
          <View style={styles.row}>
            <Palmtree size={21} color={ui.brand} />
            <View style={styles.copy}>
              <Text style={styles.label}>
                {away ? capitalize(vacationLabel(seller?.vacation_until) ?? 'Im Urlaub') : 'Kein Urlaub'}
              </Text>
              <Text style={styles.hint}>
                {away
                  ? 'Deine Angebote sind ausgeblendet. Du siehst sie weiter, niemand kann sie kaufen.'
                  : 'Weg? Deine Angebote verschwinden solange — und kommen von selbst wieder.'}
              </Text>
            </View>
          </View>

          {away ? (
            <PressFeedback
              style={[styles.row, styles.rowSlim, styles.rowLast]}
              disabled={setVacation.isPending}
              onPress={() => setAway(null)}
              accessibilityRole="button"
              accessibilityLabel="Urlaub beenden"
            >
              <View style={styles.copy}>
                <Text style={styles.action}>Ich bin zurück</Text>
              </View>
              <ChevronRight size={18} color={ui.textMuted} />
            </PressFeedback>
          ) : (
            VACATION_PRESETS.map((preset, i) => (
              <PressFeedback
                key={preset.days}
                style={[
                  styles.row,
                  styles.rowSlim,
                  i === VACATION_PRESETS.length - 1 && styles.rowLast,
                ]}
                disabled={setVacation.isPending}
                onPress={() => setAway(preset.days)}
                accessibilityRole="button"
                accessibilityLabel={`Urlaub ${preset.label}`}
              >
                <View style={styles.copy}>
                  <Text style={styles.label}>{capitalize(preset.label)}</Text>
                </View>
                <ChevronRight size={18} color={ui.textMuted} />
              </PressFeedback>
            ))
          )}
        </View>

        {/* ── Die Sätze ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Was der Käufer zahlt</Text>
        <Text style={styles.sectionHint}>
          Der Satz richtet sich nach dem größten Stück im Paket.
        </Text>

        {zones.map((zone) => (
          <View key={zone.title}>
            <Text style={styles.zoneTitle}>{zone.title}</Text>
            <View style={styles.group}>
              {zone.rows.map((r, i) => (
                <View
                  key={r.tier}
                  style={[styles.row, i === zone.rows.length - 1 && styles.rowLast]}
                >
                  <View style={styles.copy}>
                    <Text style={styles.label}>{r.label}</Text>
                    <Text style={styles.hint}>{r.examples}</Text>
                  </View>
                  <Text style={styles.price}>{formatCents(r.cents)}</Text>
                </View>
              ))}
            </View>
            {/* ⚠️ Ehrlich statt beruhigend: Gibt es nur eine Stufe, gehört der
                Grund hierher — sonst hält es jemand für einen Fehler und sucht
                ihn im Code. Einmal je Gruppe, nicht je Land. */}
            {zone.rows.length === 1 ? (
              <Text style={styles.zoneNote}>
                Bisher nur ein Satz — auch ein Brief kostet so viel.
              </Text>
            ) : null}
          </View>
        ))}

        <Text style={styles.foot}>Die Sätze legt Berkat fest. Eigene Sätze: sag Bescheid.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headTitle: { fontSize: 17, fontWeight: '600', color: ui.text },

  notice: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text },

  sectionLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: ui.text,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  sectionHint: { fontSize: 13, lineHeight: 18, color: ui.textMuted, marginBottom: space.md },

  /* Dasselbe Muster wie `(tabs)/account.tsx` (Übergabe 94): Die Gruppe trägt
     die Fläche, die Zeile nur eine Haarlinie. Die letzte Zeile trägt keine —
     sonst läge sie auf der abgerundeten Kante. */
  group: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  /* Einzeilige Zeilen (die Urlaubs-Dauern) brauchen die 64 nicht — vier davon
     übereinander wären sonst ein Turm. */
  rowSlim: { minHeight: 48, paddingVertical: 12 },
  rowLast: { borderBottomWidth: 0 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  hint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  action: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.brand },
  price: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },

  zoneTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: ui.textMuted,
    marginBottom: space.sm,
    marginLeft: space.xs,
  },
  zoneNote: {
    fontSize: 12,
    lineHeight: 18,
    color: ui.textMuted,
    marginTop: -space.xs,
    marginBottom: space.md,
    marginLeft: space.xs,
  },

  foot: { fontSize: 12, lineHeight: 18, color: ui.textMuted, marginTop: space.sm },
});
