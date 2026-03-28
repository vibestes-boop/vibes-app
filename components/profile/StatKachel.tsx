import { type ElementType } from 'react';
import { View, Text } from 'react-native';
import { profileStyles as s } from './profileStyles';

export function StatKachel({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: ElementType;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <View style={s.kachel}>
      <View style={[s.kachelIcon, { backgroundColor: accent + '18' }]}>
        <Icon size={14} color={accent} strokeWidth={2} />
      </View>
      <Text style={s.kachelValue}>{value}</Text>
      <Text style={s.kachelLabel}>{label}</Text>
    </View>
  );
}
