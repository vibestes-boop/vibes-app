// Anmelden und Registrieren teilen das bestehende Konto und denselben Einstieg.
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, Eye, EyeOff, Mail, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { goBack } from '../lib/nav';
import { BerkatMark } from '../components/BerkatMark';
import { PressFeedback } from '../components/PressFeedback';
import { ui, radius, space } from '../theme/tokens';

function readableAuthError(message: string): string {
  message = message.toLowerCase();
  if (message.includes('invalid login credentials'))
    return 'E-Mail oder Passwort stimmt nicht.';
  if (message.includes('email not confirmed'))
    return 'Die E-Mail ist noch nicht bestätigt. Schau in dein Postfach.';
  if (message.includes('already registered') || message.includes('already been registered'))
    return 'Diese E-Mail hat schon ein Konto. Melde dich einfach an.';
  if (message.includes('password should be'))
    return 'Das Passwort ist zu kurz — mindestens sechs Zeichen.';
  if (message.includes('valid email') || message.includes('invalid format'))
    return 'Die E-Mail sieht nicht richtig aus.';
  if (message.includes('network') || message.includes('fetch'))
    return 'Keine Verbindung. Prüf kurz dein Netz.';
  return 'Hat nicht geklappt. Versuch es noch einmal.';
}

/** Buchstaben, Ziffern, Punkt, Strich, Unterstrich — 3 bis 24 Zeichen. */
const NAME_PATTERN = /^[\p{L}0-9._-]{3,24}$/u;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // iOS can keep an already mounted field at its previous Dynamic Type size.
  // Scale explicitly so the input keeps its focus, selection and draft.
  const inputScale = { fontSize: 16 * fontScale, lineHeight: 22 * fontScale };
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingMail, setAwaitingMail] = useState<string | null>(null);
  const busyLock = useRef(false);
  const active = useRef(true);
  const visit = useRef(0);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  useFocusEffect(useCallback(() => {
    active.current = true;
    visit.current++;
    return () => { active.current = false; visit.current++; };
  }, []));
  const close = () => { active.current = false; visit.current++; goBack(); };
  const registering = mode === 'register';
  const switchMode = () => {
    if (busyLock.current) return;
    setMode((m) => m === 'login' ? 'register' : 'login');
    setShowPassword(false);
    setError(null);
  };
  const submit = async () => {
    // Keyboard submit and button press may arrive before React paints disabled.
    if (busyLock.current || !active.current) return;
    const address = email.trim();
    const name = username.trim();
    if (!address || !password) { setError('Bitte fülle E-Mail und Passwort aus.'); return; }
    if (registering && !NAME_PATTERN.test(name)) {
      setError('Der Name braucht 3 bis 24 Zeichen: Buchstaben, Ziffern, Punkt, Strich oder Unterstrich.'); return;
    }
    if (registering && password.length < 6) { setError('Das Passwort braucht mindestens sechs Zeichen.'); return; }
    const startedVisit = visit.current;
    const current = () => active.current && visit.current === startedVisit;
    busyLock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (registering) {
        const { data: taken, error: lookupError } = await supabase.from('profiles')
          .select('username').eq('username', name).maybeSingle();
        if (!current()) return;
        if (lookupError) throw lookupError;
        if (taken) { setError(`„${name}“ ist schon vergeben. Nimm einen anderen.`); return; }
        const { data, error: authError } = await supabase.auth.signUp({ email: address, password, options: { data: { username: name } } });
        if (!current()) return;
        if (authError) throw authError;
        if (data.session) close();
        else { setAwaitingMail(address); setPassword(''); setShowPassword(false); }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
        if (!current()) return;
        if (authError) throw authError;
        close();
      }
    } catch (reason) {
      if (current()) setError(readableAuthError(reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : ''));
    } finally {
      busyLock.current = false;
      if (active.current) setBusy(false);
    }
  };

  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View key={`top:${fontScale}`} style={[s.top, { paddingTop: insets.top + space.xs }]}>
      <View style={s.wordmark}><BerkatMark size={22} color={ui.brand} /><Text allowFontScaling={false} style={s.brand}>berkat</Text></View>
      <PressFeedback onPress={close} style={s.iconButton} accessibilityRole="button" accessibilityLabel="Schließen">
        <X size={22} color={ui.brand} />
      </PressFeedback>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space.xl }]}>
      <View key={`intro:${fontScale}`} style={s.intro}>
        <View style={s.emblem}>{awaitingMail ? <Mail size={28} color={ui.brand} /> : <BerkatMark size={34} color={ui.brand} />}</View>
        <Text style={s.title} accessibilityRole="header">{awaitingMail ? 'Schau in dein Postfach' : registering ? 'Dein Platz bei Berkat' : 'Schön, dass du da bist'}</Text>
        <Text style={s.subtitle}>{awaitingMail ? `Bestätige deine E-Mail über den Link, den wir an ${awaitingMail} geschickt haben. Danach kannst du dich anmelden.`
          : registering ? 'Speichere deine Funde, folge Verkäufern und merke dir Shows vor.' : 'Melde dich an und finde deine gemerkten Angebote, Verkäufer und Shows wieder.'}</Text>
      </View>
      {awaitingMail ? <PressFeedback key={`confirmed:${fontScale}`} style={s.primary} accessibilityRole="button" onPress={() => {
        setAwaitingMail(null); setMode('login'); setError(null);
      }}><Check size={19} color={ui.card} /><Text style={s.primaryText}>Zur Anmeldung</Text></PressFeedback> : <>
        <View key={`note:${fontScale}`} style={s.accountNote}><Text style={s.noteText}>Dein Serlo-Konto gilt auch hier. Nutze dieselbe E-Mail und dasselbe Passwort.</Text></View>
        {error ? <View key={`error:${fontScale}`} style={s.errorBox} accessibilityLiveRegion="polite"><Text style={s.errorText}>{error}</Text></View> : null}
        <View style={s.form}>
          {registering ? <View style={s.field}>
            <Text key={`name:${fontScale}`} style={s.label}>Profilname</Text>
            <TextInput value={username} onChangeText={setUsername} editable={!busy}
              accessibilityLabel="Profilname" placeholder="So heißt du bei Berkat" placeholderTextColor={ui.textMuted}
              autoCapitalize="none" autoCorrect={false} autoComplete="username-new" maxLength={24}
              allowFontScaling={false} style={[s.input, inputScale]} returnKeyType="next" onSubmitEditing={() => emailInput.current?.focus()} />
          </View> : null}
          <View style={s.field}>
            <Text key={`email:${fontScale}`} style={s.label}>E-Mail</Text>
            <TextInput ref={emailInput} value={email} onChangeText={setEmail} editable={!busy}
              accessibilityLabel="E-Mail" placeholder="name@beispiel.de" placeholderTextColor={ui.textMuted}
              autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
              allowFontScaling={false} style={[s.input, inputScale]} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} />
          </View>
          <View style={s.field}>
            <Text key={`password:${fontScale}`} style={s.label}>Passwort{registering ? ' · mindestens 6 Zeichen' : ''}</Text>
            <View style={s.passwordRow}>
              <TextInput ref={passwordInput} value={password} onChangeText={setPassword} editable={!busy}
                accessibilityLabel="Passwort" placeholder="Dein Passwort" placeholderTextColor={ui.textMuted}
                autoCapitalize="none" autoCorrect={false} autoComplete={registering ? 'new-password' : 'current-password'}
                secureTextEntry={!showPassword} allowFontScaling={false} style={[s.input, s.passwordInput, inputScale]} onSubmitEditing={() => void submit()} returnKeyType="go" />
              <Pressable onPress={() => setShowPassword((shown) => !shown)} disabled={busy} style={s.reveal}
                accessibilityRole="button" accessibilityLabel={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'} accessibilityState={{ disabled: busy, selected: showPassword }}>
                {showPassword ? <EyeOff size={20} color={ui.brand} /> : <Eye size={20} color={ui.brand} />}
              </Pressable>
            </View>
          </View>
        </View>
        <PressFeedback key={`submit:${fontScale}`} onPress={() => void submit()} disabled={busy}
          accessibilityRole="button" accessibilityLabel={registering ? 'Konto anlegen' : 'Anmelden'} accessibilityState={{ disabled: busy, busy }}
          style={[s.primary, busy && s.disabled]}>
          {busy ? <ActivityIndicator color={ui.card} /> : null}
          <Text style={s.primaryText}>{busy ? 'Einen Moment …' : registering ? 'Konto anlegen' : 'Anmelden'}</Text>
          {!busy ? <ArrowRight size={19} color={ui.card} /> : null}
        </PressFeedback>
        <PressFeedback key={`mode:${fontScale}`} onPress={switchMode} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={s.secondary}>
          <Text style={s.secondaryText}>{registering ? 'Schon dabei? Anmelden' : 'Neu bei Berkat? Konto anlegen'}</Text>
        </PressFeedback>
      </>}
      <PressFeedback key={`browse:${fontScale}`} onPress={close} accessibilityRole="button" style={s.browse}>
        <Text style={s.browseText}>Ohne Anmeldung weiterschauen</Text>
      </PressFeedback>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  brand: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: ui.brand },
  iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg },
  intro: { gap: space.md },
  emblem: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: ui.text },
  subtitle: { fontSize: 15, lineHeight: 22, color: ui.textMuted },
  accountNote: { borderLeftWidth: 2, borderLeftColor: ui.lineStrong, paddingLeft: space.md },
  noteText: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  form: { gap: space.lg },
  field: { gap: space.sm },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.text },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: ui.lineStrong,
    backgroundColor: ui.card, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 16, color: ui.text },
  passwordRow: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: ui.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: ui.lineStrong },
  passwordInput: { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent' },
  reveal: { width: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 52, padding: space.md, backgroundColor: ui.brand, borderRadius: radius.pill,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: ui.card, textAlign: 'center', flexShrink: 1 },
  secondary: { minHeight: 48, padding: space.md, backgroundColor: ui.card, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand, textAlign: 'center' },
  browse: { minHeight: 48, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  browseText: { fontSize: 13, lineHeight: 19, color: ui.textMuted, textAlign: 'center' },
  disabled: { opacity: 0.65 },
  errorBox: { backgroundColor: ui.card, borderRadius: radius.md, borderWidth: 1, borderColor: ui.live, padding: space.md },
  errorText: { fontSize: 14, lineHeight: 21, color: ui.text },
});
