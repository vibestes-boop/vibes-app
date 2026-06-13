import { RotateCcw, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export const DRAW_COLORS = ['#FFFFFF','#000000','#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#007AFF','#AF52DE','#FF2D55'];
export const DRAW_SIZES  = [3, 6, 12, 20];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _svg: any = (() => { try { return require('react-native-svg'); } catch { return {}; } })();
export const Svg     = (_svg?.default?.default ?? _svg?.default ?? _svg)?.Svg  as any;
export const SvgPath = (_svg?.default?.default ?? _svg?.default ?? _svg)?.Path as any;

export function pointsToSvgPath(points: number[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  return d;
}

export type DrawnPath = { points: number[]; color: string; width: number };

export function DrawCanvas({ paths, activeColor, activeWidth, onAddPath }: {
  paths: DrawnPath[];
  activeColor: string;
  activeWidth: number;
  onAddPath: (p: DrawnPath) => void;
}) {
  const [livePoints, setLivePoints] = useState<number[]>([]);
  const livePointsRef = useRef<number[]>([]);

  const activeColorRef = useRef(activeColor);
  const activeWidthRef = useRef(activeWidth);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { activeWidthRef.current = activeWidth; }, [activeWidth]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      livePointsRef.current = [locationX, locationY];
      setLivePoints([locationX, locationY]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      livePointsRef.current = [...livePointsRef.current, locationX, locationY];
      setLivePoints([...livePointsRef.current]);
    },
    onPanResponderRelease: () => {
      if (livePointsRef.current.length >= 2) {
        onAddPath({ points: [...livePointsRef.current], color: activeColorRef.current, width: activeWidthRef.current });
      }
      livePointsRef.current = [];
      setLivePoints([]);
    },
    onPanResponderTerminate: () => {
      livePointsRef.current = [];
      setLivePoints([]);
    },
  })).current;

  const livePath = livePoints.length >= 2 ? pointsToSvgPath(livePoints) : null;

  return (
    <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
      {Svg && SvgPath ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((dp, i) => (
            <SvgPath
              key={i}
              d={pointsToSvgPath(dp.points)}
              stroke={dp.color}
              strokeWidth={dp.width}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {livePath && (
            <SvgPath
              d={livePath}
              stroke={activeColor}
              strokeWidth={activeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>
      ) : null}
    </View>
  );
}

export function DrawToolbar({ activeColor, onColor, activeWidth, onWidth, onUndo, onClose, bottomOffset }: {
  activeColor: string; onColor: (c: string) => void;
  activeWidth: number; onWidth: (w: number) => void;
  onUndo: () => void; onClose: () => void;
  bottomOffset: number;
}) {
  const { top } = useSafeAreaInsets();
  return (
    <>
      <View style={[dw.topBar, { top: top + 6 }]}>
        <Pressable onPress={onClose} style={dw.circleBtn} hitSlop={8}>
          <X size={16} color="#fff" strokeWidth={2.5} />
        </Pressable>
        <View style={dw.sizeRow}>
          {DRAW_SIZES.map(sz => {
            const isActive = activeWidth === sz;
            const dotSize = 6 + sz * 1.4;
            return (
              <Pressable key={sz} onPress={() => onWidth(sz)} style={dw.sizeHit}>
                <View style={{
                  width: dotSize, height: dotSize, borderRadius: dotSize / 2,
                  backgroundColor: isActive ? activeColor : 'rgba(255,255,255,0.3)',
                  borderWidth: isActive ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.5)',
                  shadowColor: isActive ? activeColor : 'transparent',
                  shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
                }} />
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onUndo} style={dw.circleBtn} hitSlop={8}>
          <RotateCcw size={16} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={[dw.colorBar, { bottom: bottomOffset }]}>
        <View style={[dw.activeColorPreview, { backgroundColor: activeColor }]}>
          <View style={dw.activeColorInner} />
        </View>
        <View style={dw.colorBarDivider} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={dw.colorRow}
          style={{ flex: 1 }}
        >
          {DRAW_COLORS.map(c => {
            const isActive = activeColor === c;
            return (
              <Pressable key={c} onPress={() => onColor(c)} style={dw.colorHit}>
                <View style={[
                  dw.colorDot,
                  { backgroundColor: c },
                  isActive && dw.colorDotActive,
                ]}>
                  {isActive && <View style={dw.colorDotCheck} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const dw = StyleSheet.create({
  topBar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 50,
    paddingHorizontal: 8, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sizeHit: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  colorBar: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
  },
  activeColorPreview: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    marginRight: 4,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  activeColorInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  colorBarDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 12 },
  colorRow: { gap: 10, alignItems: 'center' },
  colorHit: { padding: 4 },
  colorDot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  colorDotActive: {
    borderWidth: 3, borderColor: '#fff',
    transform: [{ scale: 1.18 }],
  },
  colorDotCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)' },
});

