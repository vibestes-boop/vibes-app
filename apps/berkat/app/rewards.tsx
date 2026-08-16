// Einladen — Whatnots „Rewards", aber ohne Glücksspiel und ohne Guthaben.
//
// Zwei Dinge stehen hier bewusst NICHT:
//
//   • Keine Staffel („noch 2 bis zur nächsten Stufe"). Staffeln erzeugen den
//     Druck, Menschen zu werben, die man gar nicht überzeugen will. In einer
//     engen Community ist das der schnellste Weg, den eigenen Namen zu
//     verbrennen — und die Community IST hier das Produkt.
//   • Kein Zufall, keine Überraschungs-Belohnung, kein Rad. Dieselbe Linie wie
//     bei den Auktionen: Spannung über den Preis, nie über das Was. Genau
//     deshalb steckt Whatnot seit März 2026 in Schiedsverfahren.
//
// Was stattdessen zählt: Namen. Wer wen gebracht hat, steht mit Namen da —
// dieselbe Haltung wie beim Bürgen-System (HANDOFF 15).

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Gift, Share2, Sparkles, UserPlus } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import {
  rewardErrorText,
  useClaimReferral,
  useInviteText,
  useMyReferralCode,
  useMyRewards,
} from '../lib/useRewards';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);

  const { data: rewards } = useMyRewards(userId);
  const { data: code } = useMyReferralCode(userId);
  const claim = useClaimReferral(userId);
  // Ab Werk aus. Solange der Käufer-Bonus nicht läuft, verspricht diese Seite
  // ihn auch nicht — weder in einer Karte noch im Teilen-Text. Die Herleitung
  // steht in `lib/useRewards.ts` und im Kopf der Migration.
  const buyerRewards = rewards?.buyer_rewards_enabled ?? false;
  const inviteText = useInviteText(code ?? null, buyerRewards);

  const [entry, setEntry] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const share = useCallback(async () => {
    try {
      await Share.share({ message: inviteText() });
    } catch {
      // Abbrechen ist kein Fehler — der Nutzer hat sich umentschieden.
    }
  }, [inviteText]);

  const redeem = useCallback(async () => {
    const value = entry.trim();
    if (value.length < 6) {
      setNotice('Ein Code hat sechs Zeichen.');
      return;
    }
    setNotice(null);
    try {
      const result = await claim.mutateAsync(value);
      setEntry('');
      const from = result?.inviter_name;
      setNotice(
        result?.credit_granted
          ? from
            ? `Eingelöst — ${from} hat dir den ersten Versand geschenkt. 🎁`
            : 'Eingelöst — dein erster Versand ist geschenkt. 🎁'
          : from
            ? `Eingelöst — du bist jetzt über ${from} hier. 🙂`
            : 'Eingelöst. 🙂',
      );
    } catch (err) {
      setNotice(rewardErrorText((err as Error)?.message ?? ''));
    }
  }, [claim, entry]);

  if (!userId) {
    return (
      <View style={[styles.screen, styles.gate, { paddingTop: insets.top }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.gateBody}>
          Mit einem Konto bekommst du deinen eigenen Einladungs-Code.
        </Text>
        <Pressable style={styles.primary} onPress={() => router.push('/login')}>
          <Text style={styles.primaryText}>Anmelden</Text>
        </Pressable>
      </View>
    );
  }

  const invited = rewards?.invited ?? [];
  const perks = rewards?.perks ?? [];
  const creditsOpen = rewards?.credits_open ?? 0;
  const creditsUsed = rewards?.credits_used ?? 0;
  // Der Mindestwarenwert gehört an die Gutschrift geschrieben, nicht in die
  // AGB: Wer ihn erst an der Kasse merkt, hält es für einen Fehler.
  const minCartEuro = rewards?.min_cart_cents
    ? `${Math.floor(rewards.min_cart_cents / 100)},${String(rewards.min_cart_cents % 100).padStart(2, '0')} €`
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Einladen</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Der eigene Code ───────────────────────────────────────────────── */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Dein Code</Text>
          <Text style={styles.code}>{code ?? '······'}</Text>
          <Pressable
            style={styles.shareButton}
            onPress={() => void share()}
            accessibilityRole="button"
            accessibilityLabel="Einladung teilen"
          >
            <Share2 size={17} color={ui.goldInk} />
            <Text style={styles.shareText}>Einladung teilen</Text>
          </Pressable>
          <Text style={styles.codeHint}>
            Der Code lässt sich vorlesen — im Alphabet sind kein I, O, 0 und 1, damit sich in einer
            Sprachnachricht nichts verwechselt.
          </Text>
        </View>

        {/* ── Was es bringt ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Was du bekommst</Text>

        {/* Diese Karte hängt am Schalter. Sie steht nur da, wenn es den Bonus
            wirklich gibt — ein Versprechen ohne Deckung ist in einer engen
            Community teurer als gar kein Bonus. */}
        {buyerRewards ? (
          <View style={styles.card}>
            <View style={styles.ruleHead}>
              <Gift size={17} color={ui.success} />
              <Text style={styles.ruleTitle}>Du bringst einen Käufer</Text>
            </View>
            <Text style={styles.ruleBody}>
              Er bekommt seinen ersten Versand geschenkt. Du bekommst selbst einen Gratis-Versand,
              sobald genug von deinen Leuten wirklich gekauft haben.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.ruleHead}>
            <Sparkles size={17} color={ui.success} />
            <Text style={styles.ruleTitle}>Du bringst einen Verkäufer</Text>
          </View>
          <Text style={styles.ruleBody}>
            Sobald er zum ersten Mal etwas verkauft, bekommt ihr beide 30 Tage provisionsfrei.
            Berkat nimmt heute noch gar keine Provision — die 30 Tage starten an dem Tag, an dem
            sich das ändert.
          </Text>
        </View>

        {/* ── Mein Stand ────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Dein Stand</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{invited.length}</Text>
            <Text style={styles.statLabel}>eingeladen</Text>
          </View>
          {/* Versand-Gutschriften nur zeigen, wenn es sie geben kann — oder wenn
              noch welche aus einer früheren Phase herumliegen. Eine dauerhafte
              Null ist kein Stand, sondern eine offene Frage. */}
          {buyerRewards || creditsOpen + creditsUsed > 0 ? (
            <View style={styles.stat}>
              <Text style={styles.statNum}>{creditsOpen}</Text>
              <Text style={styles.statLabel}>Gratis-Versand offen</Text>
            </View>
          ) : null}
          <View style={styles.stat}>
            <Text style={styles.statNum}>
              {perks.reduce((sum, p) => sum + p.days, 0)}
            </Text>
            <Text style={styles.statLabel}>Tage provisionsfrei</Text>
          </View>
        </View>

        {creditsOpen > 0 ? (
          <View style={styles.goodNews}>
            <Check size={16} color={ui.successInk} />
            <Text style={styles.goodNewsText}>
              {creditsOpen === 1
                ? 'Dein nächstes Paket kommt versandkostenfrei — der Abzug passiert automatisch an der Kasse.'
                : `${creditsOpen} deiner nächsten Pakete kommen versandkostenfrei — je eines pro Bestellung.`}
              {minCartEuro ? ` Gilt ab ${minCartEuro} Warenwert.` : ''}
            </Text>
          </View>
        ) : null}

        {/* ── Wen ich gebracht habe ─────────────────────────────────────────── */}
        {invited.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Von dir gebracht</Text>
            <View style={styles.card}>
              {invited.map((person, index) => (
                <View
                  key={`${person.name}-${index}`}
                  style={[styles.personRow, index > 0 && styles.personRowSplit]}
                >
                  <UserPlus size={15} color={ui.textMuted} />
                  <Text numberOfLines={1} style={styles.personName}>
                    {person.name}
                  </Text>
                  {/* Kein „wartet noch" als Vorwurf — nur der Zustand. Wer
                      jemanden mitgebracht hat, hat seinen Teil getan. */}
                  <Text style={[styles.personState, person.bought && styles.personStateDone]}>
                    {person.selling ? 'verkauft' : person.bought ? 'hat gekauft' : 'dabei'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Code einlösen ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Hat dich jemand eingeladen?</Text>

        {rewards?.invited_by ? (
          <View style={styles.card}>
            <Text style={styles.ruleBody}>
              Du bist über <Text style={styles.strong}>{rewards.invited_by}</Text> gekommen. Eine
              Einladung gilt für immer und lässt sich nicht wechseln.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.entryRow}>
              <TextInput
                value={entry}
                onChangeText={(text) => setEntry(text.toUpperCase())}
                placeholder="CODE"
                placeholderTextColor={ui.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={styles.entryInput}
              />
              <Pressable
                style={[styles.redeem, claim.isPending && styles.redeemBusy]}
                disabled={claim.isPending}
                onPress={() => void redeem()}
                accessibilityRole="button"
                accessibilityLabel="Code einlösen"
              >
                {claim.isPending ? (
                  <ActivityIndicator color={ui.goldInk} />
                ) : (
                  <Text style={styles.redeemText}>Einlösen</Text>
                )}
              </Pressable>
            </View>
            <Text style={styles.entryHint}>
              Geht nur vor deinem ersten Kauf — danach ist es zu spät.
            </Text>
          </View>
        )}

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {buyerRewards || creditsOpen + creditsUsed > 0 ? (
          <Text style={styles.footNote}>
            Gutschriften sind nicht auszahlbar und nicht übertragbar. Sie verfallen nicht
            {minCartEuro ? ` und gelten ab ${minCartEuro} Warenwert` : ''}.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  gate: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  gateTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  codeCard: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  codeLabel: { fontSize: 12, fontWeight: '600', color: ui.textMuted },
  code: {
    fontSize: 34,
    fontWeight: '700',
    color: ui.text,
    letterSpacing: 6,
    // Ein Code wird abgetippt und verglichen — eine Schrift mit gleich breiten
    // Zeichen macht das lesbarer als die Systemschrift.
    fontVariant: ['tabular-nums'],
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    marginTop: space.xs,
  },
  shareText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  codeHint: { fontSize: 11, color: ui.textMuted, textAlign: 'center', lineHeight: 16 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ui.textMuted,
    marginTop: space.xl,
    marginBottom: space.sm,
  },

  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.sm,
    gap: 6,
  },
  ruleHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ruleTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  ruleBody: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  strong: { fontWeight: '700', color: ui.text },

  statRow: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: 2,
  },
  statNum: { fontSize: 24, fontWeight: '700', color: ui.text },
  statLabel: { fontSize: 11, color: ui.textMuted, textAlign: 'center', lineHeight: 15 },

  goodNews: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: ui.success,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
  },
  goodNewsText: { flex: 1, fontSize: 13, color: ui.successInk, lineHeight: 19 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 7 },
  personRowSplit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  personName: { flex: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  personState: { fontSize: 12, color: ui.textMuted },
  personStateDone: { color: ui.success, fontWeight: '700' },

  entryRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  entryInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 3,
    color: ui.text,
  },
  redeem: {
    minWidth: 96,
    height: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBusy: { opacity: 0.6 },
  redeemText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },
  entryHint: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    marginTop: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },

  footNote: {
    fontSize: 11,
    color: ui.textMuted,
    textAlign: 'center',
    marginTop: space.xl,
    lineHeight: 16,
  },

  primary: {
    marginTop: space.md,
    height: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
