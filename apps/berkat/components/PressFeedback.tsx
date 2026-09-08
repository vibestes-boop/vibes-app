import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useReducedMotion } from '../lib/useReducedMotion';
import { motion } from '../theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Same native press target and layout; transforms never resize list rows. */
export function PressFeedback({ style, disabled, onPressIn, onPressOut, onHoverIn, onHoverOut, kind = 'control', ...props }:
  PressableProps & { kind?: 'card' | 'control' }) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const wasDown = useRef(false);
  const down = pressed && !disabled;
  useEffect(() => {
    const changed = wasDown.current !== down;
    wasDown.current = down;
    progress.stopAnimation();
    if (!changed || disabled || reduced) {
      progress.setValue(down ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: down ? 1 : 0,
      duration: down ? motion.pressInMs : motion.pressOutMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [down, disabled, reduced, progress]);
  useEffect(() => { if (disabled) setPressed(false); }, [disabled]);

  const base = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: down, hovered }) : style);
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, motion.pressedOpacity] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, kind === 'card' ? motion.cardScale : motion.controlScale] });
  return <AnimatedPressable {...props} disabled={disabled}
    onPressIn={event => { if (!disabled) { setPressed(true); onPressIn?.(event); } }}
    onPressOut={event => { setPressed(false); onPressOut?.(event); }}
    onHoverIn={event => { setHovered(true); onHoverIn?.(event); }}
    onHoverOut={event => { setHovered(false); onHoverOut?.(event); }}
    style={[base, {
      opacity: Animated.multiply(base?.opacity ?? 1, opacity),
      transform: [...(Array.isArray(base?.transform) ? base.transform : []), { scale: reduced || disabled ? 1 : scale }],
    }]} />;
}
