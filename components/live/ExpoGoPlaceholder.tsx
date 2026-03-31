import { View, Text, Pressable } from 'react-native';

interface Props {
  onBack: () => void;
  icon?: string;
  title?: string;
}

export default function ExpoGoPlaceholder({ 
  onBack, 
  icon = '📺', 
  title = 'Live Studio läuft nicht in Expo Go.\nBitte einen Dev-Build verwenden.' 
}: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontSize: 48 }}>{icon}</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        Dev-Build erforderlich
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
        {title}
      </Text>
      <Pressable 
        onPress={onBack} 
        style={{ marginTop: 8, backgroundColor: '#0891B2', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Zurück</Text>
      </Pressable>
    </View>
  );
}
