import { useI18n } from '@/lib/i18n';
/**
 * CreatePostSettings.tsx
 * Post-Einstellungen wie bei Short-Video:
 * - Privatsphäre: Öffentlich / Freunde / Privat
 * - Toggles: Kommentare / Download / Duet
 */
import { Globe,Lock,Users } from 'lucide-react-native';
import { Pressable,StyleSheet,Switch,Text,View } from 'react-native';

export type PostPrivacy = 'public' | 'friends' | 'private';

export interface PostSettingsState {
  privacy: PostPrivacy;
  allowComments: boolean;
  allowDownload: boolean;
  allowDuet: boolean;
  womenOnly: boolean;  // Women-Only Zone (opt-in)
}

interface Props {
  settings: PostSettingsState;
  onChange: (s: PostSettingsState) => void;
  showWomenOnly?: boolean;  // nur anzeigen wenn Nutzerin verifiziert ist
}

const PRIVACY_OPTIONS: { key: PostPrivacy; labelKey: string; subKey: string; icon: React.ReactNode }[] = [
  {
    key: 'public',
    labelKey: 'create.public',
    subKey: 'create.everyoneCanSee',
    icon: <Globe size={16} color="#FFFFFF" strokeWidth={1.8} />,
  },
  {
    key: 'friends',
    labelKey: 'create.friends',
    subKey: 'create.followersOnly',
    icon: <Users size={16} color="#A855F7" strokeWidth={1.8} />,
  },
  {
    key: 'private',
    labelKey: 'create.private',
    subKey: 'create.onlyMe',
    icon: <Lock size={16} color="rgba(255,255,255,0.45)" strokeWidth={1.8} />,
  },
];

export function CreatePostSettings({ settings, onChange, showWomenOnly }: Props) {
  const { t: tr } = useI18n();
  const set = (partial: Partial<PostSettingsState>) =>
    onChange({ ...settings, ...partial });

  return (
    <View style={s.root}>
      <Text style={s.sectionTitle}>{tr('create.settings')}</Text>

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
                {tr(opt.labelKey as any)}
              </Text>
              <Text style={s.privacySub}>{tr(opt.subKey as any)}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Toggles ── */}
      <View style={s.toggleSection}>
        <ToggleRow
          label={tr('create.allowComments')}
          value={settings.allowComments}
          onValueChange={(v) => set({ allowComments: v })}
        />
        <View style={s.divider} />
        <ToggleRow
          label={tr('create.allowDownload')}
          value={settings.allowDownload}
          onValueChange={(v) => set({ allowDownload: v })}
        />
        <View style={s.divider} />
        <ToggleRow
          label={tr('create.allowDuet')}
          value={settings.allowDuet}
          onValueChange={(v) => set({ allowDuet: v })}
        />
        {showWomenOnly && (
          <>
            <View style={s.divider} />
            <View style={s.womenOnlyRow}>
              <View style={s.womenOnlyLeft}>
                <Text style={s.womenOnlyEmoji}>🌸</Text>
                <View>
                  <Text style={s.womenOnlyLabel}>{tr('create.womenOnly')}</Text>
                  <Text style={s.womenOnlySub}>{tr('create.womenOnlyDesc')}</Text>
                </View>
              </View>
              <Switch
                value={settings.womenOnly}
                onValueChange={(v) => set({ womenOnly: v })}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(244,63,94,0.6)' }}
                thumbColor={settings.womenOnly ? '#F43F5E' : 'rgba(255,255,255,0.4)'}
                ios_backgroundColor="rgba(255,255,255,0.1)"
              />
            </View>
          </>
        )}
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
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(255,255,255,0.35)' }}
        thumbColor={value ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
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
  womenOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  womenOnlyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  womenOnlyEmoji: { fontSize: 20 },
  womenOnlyLabel: { color: '#F9A8D4', fontSize: 14, fontWeight: '600' },
  womenOnlySub:   { color: 'rgba(249,168,212,0.55)', fontSize: 11, marginTop: 1 },
});
