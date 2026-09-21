/**
 * Teilen — Berkats eigenes Blatt statt des iOS-System-Fensters.
 *
 * ⚠️ SEIT DEM 21.09.2026 FÜR BEIDE FLÄCHEN (vorher `LiveShareSheet`).
 * Das Blatt entstand für den Live-Raum. Die ARTIKELSEITE hat es nie bekommen
 * und teilte weiter über `Share.share({ message })` — also mit genau den drei
 * Fehlern, die hier am 17.09. behoben worden waren: System-Fenster statt
 * eigenem Blatt, Link als TEXT statt als `url` (auf dem iPhone das graue „A"
 * statt einer Karte) und kein Vorschaubild auf der Zielseite.
 *
 * Eine zweite Abschrift wäre der Fehler, für den es `ListingCard` gibt. Die
 * vier Ziele und ihre Fallen (Universal Links, `sms:`-Schema je Plattform,
 * Reihenfolge Schließen-dann-Öffnen) stehen deshalb EINMAL hier; verschieden
 * ist nur die Fläche: Der Live-Raum ist dunkel, die Artikelseite hell.
 *
 * ⚠️ WARUM ES DIESES BLATT GIBT (17.09.2026)
 * Nach dem Vorschaubild (Übergabe 107) kam vom Host der nächste Satz: „wenn man
 * Teilen drückt, kommt ein iPhone-Fenster von unten hoch." Das System-Blatt
 * ist technisch richtig und fühlt sich fremd an — Whatnot, TikTok und
 * Instagram zeigen zuerst ein eigenes Blatt mit den zwei, drei Zielen, die
 * wirklich benutzt werden, und erst dahinter das System.
 *
 * Vier Ziele, alle OHNE natives Modul (das ist die Bedingung, damit das Blatt
 * per OTA ankommt und den Update-Weg nicht zerstört):
 *   WhatsApp   → https://wa.me/?text=…          (Universal Link; öffnet die App,
 *                                                 sonst das Web — kein Schema, kein
 *                                                 LSApplicationQueriesSchemes)
 *   Telegram   → https://t.me/share/url?url=…&text=…
 *   Nachricht  → sms:&body=…  (iOS) / sms:?body=… (Android)
 *   Mehr       → das System-Blatt, mit `url` auf iOS (Karte statt „A")
 *
 * ⚠️ KEIN „Link kopieren". React Native hat keine Zwischenablage mehr im Kern;
 * `expo-clipboard` wäre ein natives Modul — ein OTA, das es importiert, würde
 * auf jedem Build ohne das Modul beim Laden abstürzen. Kopieren bleibt im
 * „Mehr" (das System-Blatt hat es). Kommt mit dem nächsten nativen Build.
 *
 * Reihenfolge: erst das Blatt schließen, DANN das Ziel öffnen. Sonst legt sich
 * WhatsApp bzw. das System-Blatt über unser Modal, und beim Zurückkommen steht
 * unser Blatt noch da. `StageSheet.onDismiss` feuert auf beiden Plattformen
 * erst nach dem abgeschlossenen Schließen — dieselbe Bauweise wie
 * „Show-Aktionen" in `live/[id].tsx`.
 */

import { useRef } from 'react';
import { Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ellipsis, MessageCircle, MessageSquare, Send } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { PressFeedback } from './PressFeedback';
import { SheetHeader } from './SheetHeader';
import { StageSheet } from './StageSheet';
import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, stage, ui } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  link: string;
  text: string;
  /**
   * ⚠️ `stage` ist die dunkle Bühne des Live-Raums, `page` die helle Fläche
   * der übrigen App. Dieselbe Falle wie beim Kategorie-Blatt am 21.09.: Wer
   * `StageSheet` über eine helle Seite legt, bekommt ein Stück aus einer
   * fremden App. Die Bühne ist dunkel, weil dort ein Video läuft.
   */
  surface?: 'stage' | 'page';
  /** Überschrift des Blatts. */
  title?: string;
  /** Betreff im System-Blatt (E-Mail). */
  subject?: string;
};

type Target = {
  key: string;
  label: string;
  tint: string;
  ink: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  run: () => Promise<void> | void;
};

export function ShareSheet({
  visible,
  onClose,
  link,
  text,
  surface = 'stage',
  title = 'Teilen',
  subject = 'Berkat',
}: Props) {
  const pending = useRef<null | (() => Promise<void> | void)>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const dark = surface === 'stage';
  const full = `${text} ${link}`;

  // ⚠️ Auf iOS `url` UND `message` getrennt. Ein Link, der als Teil des
  // Fliesstextes kommt, wird vom System nicht als Link erkannt: Statt einer
  // Karte mit Bild steht dann ein graues „A" im Teilen-Blatt. Genau das hat
  // Zaur am 17.09. am Live-Teilen gemeldet.
  const systemShare = () =>
    Share.share(
      Platform.OS === 'ios' ? { url: link, message: text } : { message: full },
      { subject, dialogTitle: title },
    ).then(() => undefined, () => undefined);

  // Ein Ziel, das nicht aufgeht (App fehlt, Schema unbekannt), fällt auf das
  // System-Blatt zurück statt still nichts zu tun — dort ist die App dann
  // ohnehin gelistet, wenn es sie gibt.
  const open = async (url: string) => {
    try { await Linking.openURL(url); } catch { await systemShare(); }
  };

  const targets: Target[] = [
    { key: 'whatsapp', label: 'WhatsApp', tint: '#25D366', ink: '#FFFFFF', Icon: MessageCircle,
      run: () => open(`https://wa.me/?text=${encodeURIComponent(full)}`) },
    { key: 'telegram', label: 'Telegram', tint: '#2AABEE', ink: '#FFFFFF', Icon: Send,
      run: () => open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`) },
    { key: 'sms', label: 'Nachricht', tint: '#34C759', ink: '#FFFFFF', Icon: MessageSquare,
      run: () => open(Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(full)}` : `sms:?body=${encodeURIComponent(full)}`) },
    { key: 'more', label: 'Mehr', tint: dark ? stage.surfaceHigh : ui.sunken, ink: dark ? stage.text : ui.text, Icon: Ellipsis,
      run: systemShare },
  ];

  const choose = (run: Target['run']) => { pending.current = run; onClose(); };
  const afterClose = () => { const run = pending.current; pending.current = null; void run?.(); };

  const body = (
    <>
      <Text style={[s.preview, !dark && s.previewLight]} numberOfLines={2}>{text}</Text>
      <Text style={[s.link, !dark && s.linkLight]} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
      <View style={s.row}>
        {targets.map(({ key, label, tint, ink, Icon, run }) => (
          <PressFeedback key={key} style={s.target} onPress={() => choose(run)}
            accessibilityRole="button" accessibilityLabel={`Über ${label} teilen`}>
            <View style={[s.circle, { backgroundColor: tint }]}><Icon size={26} color={ink} /></View>
            <Text style={[s.label, !dark && s.labelLight]} numberOfLines={1}>{label}</Text>
          </PressFeedback>
        ))}
      </View>
    </>
  );

  if (dark) {
    return <StageSheet visible={visible} title={title} onClose={onClose} onDismiss={afterClose}>{body}</StageSheet>;
  }

  // Die helle Fassung — dieselbe Bauweise wie `CategorySheet`.
  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent
      onRequestClose={onClose} onDismiss={afterClose}>
      <View style={s.lightRoot}>
        <Pressable style={s.backdrop} onPress={onClose}
          accessibilityLabel="Blatt schließen" accessibilityRole="button" />
        <View style={[s.lightSheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title={title} onClose={onClose} />
          {body}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  preview: { fontSize: 15, lineHeight: 22, color: stage.text, fontWeight: '600' },
  link: { fontSize: 13, lineHeight: 18, color: stage.textMuted, marginTop: 2, marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  target: { alignItems: 'center', gap: 8, minWidth: 64 },
  circle: { width: 60, height: 60, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, color: stage.text },

  // ── Die helle Fassung ────────────────────────────────────────────────────
  previewLight: { color: ui.text },
  linkLight: { color: ui.textMuted },
  labelLight: { color: ui.text },
  lightRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  lightSheet: {
    overflow: 'hidden',
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    paddingHorizontal: space.md,
  },
});
