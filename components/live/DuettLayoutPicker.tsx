/**
 * DuettLayoutPicker.tsx
 *
 * BottomSheet-Modal für die Layout-Wahl beim Duett-Einladen.
 * 4 Layouts: Top/Bottom, Side-by-Side, PiP, Battle (optional Dauer).
 *
 * Wird aus LiveUserSheet (Host) und DuettInviteCard (Viewer) verwendet.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Rows2, Columns2, PictureInPicture2, Swords, X } from 'lucide-react-native';
import type { DuetLayout } from '@/lib/useCoHost';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (layout: DuetLayout, battleDuration?: number) => void;
  submitLabel?: string;
  title?: string;
  defaultLayout?: DuetLayout;
}

interface LayoutOption {
  id:    DuetLayout;
  label: string;
  hint:  string;
  Icon:  typeof Rows2;
}

const LAYOUTS: LayoutOption[] = [
  { id: 'side-by-side', label: 'Nebeneinander', hint: 'Horizontal 50/50 — der klassische Duett-Look',     Icon: Columns2 },
  { id: 'top-bottom',   label: 'Oben/Unten',    hint: 'Vertikal — du oben, Gast unten',                   Icon: Rows2 },
  { id: 'pip',          label: 'Picture-in-Picture', hint: 'Du Vollbild, Gast als kleines Fenster',        Icon: PictureInPicture2 },
  { id: 'battle',       label: 'Battle',        hint: 'Side-by-Side + Score-Bar und Countdown — für Gift-Duelle', Icon: Swords },
];

const BATTLE_PRESETS = [
  { id: 60,  label: '1 Min' },
  { id: 180, label: '3 Min' },
  { id: 300, label: '5 Min' },
];

export function DuettLayoutPicker({
  visible,
  onCancel,
  onConfirm,
  submitLabel    = 'Einladen',
  title          = 'Duett-Layout wählen',
  defaultLayout  = 'side-by-side',
}: Props) {
  const [selected, setSelected] = useState<DuetLayout>(defaultLayout);
  const [battleDuration, setBattleDuration] = useState<number>(60);

  const handleConfirm = useCallback(() => {
    onConfirm(selected, selected === 'battle' ? battleDuration : undefined);
  }, [selected, battleDuration, onConfirm]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>{title}</Text>
            <Pressable style={s.closeBtn} onPress={onCancel} hitSlop={10}>
              <X size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView style={s.options} showsVerticalScrollIndicator={false}>
            {LAYOUTS.map((opt) => {
              const Icon = opt.Icon;
              const active = selected === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelected(opt.id)}
                  style={[s.option, active && s.optionActive]}
                >
                  <View style={[s.optionIcon, active && s.optionIconActive]}>
                    <Icon
                      size={22}
                      color={active ? '#111827' : '#fff'}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, active && s.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={s.optionHint}>{opt.hint}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {selected === 'battle' && (
            <View style={s.battleRow}>
              <Text style={s.battleLabel}>Battle-Dauer</Text>
              <View style={s.battlePresets}>
                {BATTLE_PRESETS.map((p) => {
                  const active = battleDuration === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setBattleDuration(p.id)}
                      style={[s.preset, active && s.presetActive]}
                    >
                      <Text style={[s.presetText, active && s.presetTextActive]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <Pressable style={s.submitBtn} onPress={handleConfirm}>
            <Text style={s.submitText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  closeBtn: { padding: 4 },

  options: {
    maxHeight: 320,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: '#fff',
  },
  optionText: { flex: 1 },
  optionLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  optionLabelActive: { color: '#fff' },
  optionHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#fff' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  battleRow: {
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  battleLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  battlePresets: {
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  presetActive: {
    backgroundColor: '#fff',
  },
  presetText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  presetTextActive: { color: '#111827' },

  submitBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#111827', fontWeight: '800', fontSize: 15 },
});
