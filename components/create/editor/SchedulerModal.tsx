import { ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function schedPresets(): { label: string; at: Date }[] {
  const now = new Date();
  const opts: { label: string; at: Date }[] = [];
  opts.push({ label: 'in 1 h', at: new Date(now.getTime() + 60 * 60 * 1000) });
  opts.push({ label: 'in 3 h', at: new Date(now.getTime() + 3 * 60 * 60 * 1000) });
  const today20 = new Date(now); today20.setHours(20, 0, 0, 0);
  if (today20.getTime() > now.getTime() + 60_000) opts.push({ label: 'Heute 20:00', at: today20 });
  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  const t9  = new Date(tom); t9.setHours(9, 0, 0, 0);
  const t14 = new Date(tom); t14.setHours(14, 0, 0, 0);
  const t20 = new Date(tom); t20.setHours(20, 0, 0, 0);
  opts.push({ label: 'Morgen 09:00', at: t9 });
  opts.push({ label: 'Morgen 14:00', at: t14 });
  opts.push({ label: 'Morgen 20:00', at: t20 });
  const next7 = new Date(now); next7.setDate(next7.getDate() + 7); next7.setHours(9, 0, 0, 0);
  opts.push({ label: 'In 1 Woche', at: next7 });
  return opts;
}

export function fmtSchedLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} · ${hh}:${mi}`;
}

export function SchedulerModal({
  visible, onClose, onSave, isSaving,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: Date) => void;
  isSaving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(() => new Date(Date.now() + 3 * 3600 * 1000));

  useEffect(() => {
    if (visible) setDate(new Date(Date.now() + 3 * 3600 * 1000));
  }, [visible]);

  const minMs = Date.now() + 60_000;
  const maxMs = Date.now() + 60 * 24 * 3600 * 1000;
  const clamp = (d: Date) => new Date(Math.max(minMs, Math.min(maxMs, d.getTime())));
  const bumpDays    = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 86_400_000)));
  const bumpHours   = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 3_600_000)));
  const bumpMinutes = (n: number) => setDate((d) => clamp(new Date(d.getTime() + n * 60_000)));

  const valid = date.getTime() >= minMs && date.getTime() <= maxMs;

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={sm.overlay} onPress={onClose} />
      <View style={[sm.sheetWrap, { paddingBottom: insets.bottom + 16 }]}>
        <View style={sm.sheet}>
          <View style={sm.handle} />
          <Text style={sm.heading}>Wann veröffentlichen?</Text>
          <Text style={sm.sub}>Mindestens 1 Minute, höchstens 60 Tage in der Zukunft.</Text>

          <View style={sm.dateCard}>
            <Text style={sm.dateBig}>{fmtSchedLabel(date)}</Text>
          </View>

          <Text style={sm.sectionLabel}>SCHNELLAUSWAHL</Text>
          <View style={sm.presetRow}>
            {schedPresets().map((p) => (
              <Pressable
                key={p.label}
                onPress={() => setDate(clamp(p.at))}
                style={sm.preset}
              >
                <Text style={sm.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={sm.sectionLabel}>FEINSTEUERUNG</Text>
          <View style={sm.stepperRow}>
            <SchedStepper label="Tag −/+"  onDec={() => bumpDays(-1)}    onInc={() => bumpDays(1)} />
            <SchedStepper label="Std −/+" onDec={() => bumpHours(-1)}   onInc={() => bumpHours(1)} />
            <SchedStepper label="Min −/+" onDec={() => bumpMinutes(-15)} onInc={() => bumpMinutes(15)} />
          </View>

          <View style={sm.actions}>
            <Pressable
              onPress={onClose}
              style={sm.btnGhost}
            >
              <Text style={sm.btnGhostText}>Abbrechen</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(date)}
              disabled={isSaving || !valid}
              style={[sm.btnPrimary, (isSaving || !valid) && { opacity: 0.5 }]}
            >
              <Text style={sm.btnPrimaryText}>
                {isSaving ? 'Plant…' : 'Planen'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SchedStepper({ label, onDec, onInc }: { label: string; onDec: () => void; onInc: () => void }) {
  return (
    <View style={sm.stepper}>
      <Pressable onPress={onDec} hitSlop={10} style={sm.stepperBtn}>
        <ChevronDown size={14} color="#fff" strokeWidth={2.5} />
      </Pressable>
      <Text style={sm.stepperLabel}>{label}</Text>
      <Pressable onPress={onInc} hitSlop={10} style={sm.stepperBtn}>
        <ChevronUp size={14} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const sm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0e0e18',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 },
  heading: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 4 },
  dateCard: {
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 14, marginTop: 12, alignItems: 'center',
  },
  dateBig: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  presetText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', gap: 8 },
  stepper: {
    flex: 1, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', paddingVertical: 8, gap: 4,
  },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnGhost: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 13, alignItems: 'center',
  },
  btnGhostText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnPrimary: {
    flex: 1, borderRadius: 12, backgroundColor: '#fff',
    paddingVertical: 13, alignItems: 'center',
  },
  btnPrimaryText: { color: '#000', fontSize: 14, fontWeight: '800' },
});
