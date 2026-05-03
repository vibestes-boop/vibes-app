/**
 * VoiceSetupSheet.tsx — Chatterbox S2: Creator-Stimme klonen
 *
 * Schönes Setup-Sheet mit:
 * - Pulsierendem Record-Button
 * - Timer-Anzeige
 * - Animierte Wellenform während Aufnahme
 * - Vorschau-Wiedergabe
 * - Upload & Speichern
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  X,
  Check,
  Volume2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Reanimated via require() — vermeidet Hermes-Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const RNAnimated = {
  View: _animNS?.View ?? _animMod?.View,
};
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import { useVoiceClone } from '@/lib/useVoiceClone';

// ── Wellenform-Balken ────────────────────────────────────────────────────────

function WaveBar({ delay, isActive }: { delay: number; isActive: boolean }) {
  const height = useSharedValue(4);

  useEffect(() => {
    if (isActive) {
      height.value = withRepeat(
        withSequence(
          withTiming(4 + Math.random() * 28, {
            duration: 200 + Math.random() * 300,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(4 + Math.random() * 12, {
            duration: 200 + Math.random() * 200,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      );
    } else {
      // Neuen Wert setzen → Reanimated bricht vorherige Animation automatisch ab
      height.value = withTiming(4, { duration: 200 });
    }
  }, [isActive, delay, height]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
    width: 3,
    borderRadius: 2,
    backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
    marginHorizontal: 2,
  }));

  return <RNAnimated.View style={style} />;
}

function Waveform({ isActive }: { isActive: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <View style={styles.waveform}>
      {bars.map((_, i) => (
        <WaveBar key={i} delay={i * 30} isActive={isActive} />
      ))}
    </View>
  );
}

// ── Pulse-Ring um den Record-Button ──────────────────────────────────────────

function PulseRing({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 800, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 0 }),
        ),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 100 }),
          withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      // Neuen Wert setzen → Reanimated bricht vorherige Animation automatisch ab
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [active, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#EF4444',
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <RNAnimated.View style={ringStyle} />;
}

// ── Timer ────────────────────────────────────────────────────────────────────

function Timer({ ms }: { ms: number }) {
  const secs = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return (
    <Text style={styles.timer}>
      {String(secs).padStart(2, '0')}.{tenths}
      <Text style={styles.timerMax}> / 15s</Text>
    </Text>
  );
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VoiceSetupSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    cloneState,
    durationMs,
    localUri,
    savedUrl,
    isPlaying,
    errorMsg,
    startRecording,
    stopRecording,
    playPreview,
    stopPreview,
    uploadAndSave,
    deleteVoice,
    reset,
  } = useVoiceClone();

  const isRecording = cloneState === 'recording';
  const isRecorded = cloneState === 'recorded';
  const isUploading = cloneState === 'uploading';
  const isSaved = cloneState === 'saved';
  const isError = cloneState === 'error';
  const hasSaved = !!savedUrl;

  const handleClose = () => {
    if (isRecording) stopRecording();
    if (isPlaying) stopPreview();
    reset();
    onClose();
  };

  const handleRecord = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await startRecording();
  };

  const handleStop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await stopRecording();
  };

  const handlePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      stopPreview();
    } else {
      await playPreview();
    }
  };

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await uploadAndSave();
  };

  const handleDelete = () => {
    Alert.alert(
      'Stimme löschen',
      'Möchtest du deine gespeicherte Stimme wirklich löschen? Zukünftige Kommentar-Sprachausgaben nutzen dann wieder eine Standard-Stimme.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteVoice();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          {/* Kragen-Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Meine KI-Stimme</Text>
              <Text style={styles.subtitle}>Chatterbox spricht in deiner Stimme</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
              <X size={18} color="#6B7280" strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Info-Karte */}
            <View style={styles.infoCard}>
              <Volume2 size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.infoText}>
                Nimm einen kurzen Text (5–15 Sek.) in deiner natürlichen Stimme auf.
                Chatterbox nutzt ihn, um Kommentare in{' '}
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>deiner Stimme</Text> vorzulesen.
              </Text>
            </View>

            {/* Gespeicherte Stimme */}
            {hasSaved && cloneState !== 'saved' && (
              <View style={styles.savedBadge}>
                <Check size={14} color="#34D399" strokeWidth={2.5} />
                <Text style={styles.savedText}>Stimme gespeichert ✓</Text>
                <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteSavedBtn}>
                  <Trash2 size={14} color="#EF4444" strokeWidth={2} />
                </Pressable>
              </View>
            )}

            {/* Wellenform */}
            <View style={styles.waveformContainer}>
              <Waveform isActive={isRecording} />
            </View>

            {/* Record-Button (Mitte) */}
            <View style={styles.recordBtnWrapper}>
              <PulseRing active={isRecording} />

              {isRecording ? (
                // ── Stopp-Button ────────────────────────────
                <Pressable onPress={handleStop} style={styles.stopBtn}>
                  <LinearGradient
                    colors={['#DC2626', '#EF4444']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Square size={28} color="#fff" strokeWidth={0} fill="#fff" />
                </Pressable>
              ) : (
                // ── Record-Button ───────────────────────────
                <Pressable
                  onPress={handleRecord}
                  style={[
                    styles.recordBtn,
                    (isUploading || isSaved) && styles.recordBtnDisabled,
                  ]}
                  disabled={isUploading || isSaved}
                >
                  <LinearGradient
                    colors={
                      isUploading || isSaved
                        ? ['#1F2937', '#111827']
                        : ['#DC2626', '#EF4444']
                    }
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Mic size={32} color="#fff" strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Timer / Status */}
            <View style={styles.statusRow}>
              {isRecording && <Timer ms={durationMs} />}
              {isRecorded && !isRecording && (
                <Text style={styles.statusText}>
                  Aufnahme bereit —{' '}
                  <Text style={styles.statusHighlight}>
                    {(durationMs / 1000).toFixed(1)}s
                  </Text>
                </Text>
              )}
              {isUploading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.statusText}>Wird hochgeladen…</Text>
                </View>
              )}
              {isSaved && (
                <View style={styles.uploadingRow}>
                  <Check size={16} color="#34D399" strokeWidth={2.5} />
                  <Text style={[styles.statusText, { color: '#34D399' }]}>
                    Stimme gespeichert!
                  </Text>
                </View>
              )}
              {isError && (
                <Text style={styles.errorText}>{errorMsg ?? 'Fehler aufgetreten.'}</Text>
              )}
              {cloneState === 'idle' && !hasSaved && (
                <Text style={styles.hintText}>Tippe auf den Mikrofon-Button zum Aufnehmen</Text>
              )}
              {cloneState === 'idle' && hasSaved && (
                <Text style={styles.hintText}>Tippe zum Neu-Aufnehmen</Text>
              )}
            </View>

            {/* Aktions-Buttons (nach Aufnahme) */}
            {isRecorded && localUri && (
              <View style={styles.actionRow}>
                {/* Vorschau */}
                <Pressable onPress={handlePlay} style={styles.actionBtn}>
                  {isPlaying ? (
                    <Pause size={18} color="#FFFFFF" strokeWidth={2} />
                  ) : (
                    <Play size={18} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
                  )}
                  <Text style={styles.actionBtnText}>
                    {isPlaying ? 'Pause' : 'Anhören'}
                  </Text>
                </Pressable>

                {/* Neu aufnehmen */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    reset();
                  }}
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                >
                  <Mic size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                  <Text style={[styles.actionBtnText, { color: 'rgba(255,255,255,0.5)' }]}>
                    Neu aufnehmen
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Speichern-Button */}
            {isRecorded && (
              <Pressable
                onPress={handleSave}
                style={styles.saveBtn}
                disabled={isUploading}
              >
                <LinearGradient
                  colors={['#CCCCCC', '#FFFFFF']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Upload size={16} color="#fff" strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>Stimme speichern</Text>
              </Pressable>
            )}

            {/* Erfolg — Fertig-Button */}
            {isSaved && (
              <Pressable onPress={handleClose} style={styles.saveBtn}>
                <LinearGradient
                  colors={['#059669', '#34D399']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Check size={16} color="#fff" strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>Super! Fertig ✓</Text>
              </Pressable>
            )}

            {/* Hinweis */}
            <Text style={styles.footnote}>
              Beispiel-Text zum Vorlesen:{'\n'}
              <Text style={styles.footnoteExample}>
                {'„Hey, ich bin dabei! Schau dir meinen neuesten Vibe an – du wirst es lieben.“'}
              </Text>
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A0A0F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    padding: 24,
    gap: 20,
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(29,185,84,0.06)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    alignSelf: 'stretch',
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 20,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'stretch',
  },
  savedText: {
    flex: 1,
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteSavedBtn: {
    padding: 4,
  },
  waveformContainer: {
    height: 56,
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  recordBtnWrapper: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  recordBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  recordBtnDisabled: {
    shadowOpacity: 0,
  },
  stopBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  statusRow: {
    alignItems: 'center',
    minHeight: 28,
  },
  timer: {
    color: '#EF4444',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  timerMax: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    fontWeight: '400',
  },
  statusText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  statusHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  hintText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(29,185,84,0.08)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 14,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#CCCCCC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footnote: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  footnoteExample: {
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
});
