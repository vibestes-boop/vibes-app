// Die Artikelseite — ein Angebot, ein Bildschirm.
//
// WARUM SIE FEHLTE UND WAS DAS KOSTETE
// Bis zum 17.08.2026 führte jeder Tipp auf ein Angebot auf `/seller/<id>`, also
// aufs Profil des Verkäufers. Man tippte auf „Silberring" und landete auf einer
// Seite voller anderer Produkte — genau der Fehler, der in HANDOFF 13 schon
// einmal beschrieben ist („man tippte auf ‚Fahrrad · Morgen 18:00' und landete
// auf einer Seite voller Produkte; das Einzige, wofür man gekommen war, war das
// Einzige, was nicht zu sehen war").
//
// Drei Dinge hingen daran:
//
//  1. Die BESCHREIBUNG war unsichtbar. Sie steht seit 20260816210000 in der
//     Datenbank, der Composer hat ein Feld dafür, die Abfrage holte sie — und
//     kein Bildschirm zeigte sie an. Bei einem Dauerangebot ist sie die einzige
//     Beschreibung, die es je geben wird: In einer Show erzählt der Verkäufer,
//     hier steht nur, was er getippt hat.
//
//  2. Die RECHTSFOLGE der Anbieterkennzeichnung stand nirgends. `sellerKindNote()`
//     existierte fertig in `useBerkatSeller.ts` und hatte keinen einzigen
//     Aufrufer; die Karten zeigten „Privatverkauf" als bloßes Etikett. Art. 246d
//     § 1 EGBGB verlangt aber, dass der Käufer VOR seiner Vertragserklärung
//     erfährt, was daraus folgt.
//
//  3. Der KAUF lag im Stöber-Raster. Am 16.08.2026 bekam schon das Gebot eine
//     Ziehbahn statt eines Tippers — „ein Bildschirm, auf dem Tippen die normale
//     Geste ist, darf keinen Kauf mit demselben Tippen auslösen". Ein Sofortkauf
//     schließt den Vertrag sofort und war trotzdem ein goldener Knopf zwischen
//     Stöber-Karten, ohne Beschreibung, ohne Versandkosten, ohne Rechtsfolge.
//
// Diese Seite ist die Antwort auf alle drei: Sie zeigt, was es zu wissen gibt,
// und trägt als einzige Fläche den Kaufknopf. Damit ist der Ort der
// Vertragserklärung genau der Ort, an dem die Pflichtangabe steht.
//
// KEIN TEILEN-KNOPF. Die Website unter `SITE_URL` kennt nur `/live` — ein
// geteilter Artikel-Link ginge ins Leere. Kommt eine Artikelseite im Netz dazu,
// gehört er hierher (Muster: `showLink()` in `lib/links.ts`).

import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageCircle,
  Package,
  Star,
} from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { formatEuro, useProfiles } from '../../lib/useAuction';
import {
  conditionLabel,
  missingBusinessFields,
  sellerKindNote,
  useBerkatSeller,
} from '../../lib/useBerkatSeller';
import { useListing } from '../../lib/useListings';
import { formatRating, useSellerStats } from '../../lib/useSellerStats';
import { shippingHint, useShippingFrom } from '../../lib/useShipping';
import { standingErrorText, useStandingActions } from '../../lib/useStanding';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, space, ui } from '../../theme/tokens';

/** Ein Hinweis, der einen Weg mitbringen kann statt nur einen Rat. */
type Notice = { text: string; cta?: 'cart' };

/**
 * Erfolgs-Haptik für den einzigen Kaufweg der App.
 *
 * ⚠️ Geladen wie LiveKit und `expo-web-browser`: **bedingt per `require` in
 * `try/catch`.** `expo-haptics` steht zwar in der `package.json`, wurde aber
 * bis zum 17.08.2026 nirgends importiert — ob das native Gegenstück in einem
 * gegebenen Build tatsächlich verlinkt ist, weiß niemand. Ein statischer Import
 * würde beim Laden der Datei werfen und den ganzen Bildschirm mitreißen; ohne
 * das Modul fällt hier schlicht die Vibration weg.
 */
function celebrate(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const H = require('expo-haptics');
    void H.notificationAsync?.(H.NotificationFeedbackType?.Success);
  } catch {
    // Kein Haptik-Modul im Build — der Kauf hat trotzdem geklappt.
  }
}

/**
 * „Eingestellt heute" ist eine Auskunft, „Eingestellt am 17.08.26" nicht.
 *
 * Gerechnet wird in KALENDERTAGEN, nicht in Millisekunden — `(a - b) / 86_400_000`
 * beantwortet „wie viele 24-Stunden-Blöcke liegen dazwischen", nicht „welcher
 * Tag ist das". Ein Artikel von gestern 23:00 wäre um 08:00 morgens sonst
 * „heute". Dieselbe Unterscheidung wie bei den Show-Zeiten (HANDOFF 18).
 */
function listedWhen(iso: string): string {
  const then = new Date(iso);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return 'heute eingestellt';
  if (days === 1) return 'gestern eingestellt';
  if (days < 7) return `vor ${days} Tagen eingestellt`;
  if (days < 14) return 'vor einer Woche eingestellt';
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen eingestellt`;
  return `eingestellt am ${then.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })}`;
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const sessionLoading = useSession((s) => s.loading);

  const { data: listing, isLoading, refetch } = useListing(id);
  const sellerId = listing?.seller_id;

  const profiles = useProfiles([sellerId]);
  const seller = sellerId ? profiles[sellerId] : undefined;
  const { data: stats } = useSellerStats(sellerId);
  const { data: sellerRow, isLoading: sellerLoading } = useBerkatSeller(sellerId);
  const { data: shipFrom } = useShippingFrom(sellerId);

  const actions = useStandingActions(sellerId, myUserId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Dieselbe Falle wie überall: Stack-Bildschirme bleiben aufgebaut. Wer von
  // hier auf das Profil geht, den Artikel dort zurückzieht und zurückkommt,
  // sähe sonst weiter einen Kaufknopf für etwas, das es nicht mehr gibt.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const mine = Boolean(myUserId && listing && myUserId === listing.seller_id);
  const gone = Boolean(listing && listing.status !== 'listed');
  /** Steuert NUR den Rechtstext — nicht den Weg. Siehe `canCheckout`. */
  const isPrivate = listing?.seller_kind === 'private';

  /**
   * ⚠️ Der Kaufweg hängt an `checkout_enabled`, NICHT an `seller_kind`.
   *
   * Bis zum 17.08.2026 entschied die Oberfläche „privat → Nachricht, sonst
   * Kaufen", der Server aber an `berkat_sellers.checkout_enabled`
   * (`buy_now_live_auction`, Wächter 2). Das sind zwei verschiedene Spalten für
   * dieselbe Frage, und sie liefen zwangsläufig auseinander:
   *
   *   • `set_berkat_seller_kind` fasst `checkout_enabled` ausdrücklich nicht an
   *   • jede neu entstandene Zeile trägt die Vorgabe `false`
   *
   * Ein gewerblicher Verkäufer hatte damit per Konstruktion `kind = 'business'`
   * UND `checkout_enabled = false` — die App zeigte ihm einen goldenen
   * Kaufknopf, den der Server garantiert mit `contact_seller` verweigert. Und
   * ein Angebot mit `seller_kind = NULL` bekam ihn ebenfalls: `isPrivate` ist
   * eine zweiwertige Prüfung auf einer dreiwertigen Spalte.
   *
   * Jetzt gilt: `checkout_enabled` entscheidet den Knopf, `seller_kind` den
   * Text. Wer das wieder zusammenlegt, baut die Sackgasse zurück.
   */
  const canCheckout = sellerRow?.checkout_enabled === true;

  const missing = useMemo(() => missingBusinessFields(sellerRow ?? null), [sellerRow]);

  /**
   * Der Gast-Zweig.
   *
   * ⚠️ `session.loading` muss mit: Beim Kaltstart steht `userId` kurz auf
   * `null`, obwohl eine Sitzung existiert. Ohne die Abfrage schickte ein
   * schneller Tipp einen Angemeldeten auf die Anmeldeseite — auf dem Kaufweg
   * ist das teurer als anderswo.
   */
  const needsLogin = useCallback((): boolean => {
    if (sessionLoading) return true;
    if (!myUserId) {
      router.push('/login');
      return true;
    }
    return false;
  }, [myUserId, sessionLoading]);

  const onBuy = useCallback(async () => {
    if (!listing || needsLogin()) return;
    setBusy(true);
    setNotice(null);
    try {
      await actions.buy.mutateAsync(listing.id);
      // Design-Gesetz 1: Ein Kauf ist ein Peak. Auge und Hand zusammen — und
      // danach ein WEG, keine Wegbeschreibung. Vorher endete der teuerste
      // Moment der App in einem Satz („Bezahlen kannst du unter ‚Konto'"), und
      // der Käufer musste zweimal zurück und einen Reiter suchen.
      celebrate();
      setNotice({ text: 'Im Paket. 🎉', cta: 'cart' });
    } catch (err) {
      setNotice({ text: standingErrorText(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }, [actions.buy, listing, needsLogin]);

  const onContact = useCallback(() => {
    if (!listing || needsLogin()) return;
    router.push(
      `/messages/${listing.seller_id}?draft=${encodeURIComponent(
        `Hallo! Ist „${listing.title}" noch da?`,
      )}`,
    );
  }, [listing, needsLogin]);

  const onCancel = useCallback(async () => {
    if (!listing) return;
    setBusy(true);
    setNotice(null);
    try {
      await actions.cancel.mutateAsync(listing.id);
      setNotice({ text: 'Zurückgezogen.' });
    } catch (err) {
      setNotice({ text: standingErrorText(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }, [actions.cancel, listing]);

  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={10} onPress={() => goBack('/shop')} style={styles.back}>
        <ChevronLeft size={24} color={ui.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Angebot</Text>
      <View style={styles.back} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={ui.brand} />
        </View>
      </View>
    );
  }

  // `null` heißt: gibt es nicht — oder es ist ein Frauen-Only-Artikel, für den
  // dem Betrachter der Zugang fehlt. Beides bekommt bewusst DENSELBEN Text,
  // damit die Existenz eines geschützten Artikels nicht über die Antwort
  // durchsickert. Dieselbe Sprache spricht `buy_now_live_auction` seit
  // 20260816210000 serverseitig.
  if (!listing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <BerkatMark size={38} color={ui.sunken} />
          <Text style={styles.emptyTitle}>Dieses Angebot gibt es nicht mehr</Text>
          <Text style={styles.emptyBody}>
            Vielleicht wurde es verkauft oder zurückgezogen. Unter „Kategorien" liegt, was
            gerade sonst noch da ist.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace('/shop')}>
            <Text style={styles.emptyBtnText}>Alle Angebote ansehen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = [
    conditionLabel(listing.condition),
    [listing.postal_code, listing.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean) as string[];

  const kindNote = sellerKindNote(listing.seller_kind);
  const ship = shippingHint(shipFrom);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}

      <ScrollView
        contentContainerStyle={{
          // Die Leiste unten verdeckt NICHTS: Sie ist ein normales
          // Flex-Geschwister im Wurzel-View, keine schwebende Ebene, und die
          // ScrollView schrumpft von selbst auf den Rest. Sie trägt auch die
          // Sicherheitszone selbst — hier wäre `insets.bottom` doppelt.
          //
          // Das Polster ist nur ein sauberer Abschluss. Absolut liegt einzig
          // der Hinweis-Kasten, und der ist flüchtig und wegtippbar.
          paddingBottom: space.xl,
        }}
      >
        {/* ── Das Bild. Quadratisch und volle Breite: Hier wird gestöbert, und
            auf einer Stöber-Fläche IST das Bild der Inhalt (HANDOFF 18).
            `pickImage` schneidet ohnehin quadratisch zu. ─────────────────── */}
        <View style={styles.hero}>
          {listing.image_url ? (
            <Image
              source={{ uri: listing.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
            />
          ) : (
            <View style={styles.heroEmpty}>
              <BerkatMark size={44} color={ui.lineStrong} />
            </View>
          )}
          {listing.women_only ? (
            <View style={styles.heroLock}>
              <Lock size={12} color={ui.successInk} />
              <Text style={styles.heroLockText}>Frauen-Only</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* ── Preis vor Titel. Bei einem Festpreis ist die Zahl die Frage,
              die zuerst beantwortet werden muss. ─────────────────────────── */}
          <Text style={styles.price}>{formatEuro(listing.buy_now_cents)}</Text>
          <Text style={styles.title}>{listing.title}</Text>

          {meta.length ? (
            <View style={styles.chips}>
              {meta.map((text) => (
                <View key={text} style={styles.chip}>
                  <Text style={styles.chipText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.when}>{listedWhen(listing.created_at)}</Text>

          {/* ── Die Pflichtangabe nach Art. 246d § 1 EGBGB, mit Rechtsfolge.
              Steht ÜBER der Beschreibung und damit vor allem, was zum Kauf
              überredet — sie ist keine Fußnote.

              Berkat formuliert dabei ausdrücklich KEINEN Gewährleistungs-
              ausschluss: Ein von der Plattform gestellter Standardsatz wäre
              eine AGB nach §§ 305 ff. BGB, auch zwischen Privatleuten, und
              nach § 309 Nr. 7 BGB unwirksam — der Privatverkäufer stünde
              schlechter da als ohne unsere „Hilfe". Wir kennzeichnen nur, WER
              verkauft, und sagen, was daraus folgt. ──────────────────────── */}
          {kindNote ? (
            <View style={styles.legal}>
              <Text style={styles.legalText}>{kindNote}</Text>
              <Text style={styles.legalSub}>
                {isPrivate
                  ? 'Ein Privatverkauf zwischen zwei Menschen. Was der Verkäufer zum Zustand schreibt, gilt — Rückgabe ist Verhandlungssache.'
                  : 'Gewerblicher Verkauf. 14 Tage Widerrufsrecht und gesetzliche Gewährleistung.'}
              </Text>
            </View>
          ) : null}

          {/* ── Die Beschreibung. Bis heute unsichtbar. ──────────────────── */}
          {listing.description ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Beschreibung</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {/* ── Der Verkäufer. Das war bis heute das ZIEL jedes Tipps auf ein
              Angebot; jetzt ist es eine Zeile auf der Seite, die man
              eigentlich sehen wollte. ────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.sellerRow, pressed && styles.pressed]}
            onPress={() => sellerId && router.push(`/seller/${sellerId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${seller?.username ?? 'Verkäufer'} ansehen`}
          >
            <Avatar uri={seller?.avatarUrl} name={seller?.username} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.sellerName}>
                {seller?.username ?? '…'}
              </Text>
              <View style={styles.sellerStats}>
                {/* Kein erfundener Wert: Ohne Bewertung steht dort, dass es
                    keine gibt. „5,0" ohne eine einzige Bewertung behauptet
                    Vertrauen, das niemand vergeben hat (HANDOFF 10). */}
                {stats?.rating != null ? (
                  <>
                    <Star size={12} color={ui.gold} fill={ui.gold} />
                    <Text style={styles.sellerStatText}>
                      {formatRating(stats.rating)} · {stats.ratingCount}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.sellerStatText}>Noch keine Bewertung</Text>
                )}
                {stats?.sold ? (
                  <Text style={styles.sellerStatText}>· {stats.sold} Zuschläge</Text>
                ) : null}
              </View>
            </View>
            <ChevronRight size={18} color={ui.textMuted} />
          </Pressable>

          {/* ── Versand. Der Satz stand bisher nur im Live-Raum und im Regal,
              also überall außer dort, wo jemand gerade kauft. ─────────────── */}
          <View style={styles.shipRow}>
            <Package size={15} color={ui.textMuted} />
            <Text style={styles.shipText}>
              {ship ? `${ship}. ` : ''}
              Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.
            </Text>
          </View>

          {/* ── Anbieterangaben eines gewerblichen Verkäufers.
              Bei einem gewerblichen Verkäufer sind Name und Anschrift
              gesetzlich öffentlich. Fehlen sie, steht das offen da statt
              still zu fehlen — HANDOFF 20 führt genau diesen Streifen als
              „nicht gebaut". ─────────────────────────────────────────────── */}
          {listing.seller_kind === 'business' ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Anbieterangaben</Text>
              {/* ⚠️ DREI Zustände, nicht zwei. `missingBusinessFields` gibt für
                  „ich weiß nichts" (`null`) dasselbe leere Array zurück wie für
                  „alles da" — wer nur auf `missing.length` prüft, dreht
                  „keine Daten" in „vollständig" um und zeigt die Überschrift
                  über einem leeren `join('\n')`. Ausgerechnet bei einer
                  Pflichtangabe die falsche Richtung.

                  `sellerRow` ist dabei zwangsläufig eine Weile `undefined`: Der
                  Hook wird erst aktiv, wenn `sellerId` aus dem geladenen
                  Angebot vorliegt — also NACH der eigenen `isLoading`-Schranke
                  dieses Bildschirms. */}
              {sellerLoading ? (
                <ActivityIndicator style={{ alignSelf: 'flex-start' }} color={ui.textMuted} />
              ) : !sellerRow || missing.length ? (
                <Text style={styles.legalWarn}>
                  {mine
                    ? `Unvollständig — es fehlen: ${
                        missing.length ? missing.join(', ') : 'alle Angaben'
                      }. Trag sie im Konto nach, sie stehen an jedem deiner Angebote.`
                    : 'Dieser Verkäufer hat seine Anbieterangaben noch nicht vollständig hinterlegt.'}
                </Text>
              ) : (
                <Text style={styles.imprint}>
                  {[
                    sellerRow?.legal_name,
                    sellerRow?.street,
                    [sellerRow?.postal_code, sellerRow?.city].filter(Boolean).join(' '),
                    sellerRow?.country,
                    sellerRow?.contact_email,
                    sellerRow?.vat_id ? `USt-IdNr. ${sellerRow.vat_id}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {notice ? (
        <View style={[styles.notice, { bottom: insets.bottom + 88 }]}>
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button">
            <Text style={styles.noticeText}>{notice.text}</Text>
          </Pressable>
          {/* Ein Weg, keine Wegbeschreibung. Bewusst „Zum Sammelkorb" und
              NICHT „Bezahlen": `checkout_auction_cart` friert den Korb ein,
              jeder weitere Kauf beim selben Verkäufer landet danach in einem
              NEUEN Korb — der Käufer zahlte zweimal Versand. Dieselbe
              Begründung wie im Live-Raum (Übergabe Abschnitt 11); auf einem
              Marktplatz stöbert man weiter, die Lage ist die einer laufenden
              Show, nicht die an ihrem Ende. */}
          {notice.cta === 'cart' ? (
            <Pressable
              style={styles.noticeBtn}
              onPress={() => router.push('/(tabs)/account')}
              accessibilityRole="button"
              accessibilityLabel="Zum Sammelkorb"
            >
              <Text style={styles.noticeBtnText}>Zum Sammelkorb</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Die Leiste. EIN Weg, und er steht immer an derselben Stelle. ──── */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
        {gone ? (
          // Ein verkaufter oder zurückgezogener Artikel bleibt lesbar (die
          // Lese-Policy filtert nicht auf den Status). Das ist Absicht: Wer aus
          // einer Nachricht auf etwas kommt, das vor zehn Minuten weg ging,
          // soll das erfahren — und nicht auf einer Fehlerseite landen.
          <View style={styles.goneBar}>
            <Text style={styles.goneText}>
              {listing.status === 'sold' ? 'Schon verkauft' : 'Zurückgezogen'}
            </Text>
          </View>
        ) : mine ? (
          <Pressable
            style={[styles.ghost, busy && styles.off]}
            disabled={busy}
            onPress={() => void onCancel()}
            accessibilityRole="button"
            accessibilityLabel="Angebot zurückziehen"
          >
            {busy ? (
              <ActivityIndicator color={ui.textMuted} />
            ) : (
              <Text style={styles.ghostText}>Zurückziehen</Text>
            )}
          </Pressable>
        ) : sellerLoading ? (
          // Solange die Kassen-Freigabe unbekannt ist, steht hier KEIN
          // beschrifteter Knopf. Ein Etikett, das eine Zehntelsekunde später von
          // „Nachricht" auf „Kaufen" springt, ist auf einem Geldweg schlimmer
          // als eine kurze Wartefläche.
          <View style={styles.waiting}>
            <ActivityIndicator color={ui.textMuted} />
          </View>
        ) : canCheckout ? (
          <Pressable
            style={[styles.buy, busy && styles.off]}
            disabled={busy}
            onPress={() => void onBuy()}
            accessibilityRole="button"
            accessibilityLabel={`${listing.title} für ${formatEuro(
              listing.buy_now_cents,
            )} kaufen`}
          >
            {busy ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <Text style={styles.buyText}>
                Kaufen · {formatEuro(listing.buy_now_cents)}
              </Text>
            )}
          </Pressable>
        ) : (
          // Kontakt statt Kasse: Wer keine Kassen-Freigabe hat, kann über die
          // Plattform gar kein Geld bekommen — läuft es über das Konto des
          // Betreibers, ist das nach ZAG erlaubnispflichtig. Der Knopf ist
          // bewusst nicht gold: Gold ist in Berkat der Kaufweg.
          //
          // ⚠️ Nicht deaktivieren, wenn niemand angemeldet ist. Ein grauer
          // Knopf ohne Text ist eine Sackgasse — `onContact` schickt zur
          // Anmeldung, so wie es der Live-Raum und die Trinkgeld-Seite auch tun.
          <Pressable
            style={styles.contact}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={`${listing.title} — Verkäufer anschreiben`}
          >
            <MessageCircle size={17} color={ui.text} />
            <Text style={styles.contactText}>Nachricht schreiben</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },
  pressed: { opacity: 0.7 },

  hero: { width: '100%', aspectRatio: 1, backgroundColor: ui.sunken },
  heroEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroLock: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroLockText: { fontSize: 11, fontWeight: '700', color: ui.successInk },

  body: { padding: space.lg, gap: space.md },
  price: { fontSize: 28, fontWeight: '700', color: ui.text },
  title: { fontSize: 18, fontWeight: '600', color: ui.text, marginTop: -space.sm, lineHeight: 24 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: ui.text },
  when: { fontSize: 12, color: ui.textMuted, marginTop: -space.sm },

  legal: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    gap: 3,
  },
  legalText: { fontSize: 13, fontWeight: '700', color: ui.text },
  legalSub: { fontSize: 12, color: ui.textMuted, lineHeight: 17 },
  legalWarn: { fontSize: 12, color: ui.live, lineHeight: 17 },

  block: { gap: 5 },
  blockLabel: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
  description: { fontSize: 15, color: ui.text, lineHeight: 22 },
  imprint: { fontSize: 12, color: ui.textMuted, lineHeight: 18 },

  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
  },
  sellerName: { fontSize: 15, fontWeight: '700', color: ui.text },
  sellerStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerStatText: { fontSize: 12, color: ui.textMuted },

  shipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  shipText: { flex: 1, fontSize: 12, color: ui.textMuted, lineHeight: 17 },

  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    backgroundColor: ui.card,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  off: { opacity: 0.45 },
  buy: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  contactText: { fontSize: 15, fontWeight: '700', color: ui.text },
  ghost: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  goneBar: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goneText: { fontSize: 14, fontWeight: '700', color: ui.textMuted },
  waiting: { height: 52, alignItems: 'center', justifyContent: 'center' },

  notice: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    gap: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },
  noticeBtn: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBtnText: { fontSize: 13, fontWeight: '700', color: ui.text },

  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: space.md,
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
});
