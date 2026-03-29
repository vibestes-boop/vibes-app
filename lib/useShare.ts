import { Share, Platform, Alert } from 'react-native';

export async function sharePost(postId: string, caption?: string | null) {
  const text = caption
    ? `"${caption}" – entdeckt auf Vibes`
    : 'Schau dir diesen Vibe an!';

  const url = `vibes://post/${postId}`;

  try {
    const content =
      Platform.OS === 'ios'
        ? { message: text, url }
        : { message: `${text}\n${url}` };
    const result = await Share.share(content, { dialogTitle: 'Post teilen' });
    return result;
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (!msg.includes('cancel') && !msg.includes('dismiss')) {
      Alert.alert('Teilen fehlgeschlagen', msg || 'Bitte versuche es erneut.');
    }
  }
}

/** User-Profil teilen – generiert vibes://user/<userId> */
export async function shareUser(userId: string, username?: string | null) {
  const text = username
    ? `Schau dir @${username} auf Vibes an!`
    : 'Schau dir dieses Profil auf Vibes an!';

  const url = `vibes://user/${userId}`;

  try {
    const content =
      Platform.OS === 'ios'
        ? { message: text, url }
        : { message: `${text}\n${url}` };
    const result = await Share.share(content, { dialogTitle: 'Profil teilen' });
    return result;
  } catch (err: any) {
    const msg: string = err?.message ?? '';
    if (!msg.includes('cancel') && !msg.includes('dismiss')) {
      Alert.alert('Teilen fehlgeschlagen', msg || 'Bitte versuche es erneut.');
    }
  }
}
