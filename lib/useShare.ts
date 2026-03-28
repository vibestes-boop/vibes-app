import { Share, Platform, Alert } from 'react-native';

export async function sharePost(postId: string, caption?: string | null) {
  const text = caption
    ? `"${caption}" – entdeckt auf Vibes`
    : 'Schau dir diesen Vibe an!';

  const url = `https://vibes.app/post/${postId}`;

  try {
    const content =
      Platform.OS === 'ios'
        ? { message: text, url }          // iOS: url als eigenständiges Feld
        : { message: `${text}\n${url}` }; // Android: url in message einbetten

    const result = await Share.share(content, { dialogTitle: 'Post teilen' });

    // result.action kann 'sharedAction' oder 'dismissedAction' sein
    return result;
  } catch (err: any) {
    // Nur bei echten Fehlern (nicht wenn User abbricht) eine Meldung zeigen
    const msg: string = err?.message ?? '';
    if (!msg.includes('cancel') && !msg.includes('dismiss')) {
      Alert.alert('Teilen fehlgeschlagen', msg || 'Bitte versuche es erneut.');
    }
  }
}
