import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Lock } from 'lucide-react-native';
import type { LiveShow } from '../lib/useLiveShows';
import { formatEuro, type ShowPreview } from '../lib/useAuction';
import { useReducedMotion } from '../lib/useReducedMotion';
import { Avatar } from './Avatar';
import { BerkatMark } from './BerkatMark';
import { LivePreview } from './LivePreview';
import { PressFeedback } from './PressFeedback';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  show: LiveShow;
  host?: { username?: string | null; avatarUrl?: string | null };
  featured?: boolean;
  categoryName?: string;
  reason?: string;
  preview?: ShowPreview;
  secondsLeft: number | null;
  onOpen: () => void;
  onCategory: () => void;
};

/** One show fills the row; multiple shows share the same information in a grid. */
export function HomeLiveCard({ show, host, featured = false, categoryName, reason, preview, secondsLeft, onOpen, onCategory }: Props) {
  const { fontScale } = useWindowDimensions();
  const name = host?.username?.trim() || 'Verkäufer';
  const title = show.title?.trim() || `Live mit ${name}`;
  const viewers = show.viewer_count != null && show.viewer_count > 0 ? show.viewer_count : null;
  const auctionLabel = preview ? `, ${preview.title}, ${preview.status === 'sold' ? 'verkauft für' : preview.status === 'scheduled' ? 'Startpreis' : 'aktueller Preis'} ${formatEuro(preview.priceCents)}` : '';
  const status = <View key={`status:${fontScale}`} style={s.badges}>
    <View style={s.live}><View style={s.dot} /><Text style={s.liveText}>{viewers ? `Live · ${viewers}` : 'Live'}</Text></View>
    {show.women_only ? <View style={s.restricted}><Lock size={11} color={ui.successInk} /><Text style={s.restrictedText}>Frauen-Only</Text></View> : null}
  </View>;

  return <View style={s.root}>
    <PressFeedback kind="card" onPress={onOpen} style={s.card}
      accessibilityRole="button"
      accessibilityLabel={`${title}, live mit ${name}${viewers ? `, ${viewers} Zuschauer` : ''}${show.women_only ? ', Frauen-Only' : ''}${reason ? `, ${reason}` : ''}${auctionLabel}`}
      accessibilityHint="Öffnet die Live-Show.">
      <View style={featured && s.featuredRow}>
        <View style={[s.art, featured ? [s.featuredArt, fontScale > 1.5 && s.largeArt] : s.gridArt]}>
          <ShowArtwork key={`${show.id}:${show.thumbnail_url ?? ''}`} uri={show.thumbnail_url} name={name} avatarUrl={host?.avatarUrl} />
          {!featured ? <View style={s.imageBadges}>{status}</View> : null}
        </View>
        <View key={`copy:${fontScale}`} style={[s.copy, featured && s.featuredCopy]}>
          {featured ? status : null}
          <Text numberOfLines={2} style={[s.title, featured && s.featuredTitle]}>{title}</Text>
          <Text numberOfLines={1} style={s.host}>{name}</Text>
          {reason ? <Text numberOfLines={2} style={s.reason}>{reason}</Text> : null}
          {featured ? <View style={s.open}><Text style={s.openText}>Show ansehen</Text><ArrowUpRight size={16} color={ui.brand} /></View> : null}
        </View>
      </View>
      {preview ? <LivePreview preview={preview} secondsLeft={secondsLeft} inline /> : null}
    </PressFeedback>
    {categoryName ? <PressFeedback onPress={onCategory} style={s.category} accessibilityRole="button"
      accessibilityLabel={`Nur ${categoryName} zeigen`}>
      <Text key={`category:${fontScale}`} style={s.categoryText}>{categoryName}</Text><ArrowUpRight size={13} color={ui.textMuted} />
    </PressFeedback> : null}
  </View>;
}

/** Keyed by source: a late failed image cannot hide the next show's cover. */
function ShowArtwork({ uri, name, avatarUrl }: { uri: string | null; name: string; avatarUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const reducedMotion = useReducedMotion();
  return <View style={StyleSheet.absoluteFill} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <LinearGradient colors={[ui.brand, ui.avatar]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fallback}>
      {!loaded || failed ? <>
        <View style={s.orbit} />
        <View style={s.portrait}>{avatarUrl ? <Avatar uri={avatarUrl} name={name} size={56} /> : <View style={s.brandPortrait}><BerkatMark size={32} color={ui.card} /></View>}</View>
        <View style={s.mark}><BerkatMark size={18} color={ui.card} /></View>
      </> : null}
    </LinearGradient>
    {uri && !failed ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover"
      enforceEarlyResizing recyclingKey={uri} transition={reducedMotion ? 0 : 140}
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, minWidth: 0, marginBottom: space.lg },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, overflow: 'hidden' },
  featuredRow: { flexDirection: 'row', alignItems: 'stretch' },
  art: { backgroundColor: ui.brand, overflow: 'hidden' },
  featuredArt: { width: 112, minHeight: 144 },
  largeArt: { width: 88 },
  gridArt: { aspectRatio: 1 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: ui.card, opacity: 0.1, transform: [{ translateX: 24 }] },
  portrait: { padding: 3, borderWidth: 1, borderColor: ui.card, borderRadius: radius.pill },
  brandPortrait: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', bottom: space.md, right: space.md, opacity: 0.65 },
  copy: { padding: space.md, gap: space.xs },
  featuredCopy: { flex: 1, minWidth: 0, padding: space.lg, gap: 6 },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: ui.text },
  featuredTitle: { fontSize: 17, lineHeight: 23 },
  host: { fontSize: 12, lineHeight: 17, color: ui.textMuted },
  reason: { fontSize: 11, lineHeight: 16, color: ui.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'flex-start' },
  imageBadges: { position: 'absolute', top: space.sm, left: space.sm, right: space.sm },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: ui.live },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ui.liveInk },
  liveText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: ui.liveInk, flexShrink: 1 },
  restricted: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: ui.success, maxWidth: '100%' },
  restrictedText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: ui.successInk, flexShrink: 1 },
  open: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  openText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.brand, flexShrink: 1 },
  category: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  categoryText: { fontSize: 12, lineHeight: 17, color: ui.textMuted, flexShrink: 1 },
});
