import {
EXPLORE_SORT_OPTIONS,
type ExploreSortMode,
} from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Modal,Pressable,Text,View } from 'react-native';
import { getExploreStyles } from './exploreStyles';
import { useI18n } from '@/lib/i18n';

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.filterSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('explore.sortTitle')}</Text>
          <Text style={styles.sheetSub}>{t('explore.sortSub')}</Text>
          <View style={styles.optionsList}>
            {EXPLORE_SORT_OPTIONS.map((opt) => {
              const active = sortMode === opt.id;
              const IconComp = opt.Icon;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectSort(opt.id);
                    onClose();
                  }}
                >
                  <View style={[styles.optionIconWrap, active && styles.optionIconWrapActive]}>
                    <IconComp
                      size={18}
                      color={active ? '#FFFFFF' : colors.icon.muted}
                      strokeWidth={1.8}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{t(opt.labelKey)}</Text>
                    <Text style={styles.optionSub}>{t(opt.subKey)}</Text>
                  </View>
                  {active && <Check size={18} color="#FFFFFF" strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
