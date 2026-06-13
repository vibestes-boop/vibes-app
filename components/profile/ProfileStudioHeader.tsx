import { useTheme } from '@/lib/useTheme';
import { Bell,LogOut,Settings } from 'lucide-react-native';
import { Text,View } from 'react-native';
import { HeaderButton } from './HeaderButton';
import { getProfileStyles } from './profileStyles';

export function ProfileStudioHeader({
  username,
  paddingTop,
  unreadNotifs,
  onNotifications,
  onSettings,
  onSignOut,
}: {
  username: string;
  paddingTop: number;
  unreadNotifs: number;
  onNotifications: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  const { colors } = useTheme();
  const s = getProfileStyles(colors);
  return (
    <View style={[s.header, { paddingTop }]}>
      <Text style={s.handle}>@{username}</Text>
      <View style={s.headerRight}>
        <HeaderButton icon={Bell} onPress={onNotifications} badge={unreadNotifs} />
        <HeaderButton icon={Settings} onPress={onSettings} />
        <HeaderButton icon={LogOut} onPress={onSignOut} />
      </View>
    </View>
  );
}
