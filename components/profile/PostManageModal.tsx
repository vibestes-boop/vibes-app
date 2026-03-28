import { Modal, Pressable, Text } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { profileStyles as s } from './profileStyles';

export function PostManageModal({
  visible,
  onClose,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={s.modalTitle}>Post verwalten</Text>
          <Pressable
            style={s.modalItem}
            onPress={() => {
              onClose();
              onEdit();
            }}
          >
            <Pencil size={18} color="#9CA3AF" strokeWidth={2} />
            <Text style={s.modalItemText}>Bearbeiten</Text>
          </Pressable>
          <Pressable
            style={[s.modalItem, s.modalItemDestructive]}
            onPress={() => {
              onClose();
              onDelete();
            }}
          >
            <Trash2 size={18} color="#EF4444" strokeWidth={2} />
            <Text style={s.modalItemTextDestructive}>Löschen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
