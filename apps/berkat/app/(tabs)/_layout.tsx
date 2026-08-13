// Drei Reiter, und jeder tut etwas.
//
// Whatnot hat fünf (Startseite, Kategorien, Verkaufen, Aktivität, Konto).
// Kategorien und Aktivität kommen, sobald sie Inhalt haben — ein Reiter, der
// auf eine leere Seite führt, sieht billiger aus als einer, der fehlt.

import { Tabs } from 'expo-router';
import { CircleUser, House, Radio } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { ui, space } from '../../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ui.brand,
        tabBarInactiveTintColor: ui.textMuted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: ui.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Startseite',
          tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Verkaufen',
          tabBarIcon: ({ color, size }) => <Radio size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Konto',
          tabBarIcon: ({ color, size }) => <CircleUser size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: ui.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    paddingTop: space.xs,
  },
  label: { fontSize: 11, fontWeight: '600' },
});
