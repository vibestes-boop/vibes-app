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
  ChevronRight,
  Gift,
  Heart,
  Lock,
  MessageSquare,
  Package,
  Settings,
  Wallet,
} from 'lucide-react-native';
import { useSession } from '../../lib/session';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { useMyRewards } from '../../lib/useRewards';
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
import { useSellerEverStarted } from '../../components/SellerStart';

export default function AccountScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const quickActionMinWidth = Math.min(width - space.lg * 2, Math.ceil(136 * Math.max(1, fontScale)));
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);

  // Geld empfangen (Connect Standard, Übergabe 96). Der Zustand kommt vom
  // Server; hier wird nur angezeigt und angestossen.
  const { data: stripeState = 'none' } = useStripeConnectState(myUserId);
  const { data: accountEmail } = useAccountEmail(myUserId);
  /**
   * ⚠️ Der Geld-Hinweis gilt nur fuer VERKAEUFER — seit 22.09.2026.
   *
   * Am Tag zuvor stand er an jedem Konto. Zaur, der mit einem reinen
   * Kaeufer-Konto unterwegs war, tippte ihn an, landete in Stripes
   * Verkaeufer-Anmeldung (Bankverbindung, Unternehmensdaten) und fragte, ob
   * er sein **echtes privates Stripe-Konto** verbinden solle.
   *
   * „Geld empfangen unvollstaendig" ist fuer jemanden, der nur kauft, keine
   * Warnung, sondern eine Aufforderung ohne Anlass. Dieselbe Regel gilt bei
   * den Anbieterangaben seit dem 19.08. („ein Mahnzeichen an einem
   * Privatkonto waere eine Aufforderung ohne Anlass") — ich habe sie dort
   * befolgt und hier vergessen.
   *
   * ⚠️ Gemessen an „hat schon mal etwas eingestellt oder angekuendigt",
   * nicht am aktuellen Regal: Wer alles verkauft hat, bleibt Verkaeufer und
   * muss weiter sehen, wenn seine Auszahlung haengt.
   */
  const { everAnnounced, everListed } = useSellerEverStarted(myUserId);
  const sells = everAnnounced || everListed;
  const { start: startStripeConnect, isStarting: stripeStarting } =
    useStartStripeConnect(myUserId);
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
      {/* ⚠️ Der Titel steht jetzt in einer Zeile mit dem Zahnrad. Vorher
          gab es hier ueberhaupt keinen Weg zu den Einstellungen — sie
          lagen als Zeilen mitten in dieser Liste, zwischen Nachrichten
          und Kaeufen. */}
      <View style={styles.pageHead}>
        <Text accessibilityRole="header" style={styles.pageTitle}>Konto</Text>
        <PressFeedback hitSlop={10} style={styles.gear}
          onPress={() => router.push('/settings')}
          accessibilityRole="button" accessibilityLabel="Einstellungen">
          <Settings size={22} color={ui.text} />
        </PressFeedback>
      </View>

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
      {sells && stripeConnectLabel(stripeState).tone === 'warn' ? (
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

      {/* „Einladen & Belohnungen" bleibt im Konto und wandert NICHT in die
          Einstellungen: Es ist kein Schalter, den man einmal umlegt, sondern
          ein Angebot, das man benutzt — wie „Meine Käufe" darüber. */}
      <NavigationRow title="Einladen & Belohnungen"
        detail={openCredits > 0 ? `${openCredits}× Gratis-Versand verfügbar` : 'Berkat mit Freunden teilen'}
        Icon={Gift} onPress={() => router.push('/rewards')} />


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: ui.text },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  /* Die letzte Zeile einer Gruppe trägt keine Linie — sonst läge sie auf der
     abgerundeten Kante und sähe aus wie ein Fehler. */
  linkCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  linkHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
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
  // Leiser als alles andere auf dem Bildschirm: Die Zeile ist eine Auskunft für
  // den Fall, dass jemand fragt — nicht etwas, das man beim Scrollen liest.
});
