import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import {
  getLiveSession,
  getLiveComments,
  getActiveLivePoll,
  getLiveRecording,
} from '@/lib/data/live';
import { getSessionGifts, getActiveGiftGoal } from '@/lib/data/live-host';
import { LiveHostDeck } from '@/components/live/live-host-deck';

// -----------------------------------------------------------------------------
// /live/host/[id] — OBS-artiges Control-Deck für den Host.
//
// Verantwortung dieser Page:
//   1. Auth-Guard (eingeloggt?)
//   2. Ownership-Guard (ist user der host_id der Session?)
//   3. SSR-Pre-Loads für den Deck (Comments, Active-Poll, Gift-Feed, Gift-Goal, Recording)
//   4. Render <LiveHostDeck> als reine Client-Shell
//
// Die eigentliche Publisher-Logik (LiveKit Room, canPublish, Track-Enable) sitzt
// im Client, damit Browser-APIs (getUserMedia, MediaDevices) verfügbar sind.
// -----------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getLiveSession(id);
  return {
    title: session?.title ? `Host — ${session.title}` : 'Live hosten',
    description: 'Dein Live-Stream-Control-Deck.',
    // Host-Deck soll NICHT indexiert werden (Ownership-gated ohnehin)
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

export default async function LiveHostPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getUser();
  if (!user) {
    redirect(`/login?next=/live/host/${id}`);
  }

  const session = await getLiveSession(id);
  if (!session) notFound();

  // Ownership — nur der Host sieht sein eigenes Deck
  if (session.host_id !== user.id) {
    // Wenn Session aktiv ist, könnte ein anderer User zum Viewer-Watch umgeleitet
    // werden. Aber semantisch ist /live/host/[id] eindeutig privat → 404.
    notFound();
  }

  // Parallel-SSR-Reads
  const [comments, activePoll, gifts, giftGoal, recording] = await Promise.all([
    getLiveComments(id),
    getActiveLivePoll(id),
    getSessionGifts(id),
    getActiveGiftGoal(id),
    getLiveRecording(id),
  ]);

  return (
    <LiveHostDeck
      session={session}
      hostId={user.id}
      initialComments={comments}
      initialPoll={activePoll}
      initialGifts={gifts}
      initialGiftGoal={giftGoal}
      initialRecording={recording}
    />
  );
}
