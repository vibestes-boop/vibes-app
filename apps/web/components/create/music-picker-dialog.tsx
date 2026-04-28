'use client';

// -----------------------------------------------------------------------------
// MusicPickerDialog — v1.w.UI.234
//
// Parity mit nativer useMusicPicker.ts / GestureHandler MusicSheet.
// 12 statische Tracks aus der gleichen MUSIC_LIBRARY (SoundHelix-URLs) mit
// Genre-Filter, Audio-Preview via HTML5 Audio API und "Entfernen"-Option.
// Wird im CreateEditor via audioUrl-State verdrahtet.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { Music2, Play, Pause, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Library ─────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  duration: number; // seconds
  bpm: number;
  url: string;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  { id: 't1',  title: 'Chill Wave',       artist: 'SoundHelix',  genre: 'Lo-Fi',        mood: 'Relaxed',   duration: 372, bpm: 75,  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 't2',  title: 'Neon Drive',        artist: 'SoundHelix',  genre: 'Electronic',   mood: 'Energetic', duration: 288, bpm: 128, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 't3',  title: 'Street Vibes',      artist: 'SoundHelix',  genre: 'Hip-Hop',      mood: 'Bold',      duration: 258, bpm: 95,  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 't4',  title: 'Summer Glow',       artist: 'SoundHelix',  genre: 'Pop',          mood: 'Happy',     duration: 321, bpm: 108, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 't5',  title: 'Cloud Garden',      artist: 'SoundHelix',  genre: 'Ambient',      mood: 'Calm',      duration: 410, bpm: 68,  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 't6',  title: 'Dark Trap',         artist: 'SoundHelix',  genre: 'Trap',         mood: 'Intense',   duration: 195, bpm: 140, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { id: 't7',  title: 'Future Swell',      artist: 'SoundHelix',  genre: 'Future Bass',  mood: 'Euphoric',  duration: 237, bpm: 150, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { id: 't8',  title: 'Acoustic Morning',  artist: 'SoundHelix',  genre: 'Acoustic',     mood: 'Peaceful',  duration: 284, bpm: 82,  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 't9',  title: 'Midnight City',     artist: 'SoundHelix',  genre: 'Electronic',   mood: 'Mysterious',duration: 316, bpm: 118, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { id: 't10', title: 'Lo-Fi Study',       artist: 'SoundHelix',  genre: 'Lo-Fi',        mood: 'Focus',     duration: 298, bpm: 72,  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 't11', title: 'Bass Rush',         artist: 'SoundHelix',  genre: 'Trap',         mood: 'Hype',      duration: 213, bpm: 145, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { id: 't12', title: 'Pop Shine',         artist: 'SoundHelix',  genre: 'Pop',          mood: 'Playful',   duration: 267, bpm: 112, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
];

const GENRES = ['Alle', 'Lo-Fi', 'Electronic', 'Hip-Hop', 'Pop', 'Ambient', 'Trap', 'Future Bass', 'Acoustic'];

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  selectedUrl: string | null;
  onSelect: (url: string | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MusicPickerDialog({ open, onClose, selectedUrl, onSelect }: Props) {
  const [genre, setGenre] = useState('Alle');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audio when dialog closes
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }, [open]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const filtered = genre === 'Alle' ? MUSIC_LIBRARY : MUSIC_LIBRARY.filter((t) => t.genre === genre);

  const togglePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    // Stop previous
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(track.url);
    audio.addEventListener('ended', () => setPlayingId(null));
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const handleSelect = (track: MusicTrack) => {
    // Pause preview
    audioRef.current?.pause();
    setPlayingId(null);
    onSelect(track.url);
    onClose();
  };

  const handleRemove = () => {
    audioRef.current?.pause();
    setPlayingId(null);
    onSelect(null);
    onClose();
  };

  const selectedTrack = MUSIC_LIBRARY.find((t) => t.url === selectedUrl) ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Music2 className="h-4 w-4 text-primary" />
            Musik hinzufügen
          </DialogTitle>
        </DialogHeader>

        {/* Genre Filter */}
        <div className="flex gap-1.5 overflow-x-auto border-b px-4 py-2 scrollbar-none">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                genre === g
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto">
          {selectedTrack && (
            <div className="border-b bg-primary/5 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Music2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-primary">{selectedTrack.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedTrack.genre}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="ml-2 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {filtered.map((track) => {
            const isPlaying = playingId === track.id;
            const isSelected = selectedUrl === track.url;
            return (
              <div
                key={track.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                  isSelected && 'bg-primary/5',
                )}
              >
                {/* Play button */}
                <button
                  type="button"
                  onClick={() => togglePlay(track)}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                    isPlaying
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 translate-x-px" />
                  )}
                </button>

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{track.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {track.genre} · {track.bpm} BPM · {fmtDuration(track.duration)}
                  </p>
                </div>

                {/* Select button */}
                <button
                  type="button"
                  onClick={() => handleSelect(track)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {isSelected ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Gewählt
                    </span>
                  ) : (
                    'Wählen'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
