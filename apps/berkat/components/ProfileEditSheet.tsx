// Profil bearbeiten — Profilbild, Kopfbild, Anzeigename, Bio.
//
// ⚠️ Das PROFILBILD kam erst am 21.08.2026 dazu. Bis dahin gab es in ganz
// Berkat keinen einzigen Avatar-Upload: Das Bild wurde an einem Dutzend
// Stellen angezeigt, aber nirgends gesetzt — wer keins aus Serlo mitbrachte,
// hatte für immer den grauen Kreis. Gefunden im ersten Durchlauf der
// Prüfliste am Gerät, nicht im Code.
//
// Der BENUTZERNAME fehlt bewusst. Er ist Serlo-weit eindeutig und steht schon
// in Live-Chats, Bestellungen und Bürgschaften; ihn hier änderbar zu machen
// hieße, an einem Namen zu drehen, der an anderen Orten bereits vergeben ist.
// Genau dafür gibt es den ANZEIGENAMEN daneben — bei Whatnot steht er klein
// unter dem @-Namen (`mode_und_vieles` / `Modeundvieles`).
//
// `Modal` statt einer eigenen Overlay-Ebene: Auf Android bekommen überstehende
// Absolut-Ebenen über der Navigationsleiste keine Berührungen (dieselbe Falle
// wie beim Tab-Karussell in Serlo). Ein echtes Modal umgeht das.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { BIO_MAX, NAME_MAX } from '../lib/useProfileEdit';

type Props = {
  visible: boolean;
  initialBio: string | null;
  initialDisplayName: string | null;
  busy: boolean;
  /** Läuft gerade ein Upload? Dann ist der Bild-Bereich blockiert. */
  uploading: boolean;
  onPickBanner: () => void;
  onPickAvatar: () => void;
  onSave: (
    bio: string,
    displayName: string,
    bannerUrl: string | null,
    avatarUrl: string | null,
  ) => void;
  onClose: () => void;
  /** Vom Bildschirm gehalten, damit ein Upload das Blatt überlebt. */
  bannerUrl: string | null;
  onClearBanner: () => void;
  avatarUrl: string | null;
  onClearAvatar: () => void;
};

export function ProfileEditSheet({
  visible,
  initialBio,
  initialDisplayName,
  busy,
  uploading,
  onPickBanner,
  onPickAvatar,
  onSave,
  onClose,
  bannerUrl,
  onClearBanner,
  avatarUrl,
  onClearAvatar,
}: Props) {
  const [bio, setBio] = useState(initialBio ?? '');
  const [name, setName] = useState(initialDisplayName ?? '');

  // Beim Öffnen auf den gespeicherten Stand zurücksetzen. Ohne das stünde nach
  // einem Abbrechen beim nächsten Öffnen der verworfene Text wieder da.
  useEffect(() => {
    if (visible) {
      setBio(initialBio ?? '');
      setName(initialDisplayName ?? '');
    }
  }, [visible, initialBio, initialDisplayName]);

  const left = BIO_MAX - bio.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
      >
        <View style={s.sheet}>
          <View style={s.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.title}>Dein Profil</Text>

            {/* ── Profilbild ────────────────────────────────────────────── */}
            {/* Steht VOR dem Kopfbild, und das ist keine Reihenfolge nach
                Größe: Das Gesicht ist in dieser Gemeinschaft das, was über
                Vertrauen entscheidet (Ausgangsanalyse § B5). Das Kopfbild ist
                Dekoration, der Avatar ist die Person.

                Rund gezeichnet, also quadratisch zugeschnitten — hier ist
                `allowsEditing` genau richtig, weil iOS' Rahmen quadratisch IST
                (Abschnitt 3). Nebeneffekt: Der Zuschnitt verkleinert die Datei,
                das Bild läuft also nicht in die 8-MB-Grenze. */}
            <Text style={s.label}>Profilbild</Text>
            <View style={s.avatarRow}>
              <Pressable
                style={s.avatar}
                onPress={onPickAvatar}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Profilbild wählen"
              >
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <ImagePlus size={20} color={ui.textMuted} />
                )}
              </Pressable>
              <View style={s.avatarText}>
                <Text style={s.sub}>
                  Zeigt sich im Live-Raum, an deinen Angeboten und in jedem Chat. Ohne Bild
                  steht dort ein grauer Kreis.
                </Text>
                {avatarUrl && !uploading ? (
                  <Pressable
                    style={s.remove}
                    onPress={onClearAvatar}
                    accessibilityRole="button"
                  >
                    <Trash2 size={14} color={ui.live} />
                    <Text style={s.removeText}>Profilbild entfernen</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* ── Kopfbild ──────────────────────────────────────────────── */}
            <Text style={s.label}>Kopfbild</Text>
            <Pressable
              style={s.banner}
              onPress={onPickBanner}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Kopfbild wählen"
            >
              {bannerUrl ? (
                <Image
                  source={{ uri: bannerUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
              {uploading ? (
                <ActivityIndicator color={ui.brand} />
              ) : bannerUrl ? null : (
                <>
                  <ImagePlus size={20} color={ui.textMuted} />
                  <Text style={s.bannerHint}>Bild wählen</Text>
                </>
              )}
            </Pressable>
            {bannerUrl && !uploading ? (
              <Pressable style={s.remove} onPress={onClearBanner} accessibilityRole="button">
                <Trash2 size={14} color={ui.live} />
                <Text style={s.removeText}>Kopfbild entfernen</Text>
              </Pressable>
            ) : null}

            {/* ── Anzeigename ───────────────────────────────────────────── */}
            <Text style={s.label}>Anzeigename</Text>
            <TextInput
              value={name}
              onChangeText={(text) => setName(text.slice(0, NAME_MAX))}
              placeholder="Mode und Vieles"
              placeholderTextColor={ui.textMuted}
              style={s.input}
              maxLength={NAME_MAX}
            />
            <Text style={s.sub}>
              Frei wählbar. Dein Benutzername bleibt, wie er ist — er steht schon in Chats und
              Bestellungen.
            </Text>

            {/* ── Bio ───────────────────────────────────────────────────── */}
            <Text style={s.label}>Über dich</Text>
            <TextInput
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, BIO_MAX))}
              placeholder="Ich verkaufe Parfüm und Tücher, meist samstags ab 20 Uhr."
              placeholderTextColor={ui.textMuted}
              style={[s.input, s.inputTall]}
              multiline
              maxLength={BIO_MAX}
              textAlignVertical="top"
            />
            <Text style={[s.counter, left < 30 && s.counterLow]}>{left} Zeichen übrig</Text>

            <Pressable
              style={[s.primary, (busy || uploading) && s.primaryBusy]}
              disabled={busy || uploading}
              onPress={() => onSave(bio, name, bannerUrl, avatarUrl)}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text style={s.primaryText}>Speichern</Text>
              )}
            </Pressable>

            <Pressable style={s.ghost} onPress={onClose} accessibilityRole="button">
              <Text style={s.ghostText}>Abbrechen</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,36,30,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: ui.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: ui.lineStrong,
    marginBottom: space.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: ui.text, marginBottom: space.sm },

  label: { fontSize: 11, color: ui.textMuted, marginTop: space.md, marginBottom: 6 },
  sub: { fontSize: 11, color: ui.textMuted, marginTop: 5, lineHeight: 16 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { flex: 1, minWidth: 0 },
  banner: {
    height: 108,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  bannerHint: { fontSize: 12, color: ui.textMuted },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.sm },
  removeText: { fontSize: 12, fontWeight: '600', color: ui.live },

  input: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    fontSize: 15,
    color: ui.text,
    lineHeight: 21,
  },
  inputTall: { minHeight: 104 },
  counter: { fontSize: 11, color: ui.textMuted, textAlign: 'right', marginTop: 5 },
  counterLow: { color: ui.live },

  primary: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  primaryBusy: { opacity: 0.6 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});
