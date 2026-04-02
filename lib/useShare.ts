import { Share, Platform, Alert } from 'react-native';
import { supabase } from './supabase';

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

    // Lernprofil-Signal: Teilen zeigt sehr starkes Interesse am Content
    if (result.action === Share.sharedAction) {
      supabase.rpc('record_share_learn', { p_post_id: postId }).then();
    }

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

/**
 * Post per In-App DM an einen User senden.
 * Öffnet eine Konversation und sendet den Post-Link als Nachricht.
 */
export async function sharePostViaDM(
  postId: string,
  senderId: string,
  recipientId: string,
  caption?: string | null
): Promise<'sent' | 'error'> {
  try {
    // ── Bestehende Konversation finden oder neue erstellen ────────────────
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(user1_id.eq.${senderId},user2_id.eq.${recipientId}),` +
        `and(user1_id.eq.${recipientId},user2_id.eq.${senderId})`
      )
      .maybeSingle();

    let conversationId = existing?.id;

    if (!conversationId) {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({ user1_id: senderId, user2_id: recipientId })
        .select('id')
        .single();
      if (convErr) throw convErr;
      conversationId = newConv.id;
    }

    // ── Nachricht senden: Post-Link als Text ──────────────────────────────
    const linkText = caption
      ? `📎 Post: "${caption.substring(0, 50)}${caption.length > 50 ? '…' : ''}"\n🔗 vibes://post/${postId}`
      : `📎 Post teilen\n🔗 vibes://post/${postId}`;

    const { error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: linkText,
        message_type: 'text',
      });

    if (msgErr) throw msgErr;

    // Lernprofil-Signal: DM-Share zeigt sehr starkes Interesse am Content
    supabase.rpc('record_share_learn', { p_post_id: postId }).then();

    return 'sent';
  } catch (err: any) {
    __DEV__ && console.error('[sharePostViaDM]', err?.message);
    Alert.alert('Fehler', 'Post konnte nicht gesendet werden.');
    return 'error';
  }
}
