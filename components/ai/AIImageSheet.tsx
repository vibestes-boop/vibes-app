/**
 * components/ai/AIImageSheet.tsx — Wiederverwendbares Bottom-Sheet für AI-Image-Generation
 *
 * Modal-Sheet mit Prompt-Input + Size-Picker + Generate-Button + Preview +
 * „Use this" / „Retry" / „Cancel"-Actions. Wird von allen Einsatzorten
 * gemeinsam genutzt:
 *   • Shop-Produkt-Mockup (my-shop.tsx)
 *   • Post-Cover (create/*.tsx)
 *   • Live-Thumbnail (live/start.tsx)
 *   • Avatar (settings.tsx)
 *   • Sticker / Icon (Admin, Phase 2)
 *
 * Purpose + Size sind vom Aufrufer vorgegeben, das Sheet kümmert sich um
 * Prompt-UX, Call zum Edge-Function, Error-Mapping und Preview-Rendering.
 */

import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, X, RefreshCw, Check } from 'lucide-react-native';
import {
  useGenerateImage,
  useAIImageQuota,
  markAIImageConsumed,
  type AIImagePurpose,
  type AIImageSize,
} from '@/lib/useGenerateImage';
import { useTheme } from '@/lib/useTheme';

export interface AIImageSheetProps {
  visible: boolean;
  onClose: () => void;
  onUseImage: (url: string) => void;
  purpose: AIImagePurpose;
  // Default-Size je nach Einsatzort — Shop: 1024, Live-Thumb: 1536x1024, Avatar: 512
  defaultSize?: AIImageSize;
  // Hint/Placeholder-Text oberhalb des Prompt-Inputs
  title?: string;
  promptPlaceholder?: string;
  // Optional: Vorgeschlagene Prompt-Starter (z.B. für Shop-Kategorien)
  suggestions?: string[];
}

const PROMPT_MIN = 3;
const PROMPT_MAX = 500;

// Size-Optionen, gefiltert per Purpose (Avatare sind quadratisch, Thumbs breit, etc.)
function availableSizes(purpose: AIImagePurpose): AIImageSize[] {
  if (purpose === 'avatar' || purpose === 'sticker' || purpose === 'icon') {
    return ['512x512', '1024x1024'];
  }
  if (purpose === 'live_thumbnail' || purpose === 'post_cover') {
    return ['1024x1024', '1536x1024', '1024x1536'];
  }
  // shop_mockup
  return ['1024x1024', '1024x1536', '1536x1024'];
}

// Human-readable Fehler-Mapping für Rate-Limits / Guards
// Phase-4 Codes (feature_disabled, platform_budget_exhausted, rate_limit_week)
// + Legacy-Codes aus Phase 1 (falls alte Edge-Function-Instanz noch läuft).
function prettyError(code: string, fallback: string): string {
  switch (code) {
    case 'feature_disabled':
      return 'AI-Bilder sind aktuell nicht verfügbar. Bitte später erneut versuchen.';
    case 'platform_budget_exhausted':
      return 'Das monatliche AI-Budget ist aufgebraucht. Anfang nächsten Monats wieder verfügbar.';
    case 'rate_limit_day':
      return 'Tages-Limit erreicht (3 Bilder / 24h). Morgen geht es weiter.';
    case 'rate_limit_week':
      return 'Wochen-Limit erreicht (10 Bilder / 7 Tage).';
    // Legacy:
    case 'rate_limit_minute':
      return 'Du hast gerade mehrere Bilder generiert — kurz durchatmen und in einer Minute nochmal versuchen.';
    case 'cost_limit_month':
      return 'Monats-Budget erreicht. Am 1. des nächsten Monats steht wieder Kontingent bereit.';
    case 'prompt_too_short':
      return 'Dein Prompt ist zu kurz — beschreibe das gewünschte Bild in mindestens 3 Zeichen.';
    case 'prompt_too_long':
      return 'Dein Prompt ist zu lang (max 2000 Zeichen).';
    case 'prompt_blocked':
      return 'Dieser Prompt enthält nicht erlaubte Inhalte.';
    case 'unauthorized':
      return 'Du musst eingeloggt sein.';
    case 'network_error':
      return 'Keine Verbindung. Prüfe dein Internet.';
    default:
      return fallback;
  }
}

export function AIImageSheet({
  visible,
  onClose,
  onUseImage,
  purpose,
  defaultSize,
  title = 'Bild mit KI erstellen',
  promptPlaceholder = 'Beschreibe dein Wunsch-Bild auf Deutsch oder Englisch…',
  suggestions,
}: AIImageSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { generate, isGenerating } = useGenerateImage();
  const { quota, refetch: refetchQuota } = useAIImageQuota(visible);

  const sizes = availableSizes(purpose);
  const [size, setSize] = useState<AIImageSize>(defaultSize ?? sizes[0]);
  const [prompt, setPrompt] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bei Mount/Purpose-Change die Default-Size neu setzen
  useEffect(() => {
    setSize(defaultSize ?? sizes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, defaultSize]);

  // Sheet-Close → alles zurücksetzen (damit nächster Open-Cycle clean ist)
  const handleClose = () => {
    setPrompt('');
    setPreviewUrl(null);
    setGenerationId(null);
    setErrorMsg(null);
    onClose();
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < PROMPT_MIN) {
      setErrorMsg(prettyError('prompt_too_short', 'Prompt zu kurz.'));
      return;
    }
    setErrorMsg(null);
    setPreviewUrl(null);
    setGenerationId(null);

    const result = await generate({ prompt: trimmed, purpose, size });
    if (!result.ok) {
      setErrorMsg(prettyError(result.code, result.error));
      return;
    }
    setPreviewUrl(result.url);
    setGenerationId(result.generationId);
    // Quota-Counter nach erfolgreichem Gen aktualisieren — zeigt dem User
    // sofort „nur noch N übrig" statt erst beim nächsten Sheet-Open.
    refetchQuota();
  };

  const handleUse = () => {
    if (!previewUrl) return;
    // Fire-and-forget: Mark als verwendet damit Retention-Cron das Bild
    // nicht einsammelt. Fehler werden intern geschluckt, UX-Flow unblocked.
    if (generationId) {
      void markAIImageConsumed(generationId);
    }
    onUseImage(previewUrl);
    handleClose();
  };

  const handleRetry = () => {
    setPreviewUrl(null);
    setGenerationId(null);
    setErrorMsg(null);
  };

  // Submit-Gate: feature_enabled=false oder Tages-/Wochen-/Platform-Limit
  // erreicht → Button disablen und eine erklärende Fußzeile zeigen statt
  // erst nach dem Call zu failen.
  const quotaBlock = (() => {
    if (!quota) return { blocked: false, reason: '' as string };
    if (!quota.feature_enabled) {
      return { blocked: true, reason: 'AI-Bilder sind aktuell deaktiviert.' };
    }
    if (quota.platform_cap_reached) {
      return { blocked: true, reason: 'Monatliches Platform-Budget aufgebraucht.' };
    }
    if (quota.remaining_today <= 0) {
      return { blocked: true, reason: 'Tages-Limit (3 Bilder) erreicht.' };
    }
    if (quota.remaining_week <= 0) {
      return { blocked: true, reason: 'Wochen-Limit (10 Bilder) erreicht.' };
    }
    return { blocked: false, reason: '' };
  })();

  // Preview-Aspect ergibt sich aus der Size-Selection (1:1 / 2:3 / 3:2)
  const previewAspect = (() => {
    if (size === '1024x1536') return 1024 / 1536;
    if (size === '1536x1024') return 1536 / 1024;
    return 1;
  })();

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={[s.root, { backgroundColor: colors.bg.primary }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border.subtle }]}>
          <Pressable onPress={handleClose} style={s.headerBtn}>
            <Text style={[s.headerBtnText, { color: colors.text.muted }]}>Abbrechen</Text>
          </Pressable>
          <View style={s.headerCenter}>
            <Sparkles size={16} color={colors.accent.primary} strokeWidth={2} />
            <Text style={[s.headerTitle, { color: colors.text.primary }]}>{title}</Text>
          </View>
          <View style={s.headerBtn} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview (wenn vorhanden) */}
          {previewUrl ? (
            <View
              style={[
                s.previewWrap,
                { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle, aspectRatio: previewAspect },
              ]}
            >
              <Image source={{ uri: previewUrl }} style={s.previewImg} contentFit="cover" />
            </View>
          ) : null}

          {/* Quota-Counter — Scarcity-Signal + Transparenz */}
          {!previewUrl && quota && (
            <View
              style={[
                s.quotaBox,
                {
                  backgroundColor: quotaBlock.blocked
                    ? 'rgba(239,68,68,0.08)'
                    : quota.remaining_today === 1
                    ? 'rgba(245,158,11,0.08)'
                    : colors.bg.elevated,
                  borderColor: quotaBlock.blocked
                    ? 'rgba(239,68,68,0.3)'
                    : quota.remaining_today === 1
                    ? 'rgba(245,158,11,0.3)'
                    : colors.border.subtle,
                },
              ]}
            >
              <Sparkles
                size={14}
                color={quotaBlock.blocked ? '#ef4444' : colors.accent.primary}
                strokeWidth={2}
              />
              <Text style={[s.quotaText, { color: colors.text.primary }]}>
                {quotaBlock.blocked
                  ? quotaBlock.reason
                  : `Heute noch ${quota.remaining_today} von ${quota.limit_day} Bildern · diese Woche ${quota.remaining_week} von ${quota.limit_week}`}
              </Text>
            </View>
          )}

          {/* Prompt */}
          {!previewUrl && (
            <>
              <Text style={[s.label, { color: colors.text.primary }]}>Dein Prompt</Text>
              <TextInput
                style={[
                  s.promptInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.bg.elevated,
                    borderColor: colors.border.subtle,
                  },
                ]}
                value={prompt}
                onChangeText={(t) => setPrompt(t.slice(0, PROMPT_MAX))}
                placeholder={promptPlaceholder}
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={4}
                maxLength={PROMPT_MAX}
                editable={!isGenerating}
                textAlignVertical="top"
              />
              <Text style={[s.charCount, { color: colors.text.muted }]}>
                {prompt.length} / {PROMPT_MAX}
              </Text>

              {/* Suggestions */}
              {suggestions && suggestions.length > 0 && (
                <>
                  <Text style={[s.label, { color: colors.text.primary, marginTop: 16 }]}>
                    Beispiele
                  </Text>
                  <View style={s.suggestRow}>
                    {suggestions.map((sug) => (
                      <Pressable
                        key={sug}
                        onPress={() => setPrompt(sug)}
                        style={[
                          s.suggestChip,
                          { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
                        ]}
                      >
                        <Text style={[s.suggestText, { color: colors.text.primary }]} numberOfLines={2}>
                          {sug}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {/* Size-Picker */}
              {sizes.length > 1 && (
                <>
                  <Text style={[s.label, { color: colors.text.primary, marginTop: 20 }]}>Format</Text>
                  <View style={s.sizeRow}>
                    {sizes.map((sz) => {
                      const isActive = sz === size;
                      return (
                        <Pressable
                          key={sz}
                          onPress={() => setSize(sz)}
                          style={[
                            s.sizeChip,
                            {
                              backgroundColor: isActive ? colors.accent.primary : colors.bg.elevated,
                              borderColor: isActive ? colors.accent.primary : colors.border.subtle,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.sizeChipText,
                              { color: isActive ? '#fff' : colors.text.primary },
                            ]}
                          >
                            {sizeLabel(sz)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* Error */}
          {errorMsg && (
            <View style={[s.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
              <Text style={[s.errorText, { color: '#ef4444' }]}>{errorMsg}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action-Bar */}
        <View
          style={[
            s.actionBar,
            { borderTopColor: colors.border.subtle, paddingBottom: insets.bottom + 12 },
          ]}
        >
          {previewUrl ? (
            <>
              <Pressable
                onPress={handleRetry}
                disabled={isGenerating}
                style={[
                  s.actionBtn,
                  s.actionBtnSecondary,
                  { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
                ]}
              >
                <RefreshCw size={16} color={colors.text.primary} strokeWidth={2} />
                <Text style={[s.actionBtnText, { color: colors.text.primary }]}>Anderen Prompt</Text>
              </Pressable>
              <Pressable
                onPress={handleUse}
                disabled={isGenerating}
                style={[s.actionBtn, { backgroundColor: colors.accent.primary }]}
              >
                <Check size={16} color="#fff" strokeWidth={2.5} />
                <Text style={[s.actionBtnText, { color: '#fff' }]}>Bild verwenden</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating || prompt.trim().length < PROMPT_MIN || quotaBlock.blocked}
              style={[
                s.actionBtn,
                {
                  backgroundColor: colors.accent.primary,
                  opacity: prompt.trim().length < PROMPT_MIN || quotaBlock.blocked ? 0.5 : 1,
                },
              ]}
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.actionBtnText, { color: '#fff' }]}>Generiere…</Text>
                </>
              ) : (
                <>
                  <Sparkles size={16} color="#fff" strokeWidth={2} />
                  <Text style={[s.actionBtnText, { color: '#fff' }]}>Bild generieren</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function sizeLabel(sz: AIImageSize): string {
  if (sz === '512x512') return 'Klein · 1:1';
  if (sz === '1024x1024') return 'Quadrat · 1:1';
  if (sz === '1024x1536') return 'Hoch · 2:3';
  if (sz === '1536x1024') return 'Quer · 3:2';
  return sz;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 80 },
  headerBtnText: { fontSize: 15 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },

  promptInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 110,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  suggestText: { fontSize: 12 },

  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sizeChipText: { fontSize: 13, fontWeight: '600' },

  previewWrap: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewImg: { width: '100%', height: '100%' },

  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { fontSize: 13, lineHeight: 18 },

  quotaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  quotaText: { fontSize: 12, fontWeight: '500', flex: 1 },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
  },
  actionBtnSecondary: { borderWidth: StyleSheet.hairlineWidth },
  actionBtnText: { fontSize: 15, fontWeight: '700' },
});
