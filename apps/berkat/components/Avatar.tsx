import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { stage, ui } from '../theme/tokens';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Goldener Ring — für den Gastgeber und den Höchstbietenden */
  ring?: boolean;
};

export function Avatar({ uri, name, size = 32, ring }: Props) {
  const inner = ring ? size - 4 : size;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2 : 0,
          borderColor: stage.gold,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: inner, height: inner, borderRadius: inner / 2 },
          ]}
        >
          <Text style={[styles.initials, { fontSize: Math.max(10, inner * 0.38) }]}>
            {(name ?? '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // ⚠️ War bis zum 23.08.2026 `stage.success`, also die Bestätigungsfarbe für
  // ein fehlendes Profilbild — Begründung am Token `ui.avatar`.
  fallback: { backgroundColor: ui.avatar, alignItems: 'center', justifyContent: 'center' },
  initials: { color: stage.text, fontWeight: '600' },
});
