// Fünf Reiter, wie bei Whatnot — und jeder tut etwas.
//
// Bis zum 16.08.2026 waren es drei. Kategorien und Aktivität fehlten mit der
// Begründung „ein Reiter, der auf eine leere Seite führt, sieht billiger aus
// als einer, der fehlt". Das stimmte, solange beide wirklich leer gewesen
// wären. Inzwischen haben beide Inhalt:
//
//   • Kategorien lebt von den Dauerangeboten (HANDOFF 17). Sie liegen rund um
//     die Uhr da, während eine Show 94 % der Zeit nicht läuft — der Reiter ist
//     also gerade dann voll, wenn die Startseite leer ist.
//   • Aktivität lebt von Folgen, eigenen Geboten und den Belohnungen. Nichts
//     davon erzeugt einen Push, alles davon will man wiederfinden.
//
// Die Reihenfolge ist Whatnots und nicht willkürlich: außen die beiden Orte,
// die einem gehören (Start, Konto), in der Mitte das Verkaufen als der Knopf,
// der am schwersten zu finden sein darf.

import { Tabs } from 'expo-router';
import { Activity, CircleUser, House, LayoutGrid, Radio } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSession } from '../../lib/session';
import { useOpenOrderCount } from '../../lib/useSellerOrders';
import { ui, space } from '../../theme/tokens';

export default function TabsLayout() {
  // Das eigene Profilbild für den Konto-Reiter.
  const avatarUrl = useSession((s) => s.profile?.avatar_url) ?? null;
  // Winzige Zählabfrage mit `head: true` — es wird keine einzige Zeile
  // übertragen. Sie hängt hier, weil das Layout immer gemountet ist.
  const myUserId = useSession((s) => s.userId);
  const { data: openOrders = 0 } = useOpenOrderCount(myUserId);

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
        name="categories"
        options={{
          title: 'Kategorien',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Verkaufen',
          tabBarIcon: ({ color, size }) => <Radio size={size} color={color} />,
          // Das einzige Abzeichen in der unteren Leiste, und es hat einen
          // Grund: `status = 'paid'` heißt „Geld da, Paket nicht". Die
          // durchschnittliche Versandzeit ist eine der drei Kacheln auf dem
          // öffentlichen Profil — wer es nicht merkt, zahlt dort in Vertrauen.
          //
          // Ein Abzeichen, das nie auf null geht, liest bald niemand mehr:
          // `shipped` und `delivered` zählen deshalb nicht mit.
          tabBarBadge: openOrders > 0 ? openOrders : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Aktivität',
          tabBarIcon: ({ color, size }) => <Activity size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Konto',
          // ⚠️ Das eigene Gesicht statt eines Symbols (seit 19.08.2026).
          // Es ist der einzige Reiter, der von MIR handelt — Whatnot zeigt dort
          // ebenfalls den eigenen Avatar (fünfte Analyse). Ohne Bild bleibt das
          // Symbol: Ein leerer Kreis mit Initiale wäre an dieser Größe nicht
          // lesbar, und wer kein Foto hat, soll nicht dauerhaft daran erinnert
          // werden.
          //
          // `useSession` statt eines eigenen Abrufs: Das Profil liegt beim
          // Anmelden ohnehin im Speicher, und dieses Layout ist immer gemountet.
          tabBarIcon: ({ color, size, focused }) =>
            avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={[
                  styles.tabAvatar,
                  { width: size, height: size, borderRadius: size / 2 },
                  // Nur im aktiven Zustand ein Ring — sonst sähe das Bild aus
                  // wie ein Fremdkörper zwischen fünf Konturlinien.
                  focused && { borderWidth: 2, borderColor: color },
                ]}
                contentFit="cover"
              />
            ) : (
              <CircleUser size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabAvatar: { backgroundColor: ui.sunken },
  bar: {
    backgroundColor: ui.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    paddingTop: space.xs,
  },
  // Bei fünf Reitern wird es eng — „Kategorien" ist das längste Wort und
  // bricht auf schmalen Geräten sonst um. Ein Punkt kleiner als vorher.
  label: { fontSize: 10, fontWeight: '600' },
  // Gold statt des roten Standards: Rot ist in Berkat die laufende Uhr
  // (live, überboten). Eine wartende Bestellung ist dringend, aber nicht
  // dieselbe Art von dringend.
  badge: { backgroundColor: ui.gold, color: ui.goldInk, fontSize: 10, fontWeight: '800' },
});
