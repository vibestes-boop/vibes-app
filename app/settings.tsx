import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Switch,
} from "react-native";
import { Image } from 'expo-image';
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
} from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Check,
  User,
  FileText,
  AtSign,
  LogOut,
  Trash2,
  Lock,
  Mail,
  Shield,
  ExternalLink,
  ChevronRight,
  Bell,
  Link,
  Mic,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { uploadAvatar } from "@/lib/uploadMedia";
import { useQueryClient } from "@tanstack/react-query";
import Constants from 'expo-constants';
import { useNotificationPrefs } from '@/lib/useNotificationPrefs';
import { VoiceSetupSheet } from '@/components/profile/VoiceSetupSheet';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [isPrivate, setIsPrivate] = useState((profile as any)?.is_private ?? false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [showVoiceSetup, setShowVoiceSetup] = useState(false);
  const queryClient = useQueryClient();
  const { prefs: notifPrefs, setPrefs: setNotifPrefs } = useNotificationPrefs();

  const hasVoice = !!(profile as any)?.voice_sample_url;

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const currentAvatar = avatarUri ?? profile?.avatar_url ?? null;

  const pickAvatar = () => {
    Alert.alert(
      'Profilbild ändern',
      'Wie möchtest du dein Foto auswählen?',
      [
        {
          text: 'Kamera',
          onPress: async () => {
            const { status } = await requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Kamerazugriff in den Einstellungen.');
              return;
            }
            const result = await launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setAvatarUri(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Galerie',
          onPress: async () => {
            const { status } = await requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
              return;
            }
            const result = await launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setAvatarUri(result.assets[0].uri);
            }
          },
        },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!profile) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Alert.alert("Fehler", "Benutzername darf nicht leer sein.");
      return;
    }
    if (trimmedUsername.length < 3) {
      Alert.alert(
        "Fehler",
        "Benutzername muss mindestens 3 Zeichen lang sein.",
      );
      return;
    }

    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Avatar hochladen falls neu ausgewählt
      if (avatarUri) {
        const { url } = await uploadAvatar(profile.id, avatarUri);
        avatarUrl = url;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({
          username: trimmedUsername,
          bio: bio.trim() || null,
          website: website.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          Alert.alert("Fehler", "Dieser Benutzername ist bereits vergeben.");
        } else {
          throw error;
        }
        return;
      }

      // Lokalen Store aktualisieren
      if (data) setProfile(data as typeof profile);

      // Caches invalidieren damit Feed sofort den neuen Username zeigt
      queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['guild-feed'] });
      Alert.alert("Gespeichert ✓", "Dein Profil wurde aktualisiert.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Fehler", err?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.prompt(
      "Passwort ändern",
      "Gib dein neues Passwort ein (mindestens 8 Zeichen):",
      async (newPassword) => {
        if (!newPassword) return;
        if (newPassword.length < 8) {
          Alert.alert("Zu kurz", "Das Passwort muss mindestens 8 Zeichen haben.");
          return;
        }
        setChangingPw(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setChangingPw(false);
        if (error) {
          Alert.alert("Fehler", error.message);
        } else {
          Alert.alert("Passwort geändert ✓", "Dein Passwort wurde erfolgreich aktualisiert.");
        }
      },
      "secure-text"
    );
  };

  const handleChangeEmail = () => {
    Alert.prompt(
      "E-Mail ändern",
      "Gib deine neue E-Mail-Adresse ein. Du erhältst einen Bestätigungslink an beide Adressen:",
      async (newEmail) => {
        if (!newEmail || !newEmail.includes("@")) {
          Alert.alert("Ungültig", "Bitte gib eine gültige E-Mail-Adresse ein.");
          return;
        }
        setChangingEmail(true);
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        setChangingEmail(false);
        if (error) {
          Alert.alert("Fehler", error.message);
        } else {
          Alert.alert(
            "Link gesendet ✓",
            "Bitte prüfe dein Postfach und klicke auf den Bestätigungslink, um die Änderung abzuschließen."
          );
        }
      },
      "plain-text",
      undefined,
      "email-address"
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Abmelden",
      "Möchtest du dich wirklich abmelden?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            queryClient.clear();
            await useAuthStore.getState().signOut();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Account löschen",
      "⚠️ Dein Account und ALLE Daten (Posts, Stories, Nachrichten) werden dauerhaft und unwiderruflich gelöscht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Jetzt löschen",
          style: "destructive",
          onPress: async () => {
            // Zweite Bestätigung — Apple Review erfordert bewusste Handlung
            Alert.alert(
              "Wirklich sicher?",
              "Diese Aktion kann NICHT rückgängig gemacht werden.",
              [
                { text: "Nein, behalten", style: "cancel" },
                {
                  text: "Ja, Account löschen",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      // Robuste Löschung via Edge Function (Service Role)
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;
                      if (token) {
                        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
                        await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                        });
                      }
                    } catch { /* Edge Function Fehler ignorieren — signOut trotzdem */ }
                    queryClient.clear();
                    await useAuthStore.getState().signOut();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const avatarInitial = profile?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <ArrowLeft size={20} stroke="#9CA3AF" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <Animated.View style={saveStyle}>
          <Pressable
            onPressIn={() => { saveScale.value = withTiming(0.88, { duration: 80 }); }}
            onPressOut={() => { saveScale.value = withTiming(1, { duration: 80 }); }}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
            accessibilityRole="button"
            accessibilityLabel="Profil speichern"
            accessibilityState={{ disabled: saving }}
          >
            <LinearGradient
              colors={["#0891B2", "#22D3EE"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Check size={14} stroke="#fff" strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>Speichern</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatarWrapper}
            accessibilityRole="button"
            accessibilityLabel="Profilbild ändern"
          >
            {currentAvatar ? (
              <Image
                source={{ uri: currentAvatar }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <>
                <LinearGradient
                  colors={["#0891B2", "#22D3EE"]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </>
            )}
            <View style={styles.avatarEditBadge}>
              <Camera size={14} stroke="#fff" strokeWidth={2} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tippe zum Ändern</Text>
        </View>

        {/* Felder */}
        <View style={styles.fields}>
          <FieldGroup
            icon={AtSign}
            label="Benutzername"
            hint="Mindestens 3 Zeichen, einzigartig"
          >
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="dein_username"
              placeholderTextColor="#374151"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          </FieldGroup>

          <FieldGroup icon={FileText} label="Bio" hint={`${bio.length}/150`}>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Beschreibe deinen Vibe..."
              placeholderTextColor="#374151"
              multiline
              maxLength={150}
            />
          </FieldGroup>

          <FieldGroup icon={Link} label="Website">
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://deine-website.com"
              placeholderTextColor="#374151"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={100}
            />
          </FieldGroup>

          <View style={styles.infoCard}>
            <User size={14} stroke="#6B7280" strokeWidth={1.8} />
            <Text style={styles.infoText}>
              Dein Profil ist öffentlich sichtbar für alle Vibes-Nutzer.
            </Text>
          </View>
        </View>

        {/* ── KI-Stimme ── */}
        <View style={styles.dangerSection}>
          <View style={styles.sectionHeader}>
            <Mic size={14} stroke="#A78BFA" strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: '#A78BFA' }]}>KI-Stimme</Text>
          </View>
          <Pressable
            onPress={() => setShowVoiceSetup(true)}
            style={[
              styles.passwordBtn,
              { borderColor: hasVoice ? 'rgba(167,139,250,0.4)' : 'rgba(34,211,238,0.25)' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Meine KI-Stimme einrichten"
          >
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: hasVoice ? 'rgba(167,139,250,0.15)' : 'rgba(34,211,238,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Mic size={16} stroke={hasVoice ? '#A78BFA' : '#22D3EE'} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.passwordText, { color: hasVoice ? '#A78BFA' : '#22D3EE' }]}>
                Meine KI-Stimme
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                {hasVoice
                  ? '✓ Stimme gespeichert — Chatterbox spricht wie du'
                  : 'Stimme aufnehmen (5–15 Sek.)'}
              </Text>
            </View>
            <ChevronRight size={16} stroke="#6B7280" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Notification-Einstellungen */}
        <View style={styles.dangerSection}>

          <View style={styles.sectionHeader}>
            <Bell size={14} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
          </View>
          {([
            { key: 'likes', label: 'Likes', sub: 'Wenn jemand deinen Post liket' },
            { key: 'comments', label: 'Kommentare', sub: 'Wenn jemand kommentiert' },
            { key: 'follows', label: 'Neue Follower', sub: 'Wenn dir jemand folgt' },
            { key: 'liveAlerts', label: 'Live-Streams', sub: 'Wenn jemand live geht dem du folgst' },
            { key: 'messages', label: 'Nachrichten', sub: 'Neue Direktnachrichten' },
            { key: 'reposts', label: 'Reposts', sub: 'Wenn jemand deinen Post repostet' },
          ] as const).map(({ key, label, sub }) => (
            <View key={key} style={[styles.passwordBtn, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.passwordText}>{label}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{sub}</Text>
              </View>
              <Switch
                value={notifPrefs[key]}
                onValueChange={(val) => setNotifPrefs({ [key]: val })}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(34,211,238,0.5)' }}
                thumbColor={notifPrefs[key] ? '#22D3EE' : 'rgba(255,255,255,0.7)'}
                accessibilityLabel={`${label} Benachrichtigungen`}
              />
            </View>
          ))}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          {/* Privates Profil Toggle */}
          <View style={[styles.passwordBtn, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Lock size={16} stroke={isPrivate ? '#22D3EE' : '#9CA3AF'} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.passwordText, isPrivate && { color: '#22D3EE' }]}>Privates Profil</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>
                  {isPrivate ? 'Neue Follower müssen bestätigt werden' : 'Jeder kann dein Profil sehen'}
                </Text>
              </View>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={async (val) => {
                setIsPrivate(val);
                const { error } = await supabase
                  .from('profiles')
                  .update({ is_private: val })
                  .eq('id', profile?.id ?? '');
                if (error) {
                  setIsPrivate(!val); // Rollback
                  Alert.alert('Fehler', 'Einstellung konnte nicht gespeichert werden.');
                } else {
                  // Lokalen Store aktualisieren
                  setProfile({ ...(profile as any), is_private: val });
                }
              }}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(34,211,238,0.5)' }}
              thumbColor={isPrivate ? '#22D3EE' : 'rgba(255,255,255,0.7)'}
              accessibilityLabel="Privates Profil aktivieren oder deaktivieren"
            />
          </View>

          {/* Geblockte Nutzer */}
          <Pressable
            onPress={() => router.push('/blocked-users' as any)}
            style={styles.passwordBtn}
            accessibilityRole="button"
            accessibilityLabel="Geblockte Nutzer verwalten"
          >
            <Shield size={16} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.passwordText}>Geblockte Nutzer</Text>
            <ChevronRight size={16} stroke="#6B7280" strokeWidth={2} style={{ marginLeft: 'auto' }} />
          </Pressable>

          {/* Datenschutzerklärung */}
          <Pressable
            onPress={() => Linking.openURL('https://vibes-web-nine.vercel.app/privacy').catch(() => { })}
            style={styles.passwordBtn}
            accessibilityRole="link"
            accessibilityLabel="Datenschutzerklärung öffnen"
          >
            <ExternalLink size={16} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.passwordText}>Datenschutzerklärung</Text>
          </Pressable>

          {/* Nutzungsbedingungen */}
          <Pressable
            onPress={() => Linking.openURL('https://vibes-web-nine.vercel.app/privacy').catch(() => { })}
            style={styles.passwordBtn}
            accessibilityRole="link"
            accessibilityLabel="Nutzungsbedingungen öffnen"
          >
            <ExternalLink size={16} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.passwordText}>Nutzungsbedingungen</Text>
          </Pressable>

          {/* E-Mail ändern */}
          <Pressable
            onPress={handleChangeEmail}
            disabled={changingEmail}
            style={styles.passwordBtn}
            accessibilityRole="button"
            accessibilityLabel="E-Mail-Adresse ändern"
            accessibilityState={{ disabled: changingEmail }}
          >
            {changingEmail
              ? <ActivityIndicator size="small" color="#22D3EE" />
              : <Mail size={16} stroke="#22D3EE" strokeWidth={2} />
            }
            <Text style={styles.passwordText}>E-Mail ändern</Text>
          </Pressable>

          {/* Passwort ändern */}
          <Pressable
            onPress={handleChangePassword}
            disabled={changingPw}
            style={styles.passwordBtn}
            accessibilityRole="button"
            accessibilityLabel="Passwort ändern"
            accessibilityState={{ disabled: changingPw }}
          >
            {changingPw
              ? <ActivityIndicator size="small" color="#22D3EE" />
              : <Lock size={16} stroke="#22D3EE" strokeWidth={2} />
            }
            <Text style={styles.passwordText}>Passwort ändern</Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Abmelden"
          >
            <LogOut size={16} stroke="#F87171" strokeWidth={2} />
            <Text style={styles.logoutText}>Abmelden</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteAccount}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Account dauerhaft löschen"
          >
            <Trash2 size={14} stroke="#6B7280" strokeWidth={2} />
            <Text style={styles.deleteText}>Account löschen</Text>
          </Pressable>

          {/* App Version */}
          <Text style={styles.versionText}>
            Vibes v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </ScrollView>

      {/* KI-Stimme Setup */}
      <VoiceSetupSheet
        visible={showVoiceSetup}
        onClose={() => setShowVoiceSetup(false)}
      />
    </KeyboardAvoidingView>
  );
}

function FieldGroup({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Icon size={13} stroke="#6B7280" strokeWidth={2} />
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      <View style={styles.fieldBox}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    overflow: "hidden",
    minWidth: 110,
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    paddingTop: 32,
    paddingBottom: 60,
    gap: 32,
  },
  avatarSection: {
    alignItems: "center",
    gap: 10,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(34,211,238,0.4)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "800",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0891B2",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "500",
  },
  fields: {
    paddingHorizontal: 20,
    gap: 20,
  },
  fieldGroup: { gap: 8 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fieldLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  fieldHint: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "500",
  },
  fieldBox: {
    backgroundColor: "#0D0D0D",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 14,
  },
  bioInput: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  infoText: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  dangerSection: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },
  passwordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(34,211,238,0.07)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(34,211,238,0.25)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  passwordText: {
    color: "#22D3EE",
    fontSize: 15,
    fontWeight: "600",
  },
  logoutBtn: {

    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(248,113,113,0.08)",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(248,113,113,0.25)",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  logoutText: {
    color: "#F87171",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  deleteText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "500",
  },
  versionText: {
    color: "#374151",
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
