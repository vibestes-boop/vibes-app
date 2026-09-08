import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Check, UsersRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_DISCOVERY, type DiscoveryPreferences } from '../lib/discovery';
import { useSession } from '../lib/session';
import { useCategoryOptions } from '../lib/useCategories';
import { useDiscoveryPreferences, useSaveDiscoveryPreferences } from '../lib/useDiscoveryPreferences';
import { categoryArt } from '../theme/categoryArt';
import { radius, space, ui } from '../theme/tokens';

export default function InterestsScreen() {
  const userId = useSession((state) => state.userId);
  const loading = useSession((state) => state.loading);
  // A new account gets its own editor and draft immediately.
  return <InterestEditor key={loading ? 'loading' : userId ?? 'guest'} userId={userId} sessionLoading={loading} />;
}

function InterestEditor({ userId, sessionLoading }: { userId: string | null; sessionLoading: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const preferences = useDiscoveryPreferences(userId, !sessionLoading);
  const categories = useCategoryOptions();
  const save = useSaveDiscoveryPreferences(userId);
  const [draft, setDraft] = useState<DiscoveryPreferences | null>(null);
  const mounted = useRef(true);
  useFocusEffect(useCallback(() => { mounted.current = true; return () => { mounted.current = false; }; }, []));
  const selection = draft ?? preferences.data;
  const ready = !sessionLoading && Boolean(selection);
  const change = (next: DiscoveryPreferences) => { save.reset(); setDraft(next); };
  const persist = async (next: DiscoveryPreferences) => {
    try {
      await save.mutateAsync({ owner: userId, preferences: next });
      const current = useSession.getState();
      if (mounted.current && !current.loading && current.userId === userId) router.back();
    } catch { /* The editor keeps the draft and displays the mutation error. */ }
  };

  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <View key={`header:${fontScale}`} style={s.header}>
      <Pressable onPress={() => { mounted.current = false; router.back(); }} accessibilityRole="button" accessibilityLabel="Zurück"
        style={({ pressed }) => [s.back, pressed && s.pressed]}><ArrowLeft size={23} color={ui.brand} /></Pressable>
      <Text style={s.title} accessibilityRole="header">Deine Interessen</Text>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      <View key={`content:${fontScale}`}>
        <Text style={s.intro}>Was möchtest du häufiger entdecken?</Text>
        <Text style={s.body}>Wähle deine Themen. Wir mischen passende Angebote mit neuen Funden. Du kannst deine Auswahl jederzeit ändern.</Text>
        {!ready && !preferences.isError ? <ActivityIndicator style={s.loading} color={ui.brand}
          accessibilityLabel="Deine Auswahl wird geladen" /> : null}
        {!sessionLoading && preferences.isError && !selection ? <View style={s.notice} accessibilityLiveRegion="polite">
          <Text style={s.body}>Deine Auswahl lässt sich gerade nicht öffnen. Versuche es noch einmal oder beginne mit einer neuen Auswahl.</Text>
          <Pressable onPress={() => void preferences.refetch()} disabled={preferences.isFetching} accessibilityRole="button" style={s.textButton}>
            <Text style={s.link}>{preferences.isFetching ? 'Wird geladen …' : 'Erneut laden'}</Text>
          </Pressable>
          <Pressable onPress={() => change(DEFAULT_DISCOVERY)} accessibilityRole="button" style={s.textButton}>
            <Text style={s.link}>Neue Auswahl beginnen</Text>
          </Pressable>
        </View> : null}
        {ready && selection ? <>
          {categories.isError ? <View style={s.notice} accessibilityLiveRegion="polite">
            <Text style={s.body}>Die Themen konnten nicht aktualisiert werden. Deine Auswahl bleibt erhalten.</Text>
            <Pressable onPress={() => void categories.refetch()} disabled={categories.isFetching} accessibilityRole="button" style={s.textButton}>
              <Text style={s.link}>{categories.isFetching ? 'Wird geladen …' : 'Themen erneut laden'}</Text>
            </Pressable>
          </View> : null}
          {categories.isLoading ? <ActivityIndicator style={s.loading} color={ui.brand} accessibilityLabel="Themen werden geladen" /> : null}
          <View style={s.grid}>
            {categories.groups.map((category) => {
              const checked = selection.categorySlugs.includes(category.slug);
              const art = categoryArt(category.slug);
              const Icon = art.icon;
              return <Pressable key={category.slug} disabled={save.isPending}
                accessibilityRole="checkbox" accessibilityState={{ checked, disabled: save.isPending }} accessibilityLabel={category.name}
                onPress={() => change({ ...selection, categorySlugs: checked
                  ? selection.categorySlugs.filter((slug) => slug !== category.slug)
                  : [...selection.categorySlugs, category.slug] })}
                style={({ pressed }) => [s.tile, fontScale > 1.5 && s.wideTile, checked && s.selectedTile, pressed && s.pressed]}>
                <View style={s.artRow}>
                  {art.photo ? <Image source={art.photo} style={s.art} contentFit="contain" enforceEarlyResizing accessible={false} />
                    : <View style={s.art}><Icon size={40} color={ui.brand} /></View>}
                  <View style={[s.check, checked && s.checked]}>{checked ? <Check size={15} strokeWidth={2.5} color={ui.card} /> : null}</View>
                </View>
                <Text style={s.categoryName}>{category.name}</Text>
              </Pressable>;
            })}
          </View>
          {userId ? <View style={s.followRow}>
            <UsersRound size={22} color={ui.brand} />
            <View style={s.followCopy}>
              <Text style={s.followTitle}>Gefolgte Verkäufer</Text>
              <Text style={s.body}>Ihre Angebote häufiger zeigen.</Text>
            </View>
            <Switch value={selection.useFollowing} disabled={save.isPending}
              onValueChange={(useFollowing) => change({ ...selection, useFollowing })}
              trackColor={{ false: ui.sunken, true: ui.brand }} thumbColor={ui.card}
              accessibilityLabel="Angebote gefolgter Verkäufer bevorzugen" />
          </View> : null}
          <View style={s.resetRow}>
            <Text style={s.summary}>{selection.categorySlugs.length === 1 ? '1 Thema gewählt'
              : selection.categorySlugs.length ? `${selection.categorySlugs.length} Themen gewählt` : 'Alle Themen offen'}</Text>
            <Pressable onPress={() => change({ ...DEFAULT_DISCOVERY, categorySlugs: [] })} disabled={save.isPending}
              accessibilityRole="button" style={s.textButton}><Text style={s.link}>Zurücksetzen</Text></Pressable>
          </View>
          <Text style={s.privacy}>{userId ? 'Für dieses Konto auf diesem Gerät gespeichert.' : 'Auf diesem Gerät gespeichert. Du brauchst dafür kein Konto.'}</Text>
        </> : null}
      </View>
    </ScrollView>
    <View key={`footer:${fontScale}`} style={[s.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      {save.isError ? <Text style={s.error} accessibilityLiveRegion="polite">Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es noch einmal.</Text> : null}
      <Pressable onPress={() => { if (selection) void persist(selection); }} disabled={!ready || save.isPending}
        accessibilityRole="button" accessibilityState={{ disabled: !ready || save.isPending, busy: save.isPending }}
        style={({ pressed }) => [s.primary, (!ready || save.isPending) && s.disabled, pressed && s.pressed]}>
        <Text style={s.primaryText}>{save.isPending ? 'Wird gespeichert …' : 'Auswahl speichern'}</Text>
      </Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '700', color: ui.text, flexShrink: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  intro: { fontSize: 23, lineHeight: 30, fontWeight: '700', color: ui.text, marginTop: space.sm, marginBottom: space.sm },
  body: { fontSize: 14, lineHeight: 21, color: ui.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  tile: { width: '48%', flexGrow: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: ui.card, borderWidth: 1.5, borderColor: ui.card, gap: space.sm },
  wideTile: { width: '100%' },
  selectedTile: { borderColor: ui.brand },
  artRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  art: { width: 80, height: 72, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: ui.sunken, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: ui.brand, borderColor: ui.brand },
  categoryName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  followRow: { marginTop: space.lg, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  followCopy: { flex: 1, minWidth: 0, gap: space.xs },
  followTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: ui.text },
  resetRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  summary: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
  textButton: { minHeight: 44, justifyContent: 'center', paddingVertical: space.sm },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand },
  privacy: { fontSize: 12, lineHeight: 18, color: ui.textMuted, marginTop: space.sm },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: ui.bg, gap: space.sm },
  primary: { backgroundColor: ui.brand, borderRadius: radius.pill, padding: space.md, minHeight: 52, justifyContent: 'center' },
  primaryText: { color: ui.card, fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
  error: { fontSize: 13, lineHeight: 19, color: ui.text },
  loading: { marginVertical: space.xl },
  notice: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
});
