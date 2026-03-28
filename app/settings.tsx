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
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import {
  requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
} from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Check,
  User,
  FileText,
  AtSign,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { uploadAvatar } from "@/lib/uploadMedia";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const currentAvatar = avatarUri ?? profile?.avatar_url ?? null;

  const pickAvatar = async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Berechtigung erforderlich",
        "Bitte erlaube den Zugriff auf deine Fotos.",
      );
      return;
    }
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
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

      Alert.alert("Gespeichert ✓", "Dein Profil wurde aktualisiert.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Fehler", err?.message ?? "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const avatarInitial = profile?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} stroke="#9CA3AF" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <Animated.View style={saveStyle}>
          <Pressable
            onPressIn={() => {
              saveScale.value = withTiming(0.88, { duration: 80 });
            }}
            onPressOut={() => {
              saveScale.value = withTiming(1, { duration: 80 });
            }}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            <LinearGradient
              colors={["#7C3AED", "#A78BFA"]}
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
          <Pressable onPress={pickAvatar} style={styles.avatarWrapper}>
            {currentAvatar ? (
              <Image
                source={{ uri: currentAvatar }}
                style={styles.avatarImage}
              />
            ) : (
              <>
                <LinearGradient
                  colors={["#7C3AED", "#A78BFA"]}
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

          <View style={styles.infoCard}>
            <User size={14} stroke="#6B7280" strokeWidth={1.8} />
            <Text style={styles.infoText}>
              Dein Profil ist öffentlich sichtbar für alle Vibes-Nutzer.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    borderColor: "rgba(167,139,250,0.4)",
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
    backgroundColor: "#7C3AED",
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
});
