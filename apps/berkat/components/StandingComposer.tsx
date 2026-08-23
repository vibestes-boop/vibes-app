// Einen Artikel dauerhaft anbieten — oder einen bestehenden bearbeiten.
//
// Steht bewusst im Verkaufen-Reiter und NICHT im Studio einer laufenden
// Sendung: Der Sinn eines Dauerangebots ist ja gerade, dass es ohne Sendung
// existiert. Wer es nur während einer Show anlegen könnte, hätte den Zweck
// verfehlt.
//
// EIN Formular für beide Fälle. Bearbeiten (seit 17.08.2026) ist dasselbe
// Formular mit vorbefüllten Feldern und anderem Knopf — eine zweite Abschrift
// wäre exakt der Fehler, der bei den Angebots-Karten viermal auseinanderlief
// (HANDOFF 21). Der einzige Unterschied: Im Bearbeiten fehlt die
// Anbietertyp-Wahl, denn die gehört zum VERKÄUFER, nicht zum Artikel — und
// `set_berkat_seller_kind` zieht offene Angebote ohnehin nach.
//
// Kein Bild-Zwang. Ein Verkäufer, der abends schnell drei Sachen einstellt,
// bricht sonst nach dem ersten ab — und ein Angebot ohne Foto ist immer noch
// besser als keines.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, ShoppingBag, X } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { euroToCents } from '../lib/useStudio';
import { pickAndUpload } from '../lib/uploadImage';
import { CategoryPicker } from './CategoryPicker';
import { CONDITIONS, type SellerKind } from '../lib/useBerkatSeller';
import { tidySize } from '../lib/useListings';
import { SHIPPING_TIERS } from '../lib/useShippingTier';
import { formatSlot, type PlannedShow } from '../lib/useSchedule';

/** Serverseitig als CHECK gespiegelt — wer hier erhöht, erhöht dort mit. */
const MAX_IMAGES = 8;

/** Ebenfalls gespiegelt: `live_auctions_size_len` (20260819100000). */
const MAX_SIZE_LEN = 24;

export type ListingFormValues = {
  title: string;
  priceCents: number;
  womenOnly: boolean;
  category: string | null;
  /** Alle Bilder in Reihenfolge — das erste ist das Cover. */
  imageUrls: string[];
  /** Nimmt Preisvorschläge an. */
  acceptsOffers: boolean;
  description: string | null;
  condition: string | null;
  /** Freitext („42", „M", „One Size"). Freiwillig — siehe das Feld unten. */
  size: string | null;
  /**
   * Was der Artikel für den Weg braucht (1 Brief … 4 grosses Paket).
   *
   * ⚠️ NULL heisst „nicht angegeben" und wird serverseitig als 4 gerechnet.
   * Der Unterschied zu einer ausdrücklichen 4 ist Absicht: Eine Vorgabe, die
   * niemand getroffen hat, darf nicht wie eine Entscheidung aussehen
   * (Übergabe 3, „Eine Vorgabe anzeigen und nicht speichern").
   */
  shippingTier: number | null;
  postalCode: string | null;
  city: string | null;
  /**
   * ⚠️ „Reserve for Live" — nur beim ANLEGEN, und der einzige Wert hier, der
   * NICHT in `create_standing_listing` fließt.
   *
   * Whatnot löst die Frage „gehört das ins Regal oder in eine Sendung" mit einem
   * Schalter samt Termin-Auswahl in derselben Maske wie Preis und Bild (zehnte
   * Analyse). Berkat konnte das bis zum 21.08.2026 nur NACHTRÄGLICH: einstellen,
   * Verkaufen-Reiter öffnen, Termin antippen, „Aus dem Regal holen" — für etwas,
   * das der Verkäufer schon wusste, als er es eintippte.
   *
   * Der Aufrufer legt zuerst das Angebot an und ruft danach
   * `move_listing_to_show` mit dieser ID. Zwei Rufe statt einem, bewusst: Der
   * zweite darf fehlschlagen, ohne den ersten mitzureißen — dann liegt der
   * Artikel im Regal statt am Termin, und das ist der harmlose Ausgang.
   *
   * `null` = bleibt im Regal, rund um die Uhr kaufbar. Das ist die Vorgabe.
   */
  planId: string | null;
};

type Props = {
  busy: boolean;
  /** Nur geprüfte Frauen dürfen Frauen-Only setzen — der Server prüft es nochmal. */
  canWomenOnly: boolean;
  /**
   * `edit` befüllt aus `initial`, versteckt die Anbietertyp-Wahl und setzt das
   * Formular nach dem Abschicken NICHT zurück — beim Bearbeiten wäre ein leeres
   * Formular ein scheinbarer Datenverlust.
   */
  mode?: 'create' | 'edit';
  initial?: Partial<ListingFormValues>;
  /**
   * Die eigenen angekündigten Termine, für die „Für welchen Abend?"-Wahl.
   * Leer oder nicht gesetzt = die Wahl erscheint gar nicht: Wer keinen Termin
   * hat, soll hier nicht lesen, dass ihm einer fehlt.
   */
  plans?: PlannedShow[];
  /** Was der Verkäufer bisher erklärt hat. `null` = noch nie gefragt worden. Nur `create`. */
  sellerKind?: SellerKind | null;
  /** Wird nur gerufen, wenn sich der Typ tatsächlich ändert. Nur `create`. */
  onDeclareKind?: (kind: SellerKind) => void;
  onSubmit: (input: ListingFormValues) => void;
  submitLabel?: string;
};

export function StandingComposer({
  busy,
  canWomenOnly,
  mode = 'create',
  initial,
  sellerKind,
  onDeclareKind,
  onSubmit,
  submitLabel,
  plans,
}: Props) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(() =>
    initial?.priceCents != null ? String(initial.priceCents / 100).replace('.', ',') : '',
  );
  const [womenOnly, setWomenOnly] = useState(initial?.womenOnly ?? false);
  // Vorgabe AN beim Anlegen, weil Handeln in dieser Community die Norm ist —
  // aber sichtbar und mit einem Tipp abschaltbar. Beim Bearbeiten gilt, was am
  // Angebot steht; eine Vorgabe würde dort eine Entscheidung überschreiben.
  const [acceptsOffers, setAcceptsOffers] = useState(
    initial?.acceptsOffers ?? mode === 'create',
  );
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [openParent, setOpenParent] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [condition, setCondition] = useState<string | null>(initial?.condition ?? null);
  const [size, setSize] = useState(initial?.size ?? '');
  const [shippingTier, setShippingTier] = useState<number | null>(initial?.shippingTier ?? null);
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  // Die Beschreibung ist das einzige Feld, das echte Arbeit kostet. Sie liegt
  // deshalb hinter einem Tipp — der schnelle Weg bleibt schnell, und wer
  // erzählen will, kann. Beim Bearbeiten ist sie offen, wenn sie Text trägt.
  const [descOpen, setDescOpen] = useState(Boolean(initial?.description));

  /**
   * ⚠️ Vorgabe „privat", und zwar nicht aus Bequemlichkeit.
   * Unternehmereigenschaft nach § 14 BGB muss man annehmen, nicht unterstellen —
   * wer nichts erklärt, ist kein Unternehmer. Die Angabe ist trotzdem sichtbar
   * und mit einem Tipp änderbar, weil Art. 246d § 1 EGBGB verlangt, dass der
   * Käufer sie VOR seiner Vertragserklärung kennt.
   */
  const kind: SellerKind = sellerKind ?? 'private';

  const cents = price.trim() ? euroToCents(price) : null;
  // Der Server lehnt alles bis 1 € ab. Das vorher zu sagen ist freundlicher,
  // als es sich als Fehlermeldung abzuholen.
  const priceOk = cents !== null && cents > 100;
  /**
   * ⚠️ Bild und Kategorie sind Pflicht — aber NUR beim Anlegen.
   *
   * Beides folgt aus dem Vergleich mit Whatnot (zehnte Analyse), und beides
   * behebt ein Loch, das die Testware sichtbar gemacht hat:
   *
   *   ohne Bild      → im Regal-Raster eine leere Kachel; die Karte ist zu 70 %
   *                    Bildfläche, es gibt nichts anderes zu zeigen
   *   ohne Kategorie → über die Kategorie-Leiste UNAUFFINDBAR. Der Artikel
   *                    existiert, aber niemand stolpert über ihn
   *
   * Nicht im `edit`-Modus: Im Bestand liegen Angebote ohne beides (Testware und
   * alles vor heute). Sie zu blockieren hieße, dass ein Verkäufer seine eigene
   * Beschreibung nicht mehr korrigieren kann, bis er ein Foto nachreicht — eine
   * neue Regel darf bestehende Arbeit nicht einsperren.
   *
   * Und bewusst nur im Client: Das ist eine Qualitätsregel, keine
   * Sicherheitsgrenze. `create_standing_listing` nimmt weiterhin beides ohne
   * Wert an — eine ältere App-Fassung kann also weiter ohne Bild einstellen.
   * Das ist hinnehmbar; Geld und Rechte entscheidet der Server, Vollständigkeit
   * die Oberfläche.
   */
  const needsMedia = mode === 'create';
  const mediaOk = !needsMedia || imageUrls.length > 0;
  const categoryOk = !needsMedia || category !== null;

  // `uploading` blockiert mit: Wer währenddessen abschickt, verlöre das Bild,
  // weil die URL erst nach dem Hochladen in der Liste steht.
  const canSubmit =
    title.trim().length >= 2 && priceOk && mediaOk && categoryOk && !busy && !uploading;

  const addImage = () => {
    if (imageUrls.length >= MAX_IMAGES || uploading) return;
    setUploading(true);
    setUploadError(null);
    void pickAndUpload('article', 'portrait')
      .then((url) => {
        if (url) setImageUrls((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, url]));
      })
      .catch((error: unknown) =>
        setUploadError(error instanceof Error ? error.message : 'Das Bild kam nicht durch.'),
      )
      .finally(() => setUploading(false));
  };

  const removeImage = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const cover = imageUrls[0] ?? null;

  return (
    <View style={s.card}>
      {mode === 'create' ? (
        <>
          <View style={s.head}>
            <ShoppingBag size={18} color={ui.text} />
            <Text style={s.title}>Dauerhaft anbieten</Text>
          </View>
          <Text style={s.body}>
            Bleibt auf deinem Profil kaufbar, auch wenn du nicht sendest. Zwischen zwei Shows
            ist das alles, was jemand bei dir tun kann.
          </Text>
        </>
      ) : null}

      {/* Cover links, Titel rechts — dieselbe Anordnung wie bei „Artikel
          auflegen". Der Tipp auf das Cover fügt ein WEITERES Bild hinzu; das
          Entfernen liegt am ✕ der Kachelreihe darunter. So bleibt der schnelle
          Weg (ein Foto, fertig) ein einziger Tipp. */}
      <View style={s.titleRow}>
        <Pressable
          style={s.picker}
          disabled={uploading || imageUrls.length >= MAX_IMAGES}
          onPress={addImage}
          accessibilityRole="button"
          accessibilityLabel={cover ? 'Weiteres Foto hinzufügen' : 'Foto wählen'}
        >
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
          ) : null}
          {uploading ? (
            <ActivityIndicator color={ui.brand} />
          ) : cover ? null : (
            <ImagePlus size={20} color={ui.textMuted} />
          )}
        </Pressable>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Silberring, handgemacht"
          placeholderTextColor={ui.textMuted}
          style={[s.input, s.titleInput]}
          maxLength={140}
          multiline
        />
      </View>

      {/* Die Kachelreihe: alle Bilder, jedes mit ✕, hinten die Plus-Kachel.
          Umsortieren geht über Entfernen und neu Hinzufügen — ein Zieh-Sortierer
          bräuchte eine Gesten-Bibliothek und damit einen Build. Das erste Bild
          ist das Cover; die Karte und der Live-Raum zeigen nur dieses. */}
      {imageUrls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.imageRow}>
          {imageUrls.map((url, index) => (
            <View key={url} style={s.imageTile}>
              <Image
                source={{ uri: url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={100}
              />
              {index === 0 ? (
                <View style={s.coverTag}>
                  <Text style={s.coverTagText}>Titelbild</Text>
                </View>
              ) : null}
              <Pressable
                style={s.imageRemove}
                hitSlop={8}
                onPress={() => removeImage(url)}
                accessibilityRole="button"
                accessibilityLabel={`Foto ${index + 1} entfernen`}
              >
                <X size={12} color={ui.bg} />
              </Pressable>
            </View>
          ))}
          {imageUrls.length < MAX_IMAGES ? (
            <Pressable
              style={s.imageAdd}
              disabled={uploading}
              onPress={addImage}
              accessibilityRole="button"
              accessibilityLabel="Weiteres Foto hinzufügen"
            >
              {uploading ? (
                <ActivityIndicator color={ui.textMuted} />
              ) : (
                <ImagePlus size={18} color={ui.textMuted} />
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
      {imageUrls.length > 1 ? (
        <Text style={s.photoHint}>
          {imageUrls.length} von {MAX_IMAGES} Fotos — das erste ist das Titelbild.
        </Text>
      ) : null}

      {/* Kein Bild-ZWANG, aber ein deutlicher Hinweis. In der Show hältst du
          den Artikel in die Kamera — hier gibt es keine Kamera, das Foto IST
          die Auslage. */}
      {/* ⚠️ Der Satz sagt jetzt „braucht", nicht „sieht schlecht aus". Solange
          ein Foto freiwillig war, las sich der Hinweis als Geschmacksfrage —
          und die Testware ist voller Angebote ohne Bild. Beim Bearbeiten bleibt
          der alte, mildere Ton: Dort ist es weiterhin freiwillig, weil sonst
          bestehende Angebote nicht mehr korrigierbar wären. */}
      {imageUrls.length === 0 && !uploading ? (
        <Text style={s.photoHint}>
          {needsMedia
            ? 'Ein Foto brauchst du — ohne sehen Fremde nur ein graues Feld, und die Karte im Regal ist fast nur Bild.'
            : 'Ohne Foto sehen Fremde nur ein graues Feld — hier gibt es keine Kamera, die es zeigt.'}
        </Text>
      ) : null}
      {uploadError ? <Text style={s.warn}>{uploadError}</Text> : null}

      {/* Preis und Größe teilen sich eine Zeile — beides kurze Fakten, und der
          Verkaufen-Bereich ist am 19.08.2026 gerade erst gekürzt worden
          (HANDOFF 37). Eine eigene Zeile für zwei Zeichen wäre der Rückschritt.

          Die Größe ist FREITEXT und bleibt es: „42", „M", „74", „One Size",
          „38/40" sind alle richtig, und welche Skala gilt, weiß nur der
          Verkäufer. Eine gepflegte Liste müsste Konfektions-, Schuh- und
          Kindergrößen gleichzeitig abbilden und wäre am ersten Tag
          unvollständig — sie würde jemanden aussperren, dessen Größe sie nicht
          kennt. Normalisiert wird später für den FILTER, nicht bei der
          Eingabe. */}
      <View style={s.row}>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Preis in €"
          placeholderTextColor={ui.textMuted}
          keyboardType="decimal-pad"
          style={[s.input, { flex: 1, marginTop: 0 }]}
        />
        <TextInput
          value={size}
          onChangeText={setSize}
          placeholder="Größe"
          placeholderTextColor={ui.textMuted}
          style={[s.input, { width: canWomenOnly ? 84 : 108, marginTop: 0 }]}
          maxLength={MAX_SIZE_LEN}
        />
        {canWomenOnly ? (
          <View style={s.switchWrap}>
            <Text style={s.switchLabel}>Frauen-Only</Text>
            <Switch value={womenOnly} onValueChange={setWomenOnly} />
          </View>
        ) : null}
      </View>

      {price.trim() && !priceOk ? (
        <Text style={s.warn}>Über 1 € — darunter lohnt sich der Versand für niemanden.</Text>
      ) : null}

      {/* Ein Tipp, und rechtlich der Träger: Beim Privatverkauf ist der
          angegebene Zustand das, woran der Verkäufer sich messen lassen muss. */}
      <Text style={s.label}>Zustand</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {CONDITIONS.map((c) => {
          const on = condition === c.slug;
          return (
            <Pressable
              key={c.slug}
              onPress={() => setCondition(on ? null : c.slug)}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Der Maßstab zur gewählten Kachel. Ohne ihn heißt „Sehr gut" für jeden
          Verkäufer etwas anderes — und gemessen wird er beim Privatverkauf
          genau daran. */}
      {condition ? (
        <Text style={s.photoHint}>
          {CONDITIONS.find((c) => c.slug === condition)?.hint}
        </Text>
      ) : null}

      {/* Nur PLZ und Ort, keine Straße: Für „ist das in meiner Nähe" reicht das,
          und eine genaue Adresse in einem öffentlich lesbaren Angebot wäre
          nicht zu rechtfertigen. */}
      <View style={s.row}>
        <TextInput
          value={postalCode}
          onChangeText={(t) => setPostalCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="PLZ"
          placeholderTextColor={ui.textMuted}
          keyboardType="number-pad"
          style={[s.input, { width: 96, marginTop: 0 }]}
        />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Ort (freiwillig)"
          placeholderTextColor={ui.textMuted}
          style={[s.input, { flex: 1, marginTop: 0 }]}
          maxLength={80}
        />
      </View>

      {/* ── Für welchen Abend? — Whatnots „Reserve for Live" ────────────────
          Erscheint NUR beim Anlegen und NUR, wenn es überhaupt Termine gibt:
          Wer keinen hat, soll hier nicht lesen, dass ihm einer fehlt — das wäre
          eine Aufforderung an der falschen Stelle.

          Die Vorgabe ist das Regal. Ein Artikel, den niemand einem Abend
          zuordnet, soll rund um die Uhr kaufbar sein — das ist der Normalfall
          und der einzige, der ohne Zutun Geld bringt. */}
      {mode === 'create' && plans && plans.length > 0 ? (
        <View style={s.planBlock}>
          <Text style={s.label}>Wohin damit?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.planRow}>
            <Pressable
              onPress={() => setPlanId(null)}
              style={[s.planChip, planId === null && s.planChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: planId === null }}
            >
              <Text style={[s.planChipText, planId === null && s.planChipTextOn]}>
                Ins Regal
              </Text>
            </Pressable>
            {plans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => setPlanId(plan.id)}
                style={[s.planChip, planId === plan.id && s.planChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: planId === plan.id }}
                accessibilityLabel={`Für ${plan.title} am ${formatSlot(plan.scheduled_at)}`}
              >
                <Text
                  numberOfLines={1}
                  style={[s.planChipText, planId === plan.id && s.planChipTextOn]}
                >
                  {formatSlot(plan.scheduled_at)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={s.planHint}>
            {planId === null
              ? 'Rund um die Uhr kaufbar, auch wenn du nicht sendest.'
              : 'Wird an dem Abend versteigert — Start bei 1 €, dein Preis wird der Sofortkauf. Bis dahin ist er nicht im Regal.'}
          </Text>
        </View>
      ) : null}

      {/* Preisvorschläge. Steht bei den anderen Preis-Entscheidungen, nicht
          bei den Rechtsangaben — es ist eine Verkaufs-, keine Rechtsfrage. */}
      <View style={s.offerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.offerLabel}>Preisvorschläge zulassen</Text>
          <Text style={s.offerHint}>
            {acceptsOffers
              ? 'Käufer können dir einen Preis vorschlagen. Du kannst annehmen, kontern oder ablehnen.'
              : 'Es gilt nur dein Festpreis.'}
          </Text>
        </View>
        <Switch value={acceptsOffers} onValueChange={setAcceptsOffers} />
      </View>

      {descOpen ? (
        <TextInput
          value={description}
          onChangeText={setDescription}
          // „Größe" stand hier bis zum 19.08.2026 mit drin — und schickte damit
          // genau dorthin, wo sie nicht hingehört: in Fließtext, unfilterbar.
          // Seit es das Feld oben gibt, nennt der Platzhalter sie nicht mehr.
          placeholder="Was sollte man wissen? Marke, Mängel, Material …"
          placeholderTextColor={ui.textMuted}
          style={[s.input, { minHeight: 90 }]}
          maxLength={2000}
          multiline
        />
      ) : (
        <Pressable onPress={() => setDescOpen(true)} style={s.descOpener}>
          <Text style={s.descOpenerText}>+ Beschreibung hinzufügen</Text>
        </Pressable>
      )}

      {/* ⚠️ Seit dem 21.08.2026 beim ANLEGEN Pflicht.
          Der Satz darunter stand schon immer hier und war schon immer richtig:
          Die Kategorie ist der einzige Weg in den Kategorien-Reiter. Ohne sie
          liegt der Artikel nur auf dem eigenen Profil — und wer den Verkäufer
          noch nicht kennt, findet ihn dort nie. Etwas, das über
          Auffindbarkeit entscheidet, freiwillig zu lassen, war die falsche
          Abwägung; Whatnot hat es aus demselben Grund als Pflichtfeld
          (zehnte Analyse). */}
      <CategoryPicker
        value={category}
        onChange={setCategory}
        openParent={openParent}
        onOpenParent={setOpenParent}
      />
      {needsMedia && category === null ? (
        <Text style={s.photoHint}>
          Wähl eine Kategorie — sonst findet dich nur, wer dich schon kennt.
        </Text>
      ) : null}

      {/* Die Rechtsangabe steht direkt über dem Knopf, weil sie zur Handlung
          gehört — nicht in einer Einstellung, die niemand findet. Kein Riegel:
          Ein Rechtsfeld, das beim letzten Handgriff aussperrt, holt niemanden
          herüber. Wer nichts anfasst, verkauft privat.

          Nur beim ANLEGEN: Der Anbietertyp gehört zum Verkäufer, nicht zum
          Artikel — beim Bearbeiten wäre er hier eine zweite Wahrheit. */}
      {mode === 'create' ? (
        <>
          <Text style={s.label}>Du verkaufst als</Text>
          <View style={s.kindRow}>
            {([
              { value: 'private' as const, label: 'Privatperson' },
              { value: 'business' as const, label: 'Gewerblich' },
            ]).map((option) => {
              const on = kind === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (kind !== option.value) onDeclareKind?.(option.value);
                  }}
                  style={[s.kindTile, on && s.kindTileOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.kindLabel, on && s.kindLabelOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.kindNote}>
            {kind === 'business'
              ? 'Käufer haben Widerrufsrecht und Gewährleistung. Deine Anbieterangaben stehen an jedem Angebot — trag sie im Konto nach, falls noch nicht geschehen.'
              : 'Beim Privatverkauf gibt es kein Widerrufsrecht. Beschreibe den Zustand ehrlich — daran wirst du gemessen.'}
          </Text>
        </>
      ) : null}

      {/* ⚠️ VERSANDART — die Angabe, die bei 6-€-Ware über verkäuflich oder
          nicht entscheidet. Zwischen 1,19 € Brief und einer Paketpauschale
          liegt bei einem Kopftuch der halbe Kaufpreis.

          Beschriftet als GEGENSTAND, nicht als Gramm: „bis 500 g" muss ein
          Verkäufer erst schätzen — und schätzt falsch. Die Beträge stehen
          bewusst NICHT hier, sondern in `berkat_shipping_rates`; ein Preis an
          zwei Orten läuft auseinander, und eigene Sätze des Verkäufers
          schlagen die Vorgabe ohnehin. */}
      <Text style={s.label}>Wie verschickst du das?</Text>
      <View style={s.tierRow}>
        {SHIPPING_TIERS.map((t) => {
          const on = shippingTier === t.tier;
          return (
            <Pressable
              key={t.tier}
              style={[s.tier, on && s.tierOn]}
              onPress={() => setShippingTier(on ? null : t.tier)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.tierLabel, on && s.tierLabelOn]}>{t.label}</Text>
              <Text style={[s.tierEx, on && s.tierExOn]} numberOfLines={1}>
                {t.examples}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Der Satz erscheint nur, solange nichts gewählt ist — ein Dauerhinweis
          neben einer getroffenen Entscheidung ist Lärm (Design-Gesetz 3). */}
      {shippingTier === null ? (
        <Text style={s.tierHint}>
          Ohne Angabe rechnen wir mit dem großen Paket — das ist der teuerste Satz.
        </Text>
      ) : null}

      <Pressable
        style={[s.primary, !canSubmit && s.primaryOff]}
        disabled={!canSubmit}
        onPress={() => {
          onSubmit({
            title,
            priceCents: cents!,
            womenOnly,
            acceptsOffers,
            category,
            imageUrls,
            description: description.trim() || null,
            condition,
            shippingTier,
            size: tidySize(size),
            postalCode: postalCode.trim() || null,
            city: city.trim() || null,
            planId: mode === 'create' ? planId : null,
          });
          if (mode === 'create') {
            setTitle('');
            setPrice('');
            setWomenOnly(false);
            setAcceptsOffers(true);
            setCategory(null);
            setOpenParent(null);
            setImageUrls([]);
            setUploadError(null);
            setCondition(null);
            // ⚠️ Der Termin wird NICHT zurückgesetzt. Wer für Samstag zwanzig
            // Artikel einstellt, wählt ihn sonst zwanzigmal — und genau dieser
            // Fall ist der Grund für das Feld. Alles andere setzt sich zurück,
            // weil es je Artikel verschieden ist; der Abend ist es nicht.
            // Die Größe wird zurückgesetzt, PLZ und Ort nicht: Wer fünf Sachen
            // einstellt, wohnt bei allen fünf gleich — aber die Größe ist bei
            // jedem Stück eine andere. Sie stehen zu lassen hieße, sie beim
            // zweiten Artikel still falsch zu behaupten.
            setSize('');
            setDescription('');
            setDescOpen(false);
            // PLZ und Ort bleiben ABSICHTLICH stehen: Wer abends fünf Sachen
            // einstellt, wohnt bei allen fünf am selben Ort.
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={submitLabel ?? 'Artikel dauerhaft anbieten'}
      >
        <Text style={s.primaryText}>{submitLabel ?? 'Ins Regal legen'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tier: {
    flexGrow: 1, flexBasis: '47%',
    paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: ui.line,
    backgroundColor: ui.sunken,
  },
  // Markengrün gefüllt, nicht gold: Gold trägt in Berkat den Kaufweg, und eine
  // Versandart ist keine Kaufhandlung (`theme/tokens.ts`).
  tierOn: { backgroundColor: ui.brand, borderColor: ui.brand },
  tierLabel: { fontSize: 13, fontWeight: '600', color: ui.text },
  tierLabelOn: { color: ui.bg },
  tierEx: { fontSize: 11, color: ui.textMuted, marginTop: 1 },
  tierExOn: { color: ui.bg, opacity: 0.85 },
  tierHint: { fontSize: 11, color: ui.textMuted, marginBottom: space.xs },
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: ui.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  body: { fontSize: 13, color: ui.textMuted, marginTop: space.xs, lineHeight: 19 },

  input: {
    marginTop: space.md,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  titleRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  titleInput: { flex: 1, minHeight: 76 },
  picker: {
    width: 76,
    minHeight: 76,
    marginTop: space.md,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  imageRow: { marginTop: space.sm },
  imageTile: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    marginRight: space.sm,
  },
  coverTag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ui.overlay,
    paddingVertical: 1,
    alignItems: 'center',
  },
  // Auf `ui.overlay` gilt `overlayMuted` — Text auf fremdem Bild, siehe die
  // Bestandsliste an `ui.overlay` in theme/tokens.ts.
  coverTagText: { fontSize: 8, fontWeight: '700', color: ui.overlayMuted },
  imageRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAdd: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoHint: { fontSize: 11, color: ui.textMuted, marginTop: space.sm, lineHeight: 16 },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  offerLabel: { fontSize: 14, fontWeight: '600', color: ui.text },
  offerHint: { fontSize: 11, color: ui.textMuted, marginTop: 2, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  switchWrap: { alignItems: 'center', gap: 2 },
  switchLabel: { fontSize: 11, color: ui.textMuted },

  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

  label: { fontSize: 12, color: ui.textMuted, marginTop: space.md },

  // ── „Wohin damit?" ────────────────────────────────────────────────────────
  // Chips statt Auswahlfeld: Ein Verkäufer hat selten mehr als vier Termine,
  // und die Wahl soll auf einen Blick sichtbar sein statt hinter einem Tipp.
  // Dieselbe Bauart wie die Zustands-Chips darüber — zwei Auswahl-Sprachen in
  // einem Formular wären eine zu viel.
  planBlock: { marginTop: space.xs },
  planRow: { gap: space.sm, paddingRight: space.md, paddingVertical: space.sm },
  planChip: {
    maxWidth: 190,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  // Grün, nicht gold: Das hier ist eine Einordnung, kein Kaufweg.
  planChipOn: { borderColor: ui.brand, backgroundColor: ui.sunken },
  planChipText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
  planChipTextOn: { color: ui.brand },
  planHint: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },
  chipRow: { marginTop: space.sm },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginRight: space.sm,
  },
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.bg },

  descOpener: { marginTop: space.md, paddingVertical: space.sm },
  descOpenerText: { fontSize: 14, fontWeight: '600', color: ui.brand },

  kindRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  kindTile: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.line,
    paddingVertical: space.sm + 2,
    alignItems: 'center',
  },
  kindTileOn: { borderColor: ui.brand, backgroundColor: ui.sunken },
  kindLabel: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  kindLabelOn: { color: ui.text },
  kindNote: { fontSize: 11, color: ui.textMuted, marginTop: space.sm, lineHeight: 16 },

  primary: {
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
