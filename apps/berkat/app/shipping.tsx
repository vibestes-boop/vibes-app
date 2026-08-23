/**
 * Deine Versandsätze — und der Urlaubsmodus
 * ============================================================================
 *
 * Aus der Liste in Übergabe 69, Punkt 3: „Kein Bildschirm für die eigenen
 * Versandsätze — ein Verkäufer kann seine Pauschalen nirgends ansehen. Trifft
 * heute niemanden ausser Zaur, ab dem zweiten Verkäufer sofort."
 *
 * ⚠️ ANSEHEN, NICHT ÄNDERN — und das ist eine Entscheidung, keine Lücke.
 *
 * Eigene Sätze zu hinterlegen hiesse, jedem Verkäufer den Versandpreis selbst
 * bestimmen zu lassen. Solange Berkat rechtlich der Verkäufer ist
 * (Kommissionsmodell, Strategie Abschnitt 8) und das Geld über EIN Stripe-Konto
 * läuft, ist der Satz eine Angabe des Betreibers — der Verkäufer trägt das
 * Porto nicht selbst. Ein Formular hier wäre ein Versprechen, das die
 * Abrechnung nicht einlöst.
 *
 * `berkat_shipping_rates.seller_id` steht bereit, damit sich das mit Stripe
 * Connect ohne Umbau ändern lässt. Wer es aufmacht, baut das Formular HIER —
 * die Anzeige liest schon eigene Sätze und zieht sie den Vorgaben vor.
 *
 * Der Urlaub steht auf demselben Bildschirm, weil er dieselbe Frage beantwortet:
 * **Wie kommt meine Ware zum Käufer — und kommt sie gerade überhaupt?**
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, PackageCheck, Palmtree } from 'lucide-react-native';

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
   */
  const byCountry = useMemo(() => {
    const map = new Map<string, Map<number, Rate>>();
    for (const r of rates) {
      if (r.seller_id !== null && r.seller_id !== myUserId) continue;
      const tiers = map.get(r.country) ?? new Map<number, Rate>();
      const seen = tiers.get(r.tier);
      if (!seen || (seen.seller_id === null && r.seller_id !== null)) tiers.set(r.tier, r);
      map.set(r.country, tiers);
    }
    return map;
  }, [rates, myUserId]);

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
        <View style={[styles.card, away && styles.cardAway]}>
          <View style={styles.cardHead}>
            <Palmtree size={18} color={away ? ui.bg : ui.text} />
            <Text style={[styles.cardTitle, away && styles.onAway]}>
              {away ? `Du bist im Urlaub — ${vacationLabel(seller?.vacation_until)}` : 'Urlaub'}
            </Text>
          </View>

          <Text style={[styles.cardBody, away && styles.onAway]}>
            {away
              ? 'Deine Angebote sind für andere gerade nicht sichtbar. Du siehst sie weiter, und niemand kann sie kaufen.'
              : 'Wenn du weg bist, verschwinden deine Angebote — ohne dass du sie zurückziehen musst. Sie kommen von selbst wieder.'}
          </Text>

          {away ? (
            <Pressable
              style={styles.backNow}
              disabled={setVacation.isPending}
              onPress={() =>
                void setVacation
                  .mutateAsync(null)
                  .then(() => setNotice('Willkommen zurück — dein Regal ist wieder offen.'))
                  .catch((e: unknown) =>
                    setNotice(e instanceof Error ? e.message : 'Das ließ sich nicht ändern.'),
                  )
              }
            >
              <Text style={styles.backNowText}>Ich bin zurück</Text>
            </Pressable>
          ) : (
            <View style={styles.presetRow}>
              {VACATION_PRESETS.map((preset) => (
                <Pressable
                  key={preset.days}
                  style={styles.preset}
                  disabled={setVacation.isPending}
                  onPress={() =>
                    void setVacation
                      .mutateAsync(preset.days)
                      .then(() =>
                        setNotice('Eingetragen — deine Angebote sind bis dahin ausgeblendet.'),
                      )
                      .catch((e: unknown) =>
                        setNotice(e instanceof Error ? e.message : 'Das ließ sich nicht ändern.'),
                      )
                  }
                >
                  <Text style={styles.presetText}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Die Sätze ────────────────────────────────────────────────────── */}
        <View style={styles.cardHead}>
          <PackageCheck size={18} color={ui.text} />
          <Text style={styles.cardTitle}>Was der Käufer zahlt</Text>
        </View>
        <Text style={styles.intro}>
          Der Satz richtet sich nach dem größten Stück im Paket. Was du beim Einstellen als
          Versandart wählst, entscheidet also mit — nicht nur, wohin es geht.
        </Text>

        {[...byCountry.keys()].sort().map((country) => {
          const tiers = byCountry.get(country)!;
          return (
            <View key={country} style={styles.zone}>
              <Text style={styles.zoneTitle}>{COUNTRY_NAME[country] ?? country}</Text>
              {SHIPPING_TIERS.map((t) => {
                const rate = tiers.get(t.tier);
                if (!rate) return null;
                return (
                  <View key={t.tier} style={styles.rateRow}>
                    <View style={styles.rateLeft}>
                      <Text style={styles.rateLabel}>{t.label}</Text>
                      <Text style={styles.rateEx}>{t.examples}</Text>
                    </View>
                    <Text style={styles.rateCents}>{formatCents(rate.cents)}</Text>
                  </View>
                );
              })}
              {/* ⚠️ Ehrlich statt beruhigend: Für AT und CH gibt es nur eine
                  Stufe, und der Grund gehört hierher — sonst hält es jemand für
                  einen Fehler und sucht ihn im Code. */}
              {tiers.size === 1 ? (
                <Text style={styles.zoneNote}>
                  Für dieses Land gibt es bisher nur einen Satz — auch ein Brief kostet also so
                  viel.
                </Text>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.foot}>
          Die Sätze legt Berkat fest, nicht du — das Porto läuft über das Konto des Betreibers.
          Wenn du eigene hinterlegen willst, sag Bescheid.
        </Text>
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

  card: {
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.lg,
  },
  // Markengrün gefüllt, nicht gold und nicht rot: Urlaub ist ein Zustand, kein
  // Kaufweg und keine Frist (`theme/tokens.ts`).
  cardAway: { backgroundColor: ui.brand, borderColor: ui.brand },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: ui.text },
  cardBody: { fontSize: 13, color: ui.textMuted, lineHeight: 18 },
  onAway: { color: ui.bg },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  preset: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.sunken,
  },
  presetText: { fontSize: 13, fontWeight: '600', color: ui.text },

  backNow: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: ui.bg,
  },
  backNowText: { fontSize: 13, fontWeight: '600', color: ui.brand },

  intro: { fontSize: 13, color: ui.textMuted, lineHeight: 18, marginBottom: space.md },

  zone: { marginBottom: space.lg },
  zoneTitle: { fontSize: 14, fontWeight: '600', color: ui.text, marginBottom: 6 },
  zoneNote: { fontSize: 11, color: ui.textMuted, marginTop: 4 },

  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  rateLeft: { flex: 1, paddingRight: space.sm },
  rateLabel: { fontSize: 13, fontWeight: '600', color: ui.text },
  rateEx: { fontSize: 11, color: ui.textMuted, marginTop: 1 },
  rateCents: { fontSize: 14, fontWeight: '600', color: ui.text },

  foot: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },
});
