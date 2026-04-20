/**
 * CreateCaptionField.tsx
 * Caption mit Hashtag (#) und Mention (@) Autocomplete.
 *
 * Erkennt wenn der User # oder @ tippt → zeigt Vorschläge als Dropdown.
 * Tipp auf Vorschlag → fügt ihn in die Caption ein.
 */
import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { CREATE_CAPTION_MAX, CREATE_SUGGESTED_TAGS } from './createConstants';
import { createStyles as styles } from './createStyles';

// ─── Typen ──────────────────────────────────────────────────────────────────
type SuggestionMode = 'hashtag' | 'mention' | null;

interface UserSuggestion {
  id: string;
  username: string;
  avatar_url: string | null;
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────
/** Findet das aktive Trigger-Wort vor dem Cursor */
function parseTrigger(text: string, cursorPos: number): { mode: SuggestionMode; query: string } {
  const before = text.slice(0, cursorPos);
  // Suche letztes # oder @ das noch kein Leerzeichen hat
  const match = before.match(/([#@])([^\s#@]*)$/);
  if (!match) return { mode: null, query: '' };
  return {
    mode: match[1] === '#' ? 'hashtag' : 'mention',
    query: match[2],
  };
}

// ─── Komponente ─────────────────────────────────────────────────────────────
export function CreateCaptionField({
  usernameInitial,
  caption,
  onChangeCaption,
}: {
  usernameInitial: string;
  caption: string;
  onChangeCaption: (t: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [mode, setMode] = useState<SuggestionMode>(null);
  const [query, setQuery] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hashtag-Vorschläge: statisch aus CREATE_SUGGESTED_TAGS
  const hashtagSuggestions = query
    ? CREATE_SUGGESTED_TAGS.filter((t) => t.startsWith(query.toLowerCase())).slice(0, 6)
    : CREATE_SUGGESTED_TAGS.slice(0, 6);

  // Mention-Suche: Supabase ilike
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) { setUserSuggestions([]); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `${q}%`)
        .limit(6);
      setUserSuggestions((data as UserSuggestion[]) ?? []);
    } catch { setUserSuggestions([]); }
  }, []);

  const handleChange = (text: string) => {
    onChangeCaption(text);
    // Trigger sofort beim Tippen prüfen (cursorPos ist nach dem Tippen am Ende des neuen Textes)
    const newCursorPos = text.length;
    const { mode: m, query: q } = parseTrigger(text, newCursorPos);
    setMode(m);
    setQuery(q);
    setCursorPos(newCursorPos);
    if (m === 'mention') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchUsers(q), 200);
    } else if (!m) {
      setUserSuggestions([]);
    }
  };

  const handleSelectionChange = ({ nativeEvent }: { nativeEvent: { selection: { start: number } } }) => {
    const pos = nativeEvent.selection.start;
    setCursorPos(pos);
    const { mode: m, query: q } = parseTrigger(caption, pos);
    setMode(m);
    setQuery(q);

    if (m === 'mention') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchUsers(q), 200);
    }
  };

  /** Fügt Suggestion in Caption ein und ersetzt das aktuelle Trigger-Wort */
  const insertSuggestion = (value: string) => {
    const before = caption.slice(0, cursorPos);
    const after = caption.slice(cursorPos);
    // Alles nach dem letzten # / @ bis zum Cursor ersetzen
    const replaced = before.replace(/([#@])([^\s#@]*)$/, `$1${value} `);
    onChangeCaption(replaced + after);
    setMode(null);
  };

  return (
    <>
      <View style={styles.captionWrapper}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>{usernameInitial}</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={styles.captionInput}
          placeholder="Was ist dein Vibe heute? ✨"
          placeholderTextColor="#4B5563"
          value={caption}
          onChangeText={handleChange}
          onSelectionChange={handleSelectionChange}
          multiline
          maxLength={CREATE_CAPTION_MAX}
        />
      </View>
      <Text style={styles.charCount}>
        {caption.length}/{CREATE_CAPTION_MAX}
      </Text>

      {/* ── Autocomplete Dropdown ── */}
      {mode === 'hashtag' && hashtagSuggestions.length > 0 && (
        <View style={ac.container}>
          <FlatList
            data={hashtagSuggestions}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <Pressable style={ac.hashChip} onPress={() => insertSuggestion(item)}>
                <Text style={ac.hashChipText}>#{item}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {mode === 'mention' && userSuggestions.length > 0 && (
        <View style={ac.container}>
          <FlatList
            data={userSuggestions}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <Pressable style={ac.userChip} onPress={() => insertSuggestion(item.username)}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={ac.avatar} contentFit="cover" />
                ) : (
                  <View style={[ac.avatar, ac.avatarFallback]}>
                    <Text style={ac.avatarText}>{item.username[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={ac.userName}>@{item.username}</Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </>
  );
}

const ac = StyleSheet.create({
  container: {
    marginBottom: 8,
    marginTop: -4,
  },
  // Hashtag-Chip
  hashChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  hashChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // User-Chip
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    backgroundColor: 'rgba(168,85,247,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  userName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
});
