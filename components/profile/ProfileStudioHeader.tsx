import { View, Text } from 'react-native';
import { Bell, LogOut, Settings } from 'lucide-react-native';
import { HeaderButton } from './HeaderButton';
import { profileStyles as s } from './profileStyles';

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
  return (
    <View style={[s.header, { paddingTop }]}>
      <View>
        <Text style={s.studioLabel}>Studio</Text>
        <Text style={s.handle}>@{username}</Text>
      </View>
      <View style={s.headerRight}>
        <HeaderButton icon={Bell} onPress={onNotifications} badge={unreadNotifs} />
        <HeaderButton icon={Settings} onPress={onSettings} />
        <HeaderButton icon={LogOut} onPress={onSignOut} />
      </View>
    </View>
  );
}
