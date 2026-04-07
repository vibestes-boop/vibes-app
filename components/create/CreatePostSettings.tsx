/**
 * CreatePostSettings.tsx
 * Post-Einstellungen wie bei TikTok:
 * - Privatsphäre: Öffentlich / Freunde / Privat
 * - Toggles: Kommentare / Download / Duet
 */
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { Globe, Users, Lock } from 'lucide-react-native';

export type PostPrivacy = 'public' | 'friends' | 'private';

export interface PostSettingsState {
  privacy: PostPrivacy;
  allowComments: boolean;
  allowDownload: boolean;
  allowDuet: boolean;
}

interface Props {
  settings: PostSettingsState;
  onChange: (s: PostSettingsState) => void;
}

const PRIVACY_OPTIONS: { key: PostPrivacy; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    key: 'public',
    label: 'Öffentlich',
    sub: 'Jeder kann sehen',
    icon: <Globe size={16} color="#22D3EE" strokeWidth={1.8} />,
  },
  {
    key: 'friends',
    label: 'Freunde',
    sub: 'Nur Follower',
    icon: <Users size={16} color="#A855F7" strokeWidth={1.8} />,
  },
  {
    key: 'private',
    label: 'Privat',
    sub: 'Nur ich',
    icon: <Lock size={16} color="rgba(255,255,255,0.45)" strokeWidth={1.8} />,
  },
];

export function CreatePostSettings({ settings, onChange }: Props) {
  const set = (partial: Partial<PostSettingsState>) =>
    onChange({ ...settings, ...partial });

  return (
    <View style={s.root}>
      <Text style={s.sectionTitle}>Einstellungen</Text>

      {/* ── Privatsphäre ── */}
      <View style={s.privacyRow}>
        {PRIVACY_OPTIONS.map((opt) => {
          const active = settings.privacy === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.privacyBtn, active && s.privacyBtnActive]}
              onPress={() => set({ privacy: opt.key })}
            >
              {opt.icon}
              <Text style={[s.privacyLabel, active && s.privacyLabelActive]}>
                {opt.label}
              </Text>
              <Text style={s.privacySub}>{opt.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Toggles ── */}
      <View style={s.toggleSection}>
        <ToggleRow
          label="Kommentare erlauben"
          value={settings.allowComments}
          onValueChange={(v) => set({ allowComments: v })}
        />
        <View style={s.divider} />
        <ToggleRow
          label="Download erlauben"
          value={settings.allowDownload}
          onValueChange={(v) => set({ allowDownload: v })}
        />
        <View style={s.divider} />
        <ToggleRow
          label="Duet erlauben"
          value={settings.allowDuet}
          onValueChange={(v) => set({ allowDuet: v })}
        />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(34,211,238,0.5)' }}
        thumbColor={value ? '#22D3EE' : 'rgba(255,255,255,0.4)'}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginTop: 8,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },

  // Privacy
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  privacyBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  privacyBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  privacyLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
  },
  privacyLabelActive: {
    color: '#fff',
  },
  privacySub: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontWeight: '400',
  },

  // Toggles
  toggleSection: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 16,
  },
});
