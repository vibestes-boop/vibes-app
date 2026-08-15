// Bürgen — wer für diesen Verkäufer geradesteht.
//
// Die drei Kacheln darüber sind Institution: Sterne, Versandzeit, Zuschläge.
// Das hier ist das Gegenteil — Menschen mit Namen. Laut Analyse ist genau das
// der Unterschied, der in dieser Community zählt: „Ein 5-Sterne-Durchschnitt
// bedeutet weniger als ‚mein Cousin kennt ihn.'"
//
// Deshalb steht bewusst NIRGENDS eine große Zahl. Die Reihenfolge ist die
// Aussage: erst die, denen der Betrachter selbst folgt.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { VOUCH_NOTE_MAX, type Vouch } from '../lib/useVouch';
import { Avatar } from './Avatar';

type Props = {
  vouches: Vouch[];
  /** Bin ich selbst der Verkäufer? Dann gibt es hier nichts zu tun. */
  isSelf: boolean;
  myUserId: string | null;
  busy: boolean;
  onVouch: (note: string | null) => void;
  onUnvouch: () => void;
  onOpenProfile: (userId: string) => void;
};

/** „12 Käufe · 3 Zuschläge" — oder nichts, wenn dieser Mensch neu ist. */
function weightLabel(vouch: Vouch): string | null {
  if (vouch.purchases == null || vouch.sales == null) return null;
  const parts: string[] = [];
  if (vouch.purchases > 0) parts.push(`${vouch.purchases} ${vouch.purchases === 1 ? 'Kauf' : 'Käufe'}`);
  if (vouch.sales > 0) parts.push(`${vouch.sales} ${vouch.sales === 1 ? 'Zuschlag' : 'Zuschläge'}`);
  // Ausdrücklich benannt statt weggelassen: Ein Bürge ohne Handel ist eine
  // Information, keine Lücke. Der Leser soll ihn gewichten können.
  return parts.length > 0 ? parts.join(' · ') : 'Neu hier';
}

export function VouchPanel({
  vouches,
  isSelf,
  myUserId,
  busy,
  onVouch,
  onUnvouch,
  onOpenProfile,
}: Props) {
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');

  const mine = myUserId ? vouches.find((v) => v.voucher_id === myUserId) : undefined;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShieldCheck size={16} color={ui.text} />
        <Text style={s.title}>Wer für ihn bürgt</Text>
      </View>

      {vouches.length === 0 ? (
        <Text style={s.empty}>
          {isSelf
            ? 'Noch bürgt niemand für dich. Frag jemanden, der dich kennt — das wiegt hier mehr als jede Bewertung.'
            : 'Noch bürgt niemand. Wenn du ihn kennst, kannst du der Erste sein.'}
        </Text>
      ) : (
        vouches.map((vouch) => (
          <Pressable
            key={vouch.id}
            style={s.row}
            onPress={() => onOpenProfile(vouch.voucher_id)}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${vouch.username ?? 'Bürge'}`}
          >
            <Avatar uri={vouch.avatar_url} name={vouch.username} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.nameRow}>
                <Text numberOfLines={1} style={s.name}>
                  {vouch.username ?? 'Jemand'}
                </Text>
                {/* Das eigentliche Signal — nicht die Anzahl, sondern die Nähe. */}
                {vouch.youFollow ? (
                  <View style={s.knownPill}>
                    <Text style={s.knownText}>du folgst</Text>
                  </View>
                ) : null}
              </View>
              {weightLabel(vouch) ? (
                <Text style={s.weight}>{weightLabel(vouch)}</Text>
              ) : null}
              {vouch.note ? (
                <Text numberOfLines={3} style={s.note}>
                  „{vouch.note}"
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}

      {isSelf || !myUserId ? null : mine ? (
        <Pressable
          style={s.secondary}
          disabled={busy}
          onPress={onUnvouch}
          accessibilityRole="button"
        >
          <Text style={s.secondaryText}>Bürgschaft zurückziehen</Text>
        </Pressable>
      ) : writing ? (
        <View style={s.writeBox}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Woher kennst du ihn? (freiwillig)"
            placeholderTextColor={ui.textMuted}
            style={s.input}
            maxLength={VOUCH_NOTE_MAX}
            multiline
          />
          <View style={s.writeRow}>
            <Pressable
              style={s.secondary}
              onPress={() => {
                setWriting(false);
                setNote('');
              }}
            >
              <Text style={s.secondaryText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              style={[s.primary, busy && s.primaryBusy]}
              disabled={busy}
              onPress={() => {
                // Ein Satz unter drei Zeichen lehnt der Server ab — dann lieber
                // gar keiner als eine Fehlermeldung für ein freiwilliges Feld.
                const trimmed = note.trim();
                onVouch(trimmed.length >= 3 ? trimmed : null);
                setWriting(false);
                setNote('');
              }}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>Ich bürge</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={s.primary}
          disabled={busy}
          onPress={() => setWriting(true)}
          accessibilityRole="button"
          accessibilityLabel="Für diesen Verkäufer bürgen"
        >
          <ShieldCheck size={16} color={ui.goldInk} />
          <Text style={s.primaryText}>Ich bürge für ihn</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginTop: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 15, fontWeight: '700', color: ui.text },
  empty: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: ui.text },
  knownPill: {
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  knownText: { fontSize: 10, fontWeight: '700', color: ui.brand },
  weight: { fontSize: 11, color: ui.textMuted, marginTop: 1 },
  note: { fontSize: 13, color: ui.text, marginTop: 3, lineHeight: 18 },

  writeBox: { gap: space.sm },
  input: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 14,
    color: ui.text,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  writeRow: { flexDirection: 'row', gap: space.sm },

  primary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: space.xs,
  },
  primaryBusy: { opacity: 0.6 },
  primaryText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },

  secondary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  secondaryText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});
