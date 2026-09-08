import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { galleryIndex, galleryPage } from '../lib/gallerySelection';
import { radius, space, ui } from '../theme/tokens';
import { BerkatMark } from './BerkatMark';
import { ProductPhoto } from './ProductPhoto';
import { PressFeedback } from './PressFeedback';
import { useReducedMotion } from '../lib/useReducedMotion';

export function ListingGallery({ images, womenOnly, active = true }: {
  images: string[]; womenOnly: boolean; active?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const width = Math.max(1, screenWidth - space.lg * 2);
  const scroll = useRef<ScrollView>(null);
  const [selected, setSelected] = useState<{ uri: string; index: number } | null>(null);
  const index = galleryIndex(images, selected);
  const imageKey = JSON.stringify(images);
  useEffect(() => {
    // Width changes and refreshed image lists reposition the same selection.
    scroll.current?.scrollTo({ x: index * width, animated: false });
  }, [width, imageKey]);
  useEffect(() => {
    const uri = images[index];
    if (uri && (selected?.uri !== uri || selected.index !== index)) setSelected({ uri, index });
    else if (!uri && selected) setSelected(null);
  }, [imageKey, index, selected]);

  function choose(next: number) {
    const target = galleryPage(next * width, width, images.length);
    if (!images[target]) return;
    setSelected({ uri: images[target], index: target });
    scroll.current?.scrollTo({ x: target * width, animated: !reducedMotion });
  }

  function trackPage(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = galleryPage(event.nativeEvent.contentOffset.x, event.nativeEvent.layoutMeasurement.width, images.length);
    const uri = images[page];
    if (uri) setSelected(previous => previous?.uri === uri && previous.index === page ? previous : { uri, index: page });
  }

  return <View style={s.hero}>
    {images.length ? <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      scrollEventThrottle={64} onScroll={trackPage} onMomentumScrollEnd={trackPage}>
      {images.map((uri, page) => <View key={uri} style={{ width, height: width }}
        accessibilityElementsHidden={page !== index} importantForAccessibility={page === index ? 'auto' : 'no-hide-descendants'}>
        {/* Only the current photo and its immediate neighbors own native image views. */}
        {page === index || (active && Math.abs(page - index) === 1) ? <ProductPhoto uri={uri} retry
          priority={page === index ? 'high' : 'low'} style={StyleSheet.absoluteFill} contentFit="contain"
          accessibilityLabel={`Produktfoto ${page + 1} von ${images.length}`} /> : null}
      </View>)}
    </ScrollView> : <View key={fontScale} style={s.empty}>
      <BerkatMark size={44} color={ui.lineStrong} /><Text style={s.hint}>Noch kein Produktfoto</Text>
    </View>}
    {womenOnly ? <View key={`lock-${fontScale}`} style={s.lock}>
      <Lock size={12} color={ui.successInk} /><Text style={s.lockText}>Frauen-Only</Text>
    </View> : null}
    {images.length > 1 ? <View key={`controls-${fontScale}`} style={s.controls}>
      <PressFeedback accessibilityRole="button" accessibilityLabel="Vorheriges Produktfoto" disabled={index <= 0}
        accessibilityState={{ disabled: index <= 0 }} style={[s.arrow, index <= 0 && s.disabled]} onPress={() => choose(index - 1)}>
        <ChevronLeft size={20} color={ui.overlayMuted} />
      </PressFeedback>
      <Text style={s.count}>{index + 1} / {images.length}</Text>
      <PressFeedback accessibilityRole="button" accessibilityLabel="Nächstes Produktfoto" disabled={index >= images.length - 1}
        accessibilityState={{ disabled: index >= images.length - 1 }} style={[s.arrow, index >= images.length - 1 && s.disabled]} onPress={() => choose(index + 1)}>
        <ChevronRight size={20} color={ui.overlayMuted} />
      </PressFeedback>
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  hero: { marginHorizontal: space.lg, aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: ui.sunken },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: space.md },
  hint: { fontSize: 13, color: ui.textMuted, textAlign: 'center' },
  controls: { position: 'absolute', bottom: space.sm, right: space.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: ui.overlay, borderRadius: radius.pill },
  arrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, fontWeight: '600', color: ui.overlayMuted },
  disabled: { opacity: 0.4 },
  lock: { position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: ui.success },
  lockText: { fontSize: 11, fontWeight: '700', color: ui.successInk },
});
