import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { useLocalSearchParams,useRouter } from 'expo-router';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  return (
    <UserProfileContent
      userId={id ?? ''}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
    />
  );
}
