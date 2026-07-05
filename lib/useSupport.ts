import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender_type: 'user' | 'admin';
  sender_id: string | null;
  body: string;
  created_at: string;
}

export interface SupportThread {
  id: string;
  subject: string | null;
  status: string;
  priority: string;
  created_at: string;
  last_message_at: string;
}

/** Neuesten Support-Thread des Nutzers + dessen Nachrichten laden. */
export function useMySupport() {
  const userId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['my-support', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: threads } = await supabase
        .from('admin_support_threads')
        .select('id, subject, status, priority, created_at, last_message_at')
        .eq('user_id', userId as string)
        .order('last_message_at', { ascending: false })
        .limit(1);
      const thread = (threads ?? [])[0] as SupportThread | undefined;
      if (!thread) return { thread: null as SupportThread | null, messages: [] as SupportMessage[] };

      const { data: messages } = await supabase
        .from('admin_support_messages')
        .select('id, thread_id, sender_type, sender_id, body, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      return { thread, messages: (messages ?? []) as SupportMessage[] };
    },
  });
}

/** Neuen Support-Thread mit erster Nachricht anlegen. */
export function useCreateSupportThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subject, body }: { subject: string; body: string }) => {
      const { data, error } = await supabase.rpc('create_support_thread', {
        p_subject: subject.trim() || 'Support-Anfrage',
        p_body: body,
        p_source: 'manual',
        p_priority: 'medium',
      });
      if (error) throw error;
      const res = data as { error?: string; thread_id?: string } | null;
      if (res?.error) throw new Error(res.error);
      return res?.thread_id ?? null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-support'] }),
  });
}

/** Follow-up-Nachricht in einem bestehenden Thread senden. */
export function useSendSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data, error } = await supabase.rpc('add_user_support_message', {
        p_thread_id: threadId,
        p_body: body,
      });
      if (error) throw error;
      const res = data as { error?: string } | null;
      if (res?.error) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-support'] }),
  });
}
