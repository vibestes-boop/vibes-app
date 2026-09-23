/**
 * Einstellungen — alles an einem Ort
 * ============================================================================
 *
 * ⚠️ WARUM ES DAS GIBT (22.09.2026)
 * Zaur: *„unser einstellungs button gibt es garnicht, alles ist überall
 * verteilt"* — und auf Nachfrage: *„ja alles verstreut, konto und profil
 * überall."*
 *
 * Nachgesehen, und er hatte recht. Vorher lagen Einstellungen an **drei**
 * Orten, und zwei davon waren nicht zu erraten:
 *
 *   Name und „Über dich"   → nur über das EIGENE ÖFFENTLICHE Profil
 *                            (`/seller/<id>`), dort hinter einem Blatt
 *   Interessen             → nur über die Startseite oder „Gefolgt"
 *   Benachrichtigungen,
 *   Versand, Anbieter-
 *   angaben, Geld          → Konto-Reiter
 *
 * Wer seinen Anzeigenamen ändern wollte, musste also erst sein eigenes Profil
 * so aufrufen, wie ein Fremder es sieht. Das ist kein Suchproblem, sondern ein
 * falsches Modell: **Der Konto-Reiter zeigte, was man HAT — nicht, was man
 * EINSTELLEN kann.**
 *
 * ⚠️ DIE TRENNUNG, NACH DER HIER SORTIERT WIRD:
 *
 *   Konto-Reiter   Dinge, die man täglich BENUTZT — Nachrichten, Merkliste,
 *                  Käufe. Dazu die Identität: wer bin ich hier.
 *   Einstellungen  Dinge, die man einmal EINRICHTET und dann selten anfasst.
 *
 * Nebenwirkung, und eine erwünschte: Der Konto-Reiter passt dadurch wieder auf
 * einen Bildschirm — die Zusage aus Übergabe 94, die am 27.08. gebrochen wurde
 * (Abschnitt 125).
 */

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react-native';

import { goBack } from '../lib/nav';
import { errText } from '../lib/errorText';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { buildLabel } from '../lib/buildInfo';
import { missingBusinessFields, useBerkatSeller } from '../lib/useBerkatSeller';
import { onVacation } from '../lib/useVacation';
import {
  stripeConnectLabel,
  useStartStripeConnect,
  useStripeConnectState,
} from '../lib/useStripeConnect';
import { PressFeedback } from '../components/PressFeedback';
import { radius, space, ui } from '../theme/tokens';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: sellerRow } = useBerkatSeller(myUserId);
  const sellerMissing = missingBusinessFields(sellerRow ?? null);
  const sellerAway = onVacation(sellerRow?.vacation_until);
  const { data: stripeState = 'none' } = useStripeConnectState(myUserId);
  const { start: startStripeConnect, isStarting: stripeStarting } =
    useStartStripeConnect(myUserId);
  const [signingOut, setSigningOut] = useState(false);

  const openStripe = useCallback(() => {
    void startStripeConnect().catch((e) =>
      Alert.alert('Das hat nicht geklappt', errText(e)),
    );
  }, [startStripeConnect]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <PressFeedback hitSlop={10} onPress={() => goBack('/(tabs)/account')}
          accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={24} color={ui.text} />
        </PressFeedback>
        <Text accessibilityRole="header" style={s.headTitle}>Einstellungen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}>

        {/* ── DU ──────────────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>Du</Text>
        <View style={s.group}>
          {/* ⚠️ `?edit=1` statt eines eigenen Formulars. Das Profil-Blatt gibt
              es längst — es hing nur an der öffentlichen Verkäuferseite und war
              von hier aus nicht erreichbar. Ein zweites Formular daneben wäre
              die Sorte Abschrift, die auseinanderläuft. */}
          <Row Icon={UserRound} label="Profil bearbeiten"
            hint="Name, Bild und „Über dich“"
            onPress={() => myUserId && router.push(`/seller/${myUserId}?edit=1`)} />
          <Row Icon={Sparkles} label="Interessen"
            hint="Was dir auf der Startseite vorgeschlagen wird"
            onPress={() => router.push('/interests')} />
          <Row Icon={Bell} label="Benachrichtigungen"
            hint="Du entscheidest, was ankommt" last
            onPress={() => router.push('/notification-settings')} />
        </View>

        {/* ── VERKAUFEN ───────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>Verkaufen</Text>
        <View style={s.group}>
          {/* ⚠️ GELD EMPFANGEN steht oben, und zwar mit Grund: Ohne verbundenes
              Stripe-Konto steht an jedem Artikel „Nachricht schreiben" statt
              „Kaufen". Das ist die einzige Einstellung dieser Gruppe, ohne die
              der ganze Rest folgenlos bleibt.

              Der Zustand steht ausgeschrieben da statt als Haken: „Stripe
              prüft" und „bereit" sind zwei verschiedene Dinge, und wer das
              verwechselt, sendet einen Abend lang, ohne dass jemand kaufen
              kann. */}
          <PressFeedback style={s.row} onPress={openStripe} disabled={stripeStarting}
            accessibilityRole="button"
            accessibilityState={{ disabled: stripeStarting, busy: stripeStarting }}
            accessibilityLabel={`Geld empfangen — ${stripeConnectLabel(stripeState).text}`}>
            <Wallet size={21} color={ui.brand} />
            <View style={s.copy}>
              <Text style={s.label}>Geld empfangen</Text>
              {stripeStarting ? <ActivityIndicator size="small" color={ui.textMuted} /> : (
                <Text style={[
                  s.warn,
                  stripeConnectLabel(stripeState).tone === 'ok' && { color: ui.success },
                  stripeConnectLabel(stripeState).tone === 'muted' && { color: ui.textMuted },
                ]}>
                  {stripeConnectLabel(stripeState).text}
                </Text>
              )}
            </View>
            <ChevronRight size={18} color={ui.textMuted} />
          </PressFeedback>

          {/* Die Zeile steht für JEDEN da, nicht nur für Gewerbliche: Auch der
              Wechsel von privat auf gewerblich beginnt hier. Der rote Hinweis
              erscheint nur, wenn tatsächlich etwas fehlt. */}
          <Row Icon={FileText} label="Anbieterangaben"
            hint={sellerMissing.length > 0 ? undefined : 'Verkäuferprofil und Kontaktdaten'}
            warn={sellerMissing.length > 0 ? 'Angaben vervollständigen' : undefined}
            onPress={() => router.push('/seller-details')} />

          <Row Icon={Truck} label="Versand" last
            hint={sellerAway ? 'Du bist gerade im Urlaub' : 'Versandkosten und Urlaub'}
            onPress={() => router.push('/shipping')} />
        </View>

        {/* ── KONTO ───────────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>Konto</Text>
        <PressFeedback style={s.signOut} disabled={signingOut}
          accessibilityState={{ disabled: signingOut, busy: signingOut }}
          onPress={() => {
            setSigningOut(true);
            void supabase.auth.signOut().finally(() => setSigningOut(false));
          }}
          accessibilityRole="button">
          <Text style={s.signOutText}>{signingOut ? 'Wird abgemeldet …' : 'Abmelden'}</Text>
        </PressFeedback>

        {/* ⚠️ Apple 5.1.1(v) und DSGVO Art. 17: Wer in der App ein Konto anlegen
            kann, muss es dort auch löschen können. Bewusst als schlichte
            Textzeile: Der Weg muss ERREICHBAR sein, nicht einladend. */}
        <PressFeedback style={s.deleteRow} onPress={() => router.push('/delete-account')}
          accessibilityRole="button" accessibilityLabel="Konto löschen">
          <Text style={s.deleteText}>Konto löschen</Text>
        </PressFeedback>

        {/* Welcher Stand läuft hier gerade? `selectable`, damit die Zeile aus
            einer Nachricht heraus lesbar ist. Kein Knopf: Es gibt nichts zu
            tun, nur etwas zu wissen. */}
        <Text selectable style={s.buildLine}>{buildLabel()}</Text>
      </ScrollView>
    </View>
  );
}

/** Eine Zeile. Vier Zeilen Aufruf statt vierzehn — und alle sehen gleich aus. */
function Row({ Icon, label, hint, warn, onPress, last }: {
  Icon: typeof Bell;
  label: string;
  hint?: string;
  warn?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressFeedback style={[s.row, last && s.rowLast]} onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={warn ? `${label}, ${warn}` : label}>
      <Icon size={21} color={ui.brand} />
      <View style={s.copy}>
        <Text style={s.label}>{label}</Text>
        {warn ? <Text style={s.warn}>{warn}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <ChevronRight size={18} color={ui.textMuted} />
    </PressFeedback>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headTitle: { fontSize: 17, fontWeight: '600', color: ui.text },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: ui.textMuted,
    marginTop: space.lg, marginBottom: space.sm, marginLeft: space.xs,
  },
  group: { backgroundColor: ui.card, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowLast: { borderBottomWidth: 0 },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '600', color: ui.text },
  hint: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: 2 },
  warn: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.live, marginTop: 2 },
  signOut: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: ui.text },
  deleteRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  deleteText: { fontSize: 14, color: ui.textMuted, textDecorationLine: 'underline' },
  buildLine: { fontSize: 12, color: ui.textMuted, textAlign: 'center', marginTop: space.lg },
});
