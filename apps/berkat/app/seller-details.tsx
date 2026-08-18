// Anbieterangaben — das Impressum eines gewerblichen Verkäufers.
//
// WARUM ES DIESEN BILDSCHIRM GEBEN MUSS
// Die Spalten stehen seit `20260816200000`, die RPC `set_berkat_seller_kind`
// nimmt jedes Feld entgegen, und die Artikelseite prüft seit dem 17.08.2026, ob
// sie vollständig sind. Nur eintragen konnte man sie nie — es gab kein
// Formular. Ein gewerblicher Verkäufer sah damit an jedem seiner Angebote einen
// roten Mangel, den er selbst nicht beheben konnte (Übergabe, Abschnitt 33,
// „die Sackgasse"). Wir warnten vor unserer eigenen Lücke.
//
// § 5 DDG verlangt Name, Anschrift und eine Kontaktmöglichkeit „leicht
// erkennbar, unmittelbar erreichbar und ständig verfügbar". Seit dem 18.08.2026
// stehen sie auf dem Verkäufer-Profil, nicht mehr an jeder Artikelseite.
//
// WER DAS HIER SIEHT
// Jeder — auch Privatverkäufer. Der Anbietertyp ist die erste Entscheidung auf
// dieser Seite, und wer von privat auf gewerblich wechselt, braucht die Felder
// direkt darunter. Sie hinter dem Typ zu verstecken hieße, jemanden erst
// umschalten zu lassen und ihm dann zu sagen, dass jetzt noch etwas fehlt.

import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import {
  useBerkatSeller,
  useDeclareSellerKind,
  type SellerKind,
} from '../lib/useBerkatSeller';
import { radius, space, ui } from '../theme/tokens';

/**
 * Die drei Länder, die `berkat_sellers.country` per CHECK zulässt.
 *
 * ⚠️ Muss mit der Migration übereinstimmen: `CHECK (country IN ('DE','AT','CH'))`.
 * Am 19.08.2026 scheiterte das Seed-Skript genau hier, weil es „Deutschland"
 * schrieb — der Wert ist ein Code, der Name gehört nur in die Anzeige.
 */
const COUNTRIES: { code: string; label: string }[] = [
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'CH', label: 'Schweiz' },
];

type Field = {
  key: 'legalName' | 'street' | 'postalCode' | 'city' | 'contactEmail' | 'vatId';
  label: string;
  placeholder: string;
  /** Ohne diese vier ist das Impressum unvollständig (§ 5 DDG). */
  required?: boolean;
  keyboard?: 'default' | 'email-address' | 'number-pad';
};

const FIELDS: Field[] = [
  { key: 'legalName', label: 'Name oder Firma', placeholder: 'Mustermann Handel e. K.', required: true },
  { key: 'street', label: 'Straße und Hausnummer', placeholder: 'Musterstraße 12', required: true },
  { key: 'postalCode', label: 'PLZ', placeholder: '60313', required: true, keyboard: 'number-pad' },
  { key: 'city', label: 'Ort', placeholder: 'Frankfurt am Main', required: true },
  {
    key: 'contactEmail',
    label: 'E-Mail für Kunden',
    placeholder: 'kontakt@beispiel.de',
    required: true,
    keyboard: 'email-address',
  },
  { key: 'vatId', label: 'USt-IdNr. (wenn vorhanden)', placeholder: 'DE123456789' },
];

export default function SellerDetailsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const { data: seller, isLoading } = useBerkatSeller(userId);
  const declare = useDeclareSellerKind(userId ?? null);

  // Vorgabe „privat": Wer nichts erklärt hat, ist kein Unternehmer — die
  // Unternehmereigenschaft muss man annehmen, nicht unterstellen (§ 14 BGB).
  const [kind, setKind] = useState<SellerKind | null>(null);
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Erst befüllen, wenn die Zeile da ist — sonst überschreibt ein leerer
  // Anfangswert den geladenen Stand, und der Verkäufer speichert seine eigenen
  // Angaben weg. Deshalb `null` als „noch nicht angefasst" statt leerer Felder.
  const effKind: SellerKind = kind ?? seller?.kind ?? 'private';
  const eff = (key: string): string =>
    values?.[key] ?? (seller as unknown as Record<string, string | null>)?.[
      { legalName: 'legal_name', street: 'street', postalCode: 'postal_code',
        city: 'city', contactEmail: 'contact_email', vatId: 'vat_id' }[key] as string
    ] ?? '';
  const effCountry = country ?? seller?.country ?? 'DE';

  const isBusiness = effKind === 'business';
  const missing = isBusiness
    ? FIELDS.filter((f) => f.required && !eff(f.key).trim()).map((f) => f.label)
    : [];

  /**
   * ⚠️ Die E-Mail wird auf ihre FORM geprüft, nicht nur auf Anwesenheit.
   *
   * § 5 DDG verlangt „Angaben, die eine schnelle elektronische Kontaktaufnahme
   * ermöglichen" — eine Adresse ohne `@` ermöglicht gar nichts. Am 19.08.2026
   * am Gerät aufgefallen: Der Speichern-Knopf stand offen, obwohl im Feld
   * `test"berkat.invalid` stand (die Simulator-Tastatur hatte das `@` als `"`
   * getippt). Genau so kommt es auch von einem echten Daumen.
   *
   * Bewusst eine MINIMALE Prüfung: etwas, ein `@`, etwas mit einem Punkt.
   * Strengere E-Mail-Muster weisen regelmäßig gültige Adressen ab, und eine
   * Pflichtangabe, die an der eigenen Prüfung scheitert, sperrt den Verkäufer
   * aus — derselbe Grund, aus dem die Vollständigkeit in der Oberfläche und
   * nicht als CHECK in der Datenbank sitzt.
   */
  const email = eff('contactEmail').trim();
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const canSave =
    !declare.isPending && (!isBusiness || (missing.length === 0 && emailOk));

  const set = (key: string, v: string) =>
    setValues((prev) => ({ ...(prev ?? {}), [key]: v }));

  const onSave = () => {
    setNotice(null);
    void declare
      .mutateAsync({
        kind: effKind,
        // Beim Privatverkauf gehen die Felder als `null` mit: Wer zurück auf
        // privat wechselt, will seine Anschrift nicht weiter öffentlich haben.
        legalName: isBusiness ? eff('legalName') : null,
        street: isBusiness ? eff('street') : null,
        postalCode: isBusiness ? eff('postalCode') : null,
        city: isBusiness ? eff('city') : null,
        country: isBusiness ? effCountry : null,
        contactEmail: isBusiness ? eff('contactEmail') : null,
        vatId: isBusiness ? eff('vatId') : null,
      })
      .then(() => {
        setNotice(
          isBusiness
            ? 'Gespeichert — deine Angaben stehen jetzt auf deinem Profil. ✅'
            : 'Gespeichert. Du verkaufst als Privatperson.',
        );
      })
      .catch((e: unknown) =>
        setNotice(
          e instanceof Error && e.message.includes('unknown_seller_kind')
            ? 'Das hat nicht geklappt — bitte wähle Privat oder Gewerblich.'
            : 'Das hat nicht geklappt. Versuch es gleich noch einmal.',
        ),
      );
  };

  if (isLoading) {
    return (
      <View style={[s.screen, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={ui.textMuted} />
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={s.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={s.headerTitle}>Anbieterangaben</Text>
        <View style={s.back} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.intro}>
            Wer gewerblich verkauft, muss seine Anschrift angeben — das steht dann auf deinem
            Profil, nicht an jedem Angebot.
          </Text>

          <Text style={s.label}>Du verkaufst als</Text>
          <View style={s.kindRow}>
            {(
              [
                { key: 'private', label: 'Privatperson' },
                { key: 'business', label: 'Gewerblich' },
              ] as { key: SellerKind; label: string }[]
            ).map((option) => {
              const on = option.key === effKind;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setKind(option.key)}
                  style={[s.kindTile, on && s.kindTileOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.kindText, on && s.kindTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>
            {isBusiness
              ? 'Käufer haben 14 Tage Widerrufsrecht und die gesetzliche Gewährleistung.'
              : 'Beim Privatverkauf gibt es kein Widerrufsrecht. Beschreibe den Zustand ehrlich — daran wirst du gemessen.'}
          </Text>

          {/* Die Felder nur im gewerblichen Fall. Bei „privat" wären sie eine
              Aufforderung, Daten herzugeben, die niemand braucht — und die
              Anschrift einer Privatperson gehört nicht auf ein öffentliches
              Profil. */}
          {isBusiness ? (
            <>
              {FIELDS.map((f) => (
                <View key={f.key}>
                  <Text style={s.label}>
                    {f.label}
                    {f.required ? <Text style={s.req}> *</Text> : null}
                  </Text>
                  <TextInput
                    value={eff(f.key)}
                    onChangeText={(v) => set(f.key, v)}
                    placeholder={f.placeholder}
                    placeholderTextColor={ui.textMuted}
                    style={s.input}
                    keyboardType={f.keyboard ?? 'default'}
                    autoCapitalize={f.key === 'contactEmail' ? 'none' : 'sentences'}
                    autoCorrect={false}
                  />
                </View>
              ))}

              <Text style={s.label}>Land</Text>
              <View style={s.countryRow}>
                {COUNTRIES.map((c) => {
                  const on = c.code === effCountry;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => setCountry(c.code)}
                      style={[s.chip, on && s.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {missing.length > 0 ? (
                <Text style={s.missing}>
                  Es fehlt noch: {missing.join(', ')}.
                </Text>
              ) : !emailOk ? (
                <Text style={s.missing}>
                  Die E-Mail sieht nicht vollständig aus — Kunden müssen dich darüber erreichen
                  können.
                </Text>
              ) : null}
            </>
          ) : null}

          {notice ? (
            <Pressable onPress={() => setNotice(null)}>
              <Text style={s.notice}>{notice}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[s.save, !canSave && s.saveOff]}
            disabled={!canSave}
            onPress={onSave}
            accessibilityRole="button"
            accessibilityLabel="Angaben speichern"
          >
            {declare.isPending ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <Text style={s.saveText}>Speichern</Text>
            )}
          </Pressable>

          {/* Der Satz gehört hierher, nicht in eine Fehlermeldung: Wer den Typ
              ändert, ändert damit auch, was an seinen laufenden Angeboten
              steht — das soll er vorher wissen, nicht hinterher merken. */}
          <Text style={s.footnote}>
            Änderungen gelten sofort für alle Angebote, die noch offen sind. Bereits verkaufte
            behalten den Stand vom Kauf.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  intro: { fontSize: 14, color: ui.textMuted, lineHeight: 20 },

  label: { fontSize: 12, color: ui.textMuted, marginTop: space.lg, marginBottom: space.xs },
  req: { color: ui.live },
  input: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },

  kindRow: { flexDirection: 'row', gap: space.sm },
  kindTile: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  kindTileOn: { backgroundColor: ui.brand },
  kindText: { fontSize: 14, fontWeight: '700', color: ui.text },
  kindTextOn: { color: ui.bg },
  hint: { fontSize: 12, color: ui.textMuted, marginTop: space.sm, lineHeight: 17 },

  countryRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: space.md,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.bg },

  missing: { fontSize: 12, color: ui.live, marginTop: space.md, lineHeight: 17 },
  notice: { fontSize: 13, color: ui.text, marginTop: space.lg, lineHeight: 19 },

  save: {
    marginTop: space.xl,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOff: { opacity: 0.45 },
  saveText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },

  footnote: { fontSize: 11, color: ui.textMuted, marginTop: space.md, lineHeight: 16 },
});
