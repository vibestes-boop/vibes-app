// Konto — Profil, Nachrichten und Einstellungen. Käufe liegen unter /purchases.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  ChevronRight,
  FileText,
  Truck,
  Gift,
  Heart,
  Lock,
  MessageSquare,
  Package,
  Wallet,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { missingBusinessFields, useBerkatSeller } from '../../lib/useBerkatSeller';
import { onVacation } from '../../lib/useVacation';
import { useMyRewards } from '../../lib/useRewards';
import { buildLabel } from '../../lib/buildInfo';
import { errText } from '../../lib/errorText';
import {
  stripeConnectLabel,
  useStartStripeConnect,
  useStripeConnectState,
} from '../../lib/useStripeConnect';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { ui, radius, space } from '../../theme/tokens';
import { useAccountEmail } from '../../lib/useAccountEmail';
import { NavigationRow } from '../../components/NavigationRow';
import { PressFeedback } from '../../components/PressFeedback';

export default function AccountScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const quickActionMinWidth = Math.min(width - space.lg * 2, Math.ceil(136 * Math.max(1, fontScale)));
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);
  // Fehlen einem gewerblichen Verkäufer Pflichtangaben, steht das an der Zeile
  // — bei privat ist die Liste leer und es erscheint nichts.
  const { data: sellerRow } = useBerkatSeller(myUserId);
  const sellerMissing = missingBusinessFields(sellerRow ?? null);

  // Geld empfangen (Connect Standard, Übergabe 96). Der Zustand kommt vom
  // Server; hier wird nur angezeigt und angestossen.
  const { data: stripeState = 'none' } = useStripeConnectState(myUserId);
  const { data: accountEmail } = useAccountEmail(myUserId);
  const { start: startStripeConnect, isStarting: stripeStarting } =
    useStartStripeConnect(myUserId);
  const sellerAway = onVacation(sellerRow?.vacation_until);
  const profile = useSession((s) => s.profile);
  const { data: unreadMessages = 0, refetch: refetchUnread } = useUnreadMessageCount(myUserId, isFocused);
  const { data: rewards, refetch: refetchRewards } = useMyRewards(myUserId, isFocused);
  const openCredits = rewards?.credits_open ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const refreshAccount = async () => {
    setRefreshing(true);
    try { await Promise.all([refetchUnread(), refetchRewards()]); }
    finally { setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => {
    if (!myUserId) return;
    void refetchUnread({ cancelRefetch: false });
    void refetchRewards({ cancelRefetch: false });
  }, [myUserId, refetchUnread, refetchRewards]));

  if (!myUserId) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.gateBody}>
          Mit einem Konto kannst du mitbieten, folgen und verkaufen. Deins von
          Serlo gilt hier auch.
        </Text>
        <PressFeedback style={styles.primaryButton} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Anmelden</Text>
        </PressFeedback>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: insets.bottom + space.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refreshAccount()} tintColor={ui.brand} />
      }
    >
      {/* Nach einem iOS-Schriftwechsel müssen die Textmaße neu entstehen.
          Der ScrollView und der Zustand dieses Screens bleiben erhalten. */}
      <View key={fontScale}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Konto</Text>

      {/* ── ⚠️ DER GELD-HINWEIS, WEIL ER SONST UNTER DER FALZ LIEGT ─────────
          Übergabe 94 (26.08.2026) hat für diese Seite zugesichert: „Die ganze
          Seite passt auf einen Bildschirm, inklusive Paket und Abmelden."
          **Am 27.08. war die Zusicherung gebrochen** — der Connect-Umbau hat
          „Geld empfangen" ergänzt (54 Zeilen), einen Tag später, und niemand
          hat den Satz von gestern noch einmal gelesen.

          Am 22.09.2026 am Gerät gesehen, was daraus folgt: Ausgerechnet die
          EINE Zeile mit rotem „unvollständig" steht unter der Falz — die
          Zeile, ohne die an jedem Artikel „Nachricht schreiben" statt
          „Kaufen" steht. Der Verkäufer sieht nicht, warum niemand kauft.

          ⚠️ Deshalb ein Hinweis OBEN und nicht ein Umbau der ganzen Seite.
          Die Zusicherung „alles auf einen Bildschirm" ist mit acht Zielen
          nicht mehr die richtige — wichtig ist nicht, dass „Abmelden" ohne
          Scrollen erreichbar ist, sondern dass das Dringende sichtbar ist.
          Der Hinweis verschwindet von selbst, sobald Stripe bereit ist.

          ⚠️ Keine rote FLÄCHE, nur ein rotes Wort: In Berkat ist Rot die
          laufende Uhr, nie der Hintergrund. ───────────────────────────── */}
      {stripeConnectLabel(stripeState).tone === 'warn' ? (
        <PressFeedback
          kind="card"
          style={styles.moneyNotice}
          disabled={stripeStarting}
          accessibilityState={{ disabled: stripeStarting, busy: stripeStarting }}
          onPress={() => {
            void startStripeConnect().catch((e) =>
              Alert.alert('Das hat nicht geklappt', errText(e)),
            );
          }}
          accessibilityRole="button"
          accessibilityLabel={`Geld empfangen ist ${stripeConnectLabel(stripeState).text} — jetzt einrichten`}
        >
          <Wallet size={21} color={ui.live} />
          <View style={styles.linkCopy}>
            <Text style={styles.moneyNoticeTitle}>
              Geld empfangen ist {stripeConnectLabel(stripeState).text}
            </Text>
            <Text style={styles.moneyNoticeBody}>
              Solange das offen ist, steht an deinen Artikeln „Nachricht schreiben" statt „Kaufen".
            </Text>
          </View>
          {stripeStarting
            ? <ActivityIndicator size="small" color={ui.textMuted} />
            : <ChevronRight size={20} color={ui.textMuted} />}
        </PressFeedback>
      ) : null}
      {/* Die Tür zum eigenen Profil.
          Bis zum 16.08.2026 gab es keine: Acht Stellen in der App springen auf
          /seller/<id>, keine einzige mit der eigenen. Das eigene Regal, die
          eigenen Bürgen und die eigene Bio waren damit unerreichbar — man sah
          seine Seite nur so, wie ein Fremder sie NICHT sieht, nämlich gar nicht.
          Bei Whatnot IST der Konto-Reiter das Profil; hier führt er hin. */}
      <PressFeedback kind="card"
        style={[styles.profileRow]}
        onPress={() => myUserId && router.push(`/seller/${myUserId}`)}
        accessibilityRole="button"
        accessibilityLabel="Mein Profil ansehen"
      >
        <Avatar uri={profile?.avatar_url} name={profile?.username} size={64} ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={styles.name}>
            {profile?.username ?? 'Dein Konto'}
          </Text>
          {/* ⚠️ DIE E-MAIL STEHT HIER, weil der Benutzername keine Kontokennung
              ist — er ist ein Anzeigename. Am 22.09.2026 hat genau das eine
              Stunde gekostet: Auf dem iPhone lief Berkat als ein Konto, im
              Simulator als ein anderes, beide sahen gleich aus, und eine rote
              Warnung wurde dem falschen zugeordnet. Danach war das zweite Konto
              nicht wiederzufinden, weil die Nutzerverwaltung nach E-Mail sucht
              und die App sie nirgends zeigte.

              `selectable`, damit man sie abschreiben kann, ohne sie abzutippen. */}
          {accountEmail ? (
            <Text selectable numberOfLines={1} style={styles.accountEmail}>
              {accountEmail}
            </Text>
          ) : null}
          <Text style={styles.profileHint}>Mein Profil ansehen</Text>
          {profile?.women_only_verified ? (
            <View style={styles.wozBadge}>
              <Lock size={11} color={ui.successInk} />
              <Text style={styles.wozText}>Frauen-Only freigegeben</Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={20} color={ui.textMuted} />
      </PressFeedback>

      <View style={styles.quickActions}>
        <PressFeedback kind="card"
          style={[styles.quickAction, { minWidth: quickActionMinWidth }]}
          onPress={() => router.push('/messages')}
          accessibilityRole="button"
          accessibilityLabel={unreadMessages > 0 ? `Nachrichten, ${unreadMessages} ungelesen` : 'Nachrichten'}
        >
          <View style={styles.quickHead}>
            <View style={styles.quickIcon}><MessageSquare size={22} color={ui.brand} /></View>
            {unreadMessages > 0 ? (
              <View style={styles.linkBadge}>
                <Text style={styles.linkBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.quickLabel}>Nachrichten</Text>
          <Text style={styles.linkHint}>Deine Gespräche</Text>
        </PressFeedback>
        <PressFeedback kind="card"
          style={[styles.quickAction, { minWidth: quickActionMinWidth }]}
          onPress={() => router.push('/saved')}
          accessibilityRole="button"
          accessibilityLabel="Merkliste öffnen"
        >
          <View style={styles.quickHead}>
            <View style={styles.quickIcon}><Heart size={22} color={ui.brand} /></View>
            <ChevronRight size={18} color={ui.textMuted} />
          </View>
          <Text style={styles.quickLabel}>Merkliste</Text>
          <Text style={styles.linkHint}>Deine Favoriten</Text>
        </PressFeedback>
      </View>

      <NavigationRow title="Meine Käufe" detail="Zuschläge, Pakete und Bestellungen" Icon={Package} onPress={() => router.push('/purchases')} />

      <Text accessibilityRole="header" style={styles.sectionLabel}>Für dich</Text>
      <View style={styles.linkGroup}>
        <PressFeedback
          style={[styles.linkRow]}
          onPress={() => router.push('/rewards')}
          accessibilityRole="button"
          accessibilityLabel={openCredits > 0 ? `Einladen und Belohnungen, ${openCredits} Mal Gratis-Versand` : 'Einladen und Belohnungen'}
        >
          <Gift size={21} color={ui.brand} />
          <View style={styles.linkCopy}>
            <Text style={styles.linkLabel}>Einladen & Belohnungen</Text>
            {openCredits > 0 ? (
              <Text style={styles.creditText}>{openCredits}× Gratis-Versand verfügbar</Text>
            ) : (
              <Text style={styles.linkHint}>Berkat mit Freunden teilen</Text>
            )}
          </View>
          <ChevronRight size={18} color={ui.textMuted} />
        </PressFeedback>
        <PressFeedback
          style={[styles.linkRow, styles.linkRowLast]}
          onPress={() => router.push('/notification-settings')}
          accessibilityRole="button"
          accessibilityLabel="Benachrichtigungen einstellen"
        >
          <Bell size={21} color={ui.brand} />
          <View style={styles.linkCopy}>
            <Text style={styles.linkLabel}>Benachrichtigungen</Text>
            <Text style={styles.linkHint}>Du entscheidest, was ankommt</Text>
          </View>
          <ChevronRight size={18} color={ui.textMuted} />
        </PressFeedback>
      </View>

      {/* ⚠️ Eigene Gruppe, eigene Überschrift. Anbieterangaben und Versand
          sind Verkäufer-EINSTELLUNGEN — man rührt sie einmal an und danach
          selten. Sie in derselben Kette wie „Nachrichten" zu führen hiess,
          täglich Gebrauchtes und einmalig Eingerichtetes gleich laut zu
          machen. */}
      <Text accessibilityRole="header" style={styles.sectionLabel}>Verkaufen & Versand</Text>
      <View style={styles.linkGroup}>

      {/* ── ⚠️ GELD EMPFANGEN — steht ganz oben, und zwar mit Grund.
          Ohne verbundenes Stripe-Konto kann ein Verkäufer nichts verkaufen:
          An seinen Artikeln steht „Nachricht schreiben" statt „Kaufen"
          (`checkout_enabled`, gepflegt vom Trigger aus `20260827100000`).
          Das ist die einzige Einstellung dieser Gruppe, ohne die der ganze
          Rest folgenlos bleibt — Impressum und Versandsätze sind wertlos,
          solange niemand bezahlen kann.

          Der Zustand steht ausgeschrieben da statt als Haken: „Stripe prüft"
          und „bereit" sind zwei verschiedene Dinge, und wer das verwechselt,
          sendet einen Abend lang, ohne dass jemand kaufen kann. ─────────── */}
      <PressFeedback
        style={[styles.linkRow]}
        disabled={stripeStarting}
        accessibilityState={{ disabled: stripeStarting, busy: stripeStarting }}
        onPress={() => {
          void startStripeConnect().catch((e) =>
            Alert.alert('Das hat nicht geklappt', errText(e)),
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={`Geld empfangen — ${stripeConnectLabel(stripeState).text}`}
      >
        <Wallet size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Geld empfangen</Text>
          {stripeStarting ? (
          <ActivityIndicator size="small" color={ui.textMuted} />
        ) : (
          <Text
            style={[
              styles.linkWarn,
              stripeConnectLabel(stripeState).tone === 'ok' && { color: ui.success },
              stripeConnectLabel(stripeState).tone === 'muted' && { color: ui.textMuted },
            ]}
          >
            {stripeConnectLabel(stripeState).text}
          </Text>
        )}
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>


      {/* ── Anbieterangaben. Bis zum 19.08.2026 gab es dafür kein Formular:
          Die Spalten standen seit `20260816200000`, die RPC nahm jedes Feld
          entgegen, die Artikelseite prüfte auf Vollständigkeit — nur eintragen
          konnte man sie nirgends. Ein gewerblicher Verkäufer sah damit an jedem
          seiner Angebote einen Mangel, den er selbst nicht beheben konnte
          (Übergabe, Abschnitt 33).

          Die Zeile steht für JEDEN da, nicht nur für Gewerbliche: Auch der
          Wechsel VON privat AUF gewerblich beginnt hier. Der rote Hinweis
          erscheint dagegen nur, wenn tatsächlich etwas fehlt — ein Mahnzeichen
          an einem Privatkonto wäre eine Aufforderung ohne Anlass. ────────── */}
      <PressFeedback
        style={[styles.linkRow]}
        onPress={() => router.push('/seller-details')}
        accessibilityRole="button"
        accessibilityLabel={
          sellerMissing.length > 0
            ? `Anbieterangaben, unvollständig: es fehlen ${sellerMissing.join(', ')}`
            : 'Anbieterangaben'
        }
      >
        <FileText size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Anbieterangaben</Text>
          {sellerMissing.length > 0 ? (
            <Text style={styles.linkWarn}>Angaben vervollständigen</Text>
          ) : (
            <Text style={styles.linkHint}>Verkäuferprofil und Kontaktdaten</Text>
          )}
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>

      {/* ── Versand und Urlaub. Beide beantworten dieselbe Frage — wie kommt
          meine Ware zum Käufer, und kommt sie gerade überhaupt — und stehen
          deshalb auf EINEM Bildschirm.

          Der Urlaubs-Zustand steht als Zeile und nicht nur dort drin: Ein
          ausgeblendetes Regal ist der eine Zustand, den man nicht vergessen
          darf. Gedämpft, nicht rot — Rot ist in Berkat die laufende Uhr, und
          ein Urlaub ist keine Frist. ──────────────────────────────────── */}
      <PressFeedback
        style={[
          styles.linkRow,
          styles.linkRowLast,
        ]}
        onPress={() => router.push('/shipping')}
        accessibilityRole="button"
        accessibilityLabel={sellerAway ? 'Versand — du bist gerade im Urlaub' : 'Versand'}
      >
        <Truck size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Versand</Text>
          <Text style={styles.linkHint}>{sellerAway ? 'Du bist gerade im Urlaub' : 'Versandkosten und Urlaub'}</Text>
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>
      </View>

      <PressFeedback
        style={styles.signOut}
        onPress={() => void supabase.auth.signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Abmelden</Text>
      </PressFeedback>

      {/* ⚠️ Apple 5.1.1(v): Wer in der App ein Konto anlegen kann, muss es dort
          auch löschen können — und DSGVO Art. 17 verlangt die Löschung an sich.
          Berkat hatte bis zum 21.08.2026 nur „Abmelden"; beim Store-Release
          wäre das ein sicherer Ablehnungsgrund gewesen.

          Bewusst als schlichte Textzeile und nicht als Knopf: Der Weg muss
          ERREICHBAR sein, nicht einladend. Was dahinter passiert, erklärt der
          eigene Bildschirm — in einem Dialog ließe sich die Frage „ist mein Kauf
          dann weg?" nicht beantworten. */}
      <PressFeedback
        style={styles.deleteRow}
        onPress={() => router.push('/delete-account')}
        accessibilityRole="button"
        accessibilityLabel="Konto löschen"
      >
        <Text style={styles.deleteText}>Konto löschen</Text>
      </PressFeedback>

      {/* ⚠️ Welcher Stand läuft hier gerade? Am 22.08.2026 blieb ein Fund
          unentscheidbar, weil genau das niemand beantworten konnte (Abschnitt
          68). `expo-updates` startet immer aus dem Zwischenspeicher und nimmt
          eine neue Fassung erst beim NÄCHSTEN Start in Betrieb — an einem Tag
          mit fünfzehn Veröffentlichungen prüft man am Gerät also fast immer den
          vorletzten Stand. Begründung ausführlich in `lib/buildInfo.ts`.

          `selectable`, damit die Zeile aus einer Nachricht heraus lesbar ist —
          dieselbe Überlegung wie bei der Versandadresse in den Bestellungen.
          Kein Knopf: Es gibt nichts zu tun, nur etwas zu wissen. */}
      <Text selectable style={styles.buildLine}>
        {buildLabel()}
      </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: ui.text, marginBottom: space.lg },
  gateTitle: { fontSize: 22, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 20,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    marginBottom: space.md,
  },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: ui.text },
  accountEmail: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: 2 },
  profileHint: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: 4 },
  wozBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 5,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  wozText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '700', color: ui.successInk },

  sectionLabel: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text, marginTop: space.md, marginBottom: space.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  quickAction: {
    flex: 1,
    minWidth: 136,
    padding: space.lg,
    gap: 3,
    borderRadius: radius.lg,
    backgroundColor: ui.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  quickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  quickIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },

  /* ── ⚠️ AUS SECHS KARTEN WURDE EINE LISTE (26.08.2026) ──────────────────
     Hier stand `backgroundColor` + `borderRadius` + `marginBottom: space.lg`
     an JEDER Zeile — sechs freischwebende Karten mit grossen Lücken
     dazwischen. Am Gerät gemeldet: „ich finde diese seite nicht schön".

     Der Fehler war nicht die einzelne Zeile, sondern dass es **sechs Objekte
     waren statt einer Liste**. Jede Lücke kostete Höhe, ohne etwas zu sagen —
     und „Nachrichten" (täglich) sah aus wie „Anbieterangaben" (einmal).

     Jetzt trägt die GRUPPE die Fläche, die Zeile nur eine Haarlinie — das
     Muster der iOS-Einstellungen. Zwei Gruppen statt einer Kette: was man
     täglich braucht, und was Verkäufer-Einstellung ist. */
  linkGroup: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  /* Die letzte Zeile einer Gruppe trägt keine Linie — sonst läge sie auf der
     abgerundeten Kante und sähe aus wie ein Fehler. */
  linkRowLast: { borderBottomWidth: 0 },
  linkCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  linkLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  linkHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  linkWarn: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.live },
  /* ⚠️ Eigene Flaeche, sonst schwebt der Hinweis auf dem Grund, waehrend
     jede andere Zeile der Seite auf einer Karte sitzt — am 22.09.2026 im
     Simulator gesehen. `kind="card"` an `PressFeedback` steuert nur die
     Druck-Animation, nicht den Hintergrund; das ist leicht zu verwechseln. */
  moneyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.lg,
  },
  moneyNoticeTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.live },
  moneyNoticeBody: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: 2 },
  linkBadge: {
    minWidth: 20,
    minHeight: 24,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: { fontSize: 11, fontWeight: '800', color: ui.goldInk },
  creditText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.success },

  primaryButton: {
    backgroundColor: ui.gold,
    borderRadius: radius.pill,
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  // Textzeile, kein Knopf, und gedämpft statt rot: Rot wäre in Berkat die
  // laufende Uhr, und ein Dauer-Alarmzeichen im Konto-Reiter wäre eine Drohung.
  // Der Ernst gehört auf den Bildschirm dahinter, nicht auf den Weg dorthin.
  deleteRow: { marginTop: space.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm },
  deleteText: { fontSize: 13, color: ui.textMuted, textDecorationLine: 'underline' },
  // Leiser als alles andere auf dem Bildschirm: Die Zeile ist eine Auskunft für
  // den Fall, dass jemand fragt — nicht etwas, das man beim Scrollen liest.
  buildLine: { marginTop: space.sm, fontSize: 11, color: ui.textMuted, textAlign: 'center' },
  signOut: {
    marginTop: space.lg,
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: ui.text },
});
