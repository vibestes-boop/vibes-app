// Einen Artikel dauerhaft anbieten — unabhängig von einer Show.
//
// Steht bewusst im Verkaufen-Reiter und NICHT im Studio einer laufenden
// Sendung: Der Sinn eines Dauerangebots ist ja gerade, dass es ohne Sendung
// existiert. Wer es nur während einer Show anlegen könnte, hätte den Zweck
// verfehlt.
//
// Kein Bild-Zwang. Ein Verkäufer, der abends schnell drei Sachen einstellt,
// bricht sonst nach dem ersten ab — und ein Angebot ohne Foto ist immer noch
// besser als keines.

import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { euroToCents } from '../lib/useStudio';

type Props = {
  busy: boolean;
  /** Nur geprüfte Frauen dürfen Frauen-Only setzen — der Server prüft es nochmal. */
  canWomenOnly: boolean;
  onCreate: (input: { title: string; priceCents: number; womenOnly: boolean }) => void;
};

export function StandingComposer({ busy, canWomenOnly, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);

  const cents = price.trim() ? euroToCents(price) : null;
  // Der Server lehnt alles bis 1 € ab. Das vorher zu sagen ist freundlicher,
  // als es sich als Fehlermeldung abzuholen.
  const priceOk = cents !== null && cents > 100;
  const canCreate = title.trim().length >= 2 && priceOk && !busy;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <ShoppingBag size={18} color={ui.text} />
        <Text style={s.title}>Dauerhaft anbieten</Text>
      </View>
      <Text style={s.body}>
        Bleibt auf deinem Profil kaufbar, auch wenn du nicht sendest. Zwischen zwei Shows ist
        das alles, was jemand bei dir tun kann.
      </Text>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Silberring, handgemacht"
        placeholderTextColor={ui.textMuted}
        style={s.input}
        maxLength={140}
      />

      <View style={s.row}>
        <TextInput
          value={price}
          onChangeText={setPrice}
          placeholder="Preis in €"
          placeholderTextColor={ui.textMuted}
          keyboardType="decimal-pad"
          style={[s.input, { flex: 1, marginTop: 0 }]}
        />
        {canWomenOnly ? (
          <View style={s.switchWrap}>
            <Text style={s.switchLabel}>Frauen-Only</Text>
            <Switch value={womenOnly} onValueChange={setWomenOnly} />
          </View>
        ) : null}
      </View>

      {price.trim() && !priceOk ? (
        <Text style={s.warn}>Über 1 € — darunter lohnt sich der Versand für niemanden.</Text>
      ) : null}

      <Pressable
        style={[s.primary, !canCreate && s.primaryOff]}
        disabled={!canCreate}
        onPress={() => {
          onCreate({ title, priceCents: cents!, womenOnly });
          setTitle('');
          setPrice('');
          setWomenOnly(false);
        }}
        accessibilityRole="button"
        accessibilityLabel="Artikel dauerhaft anbieten"
      >
        <Text style={s.primaryText}>Ins Regal legen</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: ui.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  body: { fontSize: 13, color: ui.textMuted, marginTop: space.xs, lineHeight: 19 },

  input: {
    marginTop: space.md,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  switchWrap: { alignItems: 'center', gap: 2 },
  switchLabel: { fontSize: 11, color: ui.textMuted },

  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

  primary: {
    marginTop: space.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
