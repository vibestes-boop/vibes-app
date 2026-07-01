import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

export default function UserProfileScreen() {
  useThemedStatusBar('auto');
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  return (
    <UserProfileContent
      userId={id ?? ''}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
    />
  );
}
