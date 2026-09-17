/**
 * Show teilen — Berkats eigenes Blatt statt des iOS-System-Fensters.
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
import { Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { Ellipsis, MessageCircle, MessageSquare, Send } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { PressFeedback } from './PressFeedback';
import { StageSheet } from './StageSheet';
import { radius, space, stage } from '../theme/tokens';

type Props = { visible: boolean; onClose: () => void; link: string; text: string };

type Target = {
  key: string;
  label: string;
  tint: string;
  ink: string;
  Icon: ComponentType<{ size?: number; color?: string }>;
  run: () => Promise<void> | void;
};

export function LiveShareSheet({ visible, onClose, link, text }: Props) {
  const pending = useRef<null | (() => Promise<void> | void)>(null);
  const full = `${text} ${link}`;

  const systemShare = () =>
    Share.share(
      Platform.OS === 'ios' ? { url: link, message: text } : { message: full },
      { subject: 'Live bei Berkat', dialogTitle: 'Show teilen' },
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
    { key: 'more', label: 'Mehr', tint: stage.surfaceHigh, ink: stage.text, Icon: Ellipsis,
      run: systemShare },
  ];

  const choose = (run: Target['run']) => { pending.current = run; onClose(); };
  const afterClose = () => { const run = pending.current; pending.current = null; void run?.(); };

  return <StageSheet visible={visible} title="Show teilen" onClose={onClose} onDismiss={afterClose}>
    <Text style={s.preview} numberOfLines={2}>{text}</Text>
    <Text style={s.link} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
    <View style={s.row}>
      {targets.map(({ key, label, tint, ink, Icon, run }) => (
        <PressFeedback key={key} style={s.target} onPress={() => choose(run)}
          accessibilityRole="button" accessibilityLabel={`Über ${label} teilen`}>
          <View style={[s.circle, { backgroundColor: tint }]}><Icon size={26} color={ink} /></View>
          <Text style={s.label} numberOfLines={1}>{label}</Text>
        </PressFeedback>
      ))}
    </View>
  </StageSheet>;
}

const s = StyleSheet.create({
  preview: { fontSize: 15, lineHeight: 22, color: stage.text, fontWeight: '600' },
  link: { fontSize: 13, lineHeight: 18, color: stage.textMuted, marginTop: 2, marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  target: { alignItems: 'center', gap: 8, minWidth: 64 },
  circle: { width: 60, height: 60, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, color: stage.text },
});
