/**
 * Anmeldedaten — Benutzername, Passwort, E-Mail
 * ============================================================================
 *
 * ⚠️ WARUM ES DAS GIBT (22.09.2026)
 * Zaur: *„in der einstellung sollte auch buttons sein email oder passwort zu
 * ändern oder nickname zu ändern."*
 *
 * Berkat hatte davon **keines**. Man konnte sich anmelden und abmelden, mehr
 * nicht. Aufgefallen ist es an einem echten Fall: Für den Zahlungstest
 * brauchten wir das Passwort eines zweiten Kontos, das im Simulator angemeldet
 * war — und es gab keinen Weg, ein neues zu setzen, obwohl die Sitzung offen
 * vor uns lag.
 *
 * ⚠️ DIE E-MAIL STEHT HIER NUR, SIE LÄSST SICH NICHT ÄNDERN. Das ist kein
 * Vergessen, sondern das Gegenteil: Eine Adressänderung verschickt Supabase als
 * **Bestätigungslink an die neue Adresse**, und Berkats Mailversand stellt
 * gerade nichts zu — die Resend-Domain ist unverifiziert, alles ausser der
 * Kontoadresse wird mit `550` abgewiesen (Übergabe, Abschnitt 86).
 *
 * Ein Knopf, der eine Mail verspricht, die nie ankommt, wäre schlimmer als gar
 * keiner: Der Nutzer hielte seine Adresse danach für geändert. **Erst den
 * Versand reparieren, dann den Knopf.** Solange steht hier ein Satz, der sagt,
 * woran es liegt.
 *
 * ⚠️ DER BENUTZERNAME GILT AUCH IN SERLO. `profiles` gehört beiden Apps
 * (Übergabe 62); es ist dasselbe Konto. Wer sich hier umbenennt, heisst dort
 * genauso — das gehört auf den Bildschirm, nicht in einen Kommentar.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { goBack } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { useAccountEmail } from '../lib/useAccountEmail';
import { FormInput } from '../components/FormInput';
import { PressFeedback } from '../components/PressFeedback';
import { radius, space, ui } from '../theme/tokens';

/** Mindestens drei Zeichen — dieselbe Grenze wie in Serlos Einstellungen. */
const NAME_MIN = 3;
/** Mindestens sechs — dieselbe Grenze wie beim Registrieren (`login.tsx`). */
const PASSWORD_MIN = 6;

export default function AccountLoginScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const { data: accountEmail } = useAccountEmail(myUserId);

  const [name, setName] = useState(profile?.username ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameNote, setNameNote] = useState<string | null>(null);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwNote, setPwNote] = useState<string | null>(null);

  const trimmed = name.trim();
  const nameChanged = trimmed !== (profile?.username ?? '');

  const saveName = async () => {
    setNameNote(null);
    if (trimmed.length < NAME_MIN) { setNameNote(`Mindestens ${NAME_MIN} Zeichen.`); return; }
    if (!myUserId) return;
    setSavingName(true);
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', myUserId);
    setSavingName(false);
    // ⚠️ `23505` ist der eindeutige Index auf `profiles.username`. Ohne diesen
    // Zweig läse der Nutzer eine Postgres-Meldung — und wüsste nicht, dass der
    // Name schlicht schon jemandem gehört.
    if (error) {
      setNameNote(error.code === '23505'
        ? 'Den Namen hat schon jemand. Probier einen anderen.'
        : 'Das hat gerade nicht geklappt — probier es gleich noch einmal.');
      return;
    }
    // Der Zustand im Kopf der App muss mitziehen, sonst steht oben im Konto
    // weiter der alte Name, bis jemand die App neu startet.
    if (profile) setProfile({ ...profile, username: trimmed });
    setNameNote('Gespeichert.');
  };

  const savePassword = async () => {
    setPwNote(null);
    if (pw1.length < PASSWORD_MIN) { setPwNote(`Mindestens ${PASSWORD_MIN} Zeichen.`); return; }
    if (pw1 !== pw2) { setPwNote('Die beiden Eingaben sind nicht gleich.'); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) {
      setPwNote(error.message.includes('same as the old')
        ? 'Das ist dein bisheriges Passwort.'
        : 'Das hat nicht geklappt. Melde dich ab und wieder an, dann noch einmal.');
      return;
    }
    setPw1(''); setPw2('');
    setPwNote('Passwort geändert. Du bleibst angemeldet.');
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <PressFeedback hitSlop={10} onPress={() => goBack('/settings')}
          accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={24} color={ui.text} />
        </PressFeedback>
        <Text accessibilityRole="header" style={s.headTitle}>Anmeldedaten</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

        {/* ── E-MAIL ──────────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>E-Mail</Text>
        <View style={s.card}>
          <Text selectable style={s.value}>{accountEmail ?? '—'}</Text>
          {/* Ehrlich statt hilfsbereit klingend: Der Grund steht da, damit
              niemand hier sucht und nichts findet. */}
          <Text style={s.hint}>
            Ändern geht gerade nicht. Dafür müsste ein Bestätigungslink an die
            neue Adresse gehen, und Berkats Mailversand stellt zurzeit nichts
            zu. Sobald das repariert ist, steht hier ein Knopf.
          </Text>
        </View>

        {/* ── BENUTZERNAME ────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>Benutzername</Text>
        <View style={s.card}>
          <FormInput value={name} onChangeText={setName} maxLength={30}
            autoCapitalize="none" autoCorrect={false}
            placeholder="Dein Name" accessibilityLabel="Benutzername"
            editable={!savingName} />
          <Text style={s.hint}>
            Unter diesem Namen sehen dich andere — auch in Serlo, denn es ist
            dasselbe Konto.
          </Text>
          {nameNote ? <Text style={s.note}>{nameNote}</Text> : null}
          <PressFeedback style={[s.button, (!nameChanged || savingName) && s.buttonOff]}
            disabled={!nameChanged || savingName}
            accessibilityState={{ disabled: !nameChanged || savingName, busy: savingName }}
            onPress={() => void saveName()} accessibilityRole="button">
            <Text style={s.buttonText}>{savingName ? 'Wird gespeichert …' : 'Namen speichern'}</Text>
          </PressFeedback>
        </View>

        {/* ── PASSWORT ────────────────────────────────────────────────────── */}
        <Text accessibilityRole="header" style={s.sectionLabel}>Passwort</Text>
        <View style={s.card}>
          {/* ⚠️ Zweimal eingeben, und KEIN „altes Passwort" darüber: Wer hier
              steht, ist bereits angemeldet — die Sitzung IST der Nachweis. Ein
              drittes Feld wäre eine Hürde ohne Gewinn. Der Grund, zweimal zu
              tippen, ist ein anderer: Ein Vertipper im einzigen Feld sperrt
              einen aus dem eigenen Konto aus. */}
          <FormInput value={pw1} onChangeText={setPw1} secureTextEntry
            autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
            placeholder={`Neues Passwort · mindestens ${PASSWORD_MIN} Zeichen`}
            accessibilityLabel="Neues Passwort" editable={!savingPw} />
          <View style={{ height: space.sm }} />
          <FormInput value={pw2} onChangeText={setPw2} secureTextEntry
            autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
            placeholder="Noch einmal" accessibilityLabel="Neues Passwort wiederholen"
            editable={!savingPw} />
          {pwNote ? <Text style={s.note}>{pwNote}</Text> : null}
          <PressFeedback style={[s.button, (!pw1 || !pw2 || savingPw) && s.buttonOff]}
            disabled={!pw1 || !pw2 || savingPw}
            accessibilityState={{ disabled: !pw1 || !pw2 || savingPw, busy: savingPw }}
            onPress={() => void savePassword()} accessibilityRole="button">
            <Text style={s.buttonText}>{savingPw ? 'Wird geändert …' : 'Passwort ändern'}</Text>
          </PressFeedback>
        </View>
      </ScrollView>
    </View>
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
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md },
  value: { fontSize: 15, color: ui.text },
  hint: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: space.sm },
  note: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: ui.brand, marginTop: space.sm },
  button: {
    minHeight: 48,
    marginTop: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  buttonOff: { backgroundColor: ui.sunken },
  buttonText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
