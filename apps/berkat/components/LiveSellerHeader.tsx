import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { ChevronDown, Eye, Package, ShieldCheck } from 'lucide-react-native';
import type { useFollow } from '../lib/useFollow';
import { radius, space, stage } from '../theme/tokens';
import { Avatar } from './Avatar';
import { PressFeedback } from './PressFeedback';

type Props = {
  name?: string | null;
  avatarUrl?: string | null;
  vouch?: string | null;
  soldCount?: number | null;
  viewerCount: number;
  isHost: boolean;
  follow: ReturnType<typeof useFollow>;
  onSeller: () => void;
  onViewers: () => void;
  onMinimize: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Presentational only: the live room owns all requests and actions. */
export function LiveSellerHeader({ name, avatarUrl, vouch, soldCount, viewerCount, isHost, follow,
  onSeller, onViewers, onMinimize, onLayout }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const expanded = Math.min(width, measuredWidth ?? width) < 375 || fontScale > 1.4 || Boolean(follow.error) || follow.busy;
  const splitActions = expanded && !isHost;
  const controls = <>
    {follow.canFollow ? <PressFeedback onPress={() => void follow.toggle()} disabled={follow.busy}
      style={[s.follow, expanded && s.followExpanded, follow.isFollowing && s.followActive]}
      accessibilityRole="button" accessibilityState={{ disabled: follow.busy, busy: follow.busy, selected: follow.isFollowing }}
      accessibilityHint={follow.error ?? undefined}>
      <Text style={[s.followText, follow.isFollowing && s.followTextActive]}>{follow.label}</Text>
    </PressFeedback> : null}
    {isHost ? <PressFeedback style={s.viewers} onPress={onViewers} accessibilityRole="button"
      accessibilityLabel={`${viewerCount} schauen zu — Liste öffnen`}>
      <Eye size={14} color={stage.text} /><Text style={s.viewerText}>{viewerCount}</Text>
    </PressFeedback> : <View style={s.viewers} accessible accessibilityLabel={`${viewerCount} schauen zu`}>
      <Eye size={14} color={stage.text} /><Text style={s.viewerText}>{viewerCount}</Text>
    </View>}
  </>;
  return <View key={fontScale} style={s.wrap} pointerEvents="box-none" onLayout={event => {
    setMeasuredWidth(event.nativeEvent.layout.width);
    onLayout?.(event);
  }}>
    <View style={s.row} pointerEvents="box-none">
      <PressFeedback style={s.identity} onPress={onSeller} accessibilityRole="button"
        accessibilityLabel={`Mehr über ${name ?? 'den Verkäufer'}`}>
        <Avatar uri={avatarUrl} name={name} size={32} ring />
        <View style={s.copy}>
          <Text numberOfLines={expanded ? undefined : 1} style={s.name}>{name ?? '…'}</Text>
          <View style={s.trust}>
            {vouch ? <ShieldCheck size={12} color={stage.lead} /> : <Package size={12} color={stage.textMuted} />}
            <Text numberOfLines={expanded ? undefined : 1} style={[s.trustText, vouch ? s.vouch : null]}>
              {vouch || (soldCount != null ? `${soldCount} Zuschläge` : 'Neu hier')}
            </Text>
          </View>
        </View>
      </PressFeedback>
      {!splitActions ? controls : null}
      <PressFeedback onPress={onMinimize} style={s.close} accessibilityRole="button" accessibilityLabel="Show verkleinern">
        <ChevronDown size={18} color={stage.text} />
      </PressFeedback>
    </View>
    {splitActions ? <View style={s.actions} pointerEvents="box-none">{controls}</View> : null}
    {follow.error ? <Text style={s.error} accessibilityLiveRegion="polite">{follow.error}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  identity: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: stage.text },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trustText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: stage.textMuted },
  vouch: { color: stage.lead },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  follow: { minHeight: 44, justifyContent: 'center', backgroundColor: stage.text, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: space.sm },
  followExpanded: { flexShrink: 1 },
  followActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: stage.lineStrong },
  followText: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700', color: stage.ink },
  followTextActive: { color: stage.text },
  viewers: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: stage.control },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: stage.liveInk },
  viewerText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: stage.text },
  close: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: stage.control },
  error: { fontSize: 13, lineHeight: 19, color: stage.text, backgroundColor: stage.surface, padding: space.sm, borderRadius: radius.md },
});
