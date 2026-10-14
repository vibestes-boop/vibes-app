import {
EXPLORE_SORT_OPTIONS,
type ExploreSortMode,
} from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { Modal,Pressable,ScrollView,Text,View,useWindowDimensions } from 'react-native';
import { getExploreStyles } from './exploreStyles';
import { useI18n } from '@/lib/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ExploreSortModal({
  visible,
  sortMode,
  onClose,
  onSelectSort,
}: {
  visible: boolean;
  sortMode: ExploreSortMode;
  onClose: () => void;
  onSelectSort: (mode: ExploreSortMode) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable key={fontScale} style={[styles.filterSheet, { maxHeight: height - insets.top - 12, paddingBottom: 0 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { flex: 1 }]}>{t('explore.sortTitle')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X size={22} color={colors.text.primary} /></Pressable>
          </View>
          <ScrollView bounces={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
          <Text style={styles.sheetSub}>{t('explore.sortSub')}</Text>
          <View style={styles.optionsList}>
            {EXPLORE_SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.id;
              const IconComp = opt.Icon;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={t(opt.labelKey)}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectSort(opt.id);
                    onClose();
                  }}
                >
                  {fontScale <= 1.5 && <View style={[styles.optionIconWrap, active && styles.optionIconWrapActive]}>
                    <IconComp
                      size={18}
                      color={active ? colors.accent.primary : colors.icon.muted}
                      strokeWidth={1.8}
                    />
                  </View>}
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{t(opt.labelKey)}</Text>
                    <Text style={styles.optionSub}>{t(opt.subKey)}</Text>
                  </View>
                  {active && <Check size={18} color={colors.accent.primary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
