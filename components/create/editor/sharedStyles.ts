import { Dimensions, StyleSheet } from 'react-native';

export const { width: SW, height: SH } = Dimensions.get('window');

// Gemeinsame Dark-Sheet Styles (werden von mehreren Editor-Sheets genutzt)
export const shared = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 },
  title:       { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  doneBtn:     { marginHorizontal: 20, backgroundColor: '#fff', paddingVertical: 15, borderRadius: 16, alignItems: 'center' as const, marginTop: 8 },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' as const },
});
