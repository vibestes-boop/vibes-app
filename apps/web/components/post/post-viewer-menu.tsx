'use client';

import type { Route } from 'next';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, EyeOff, Flag, Link as LinkIcon, ShieldOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { reportPost, markPostNotInteresting } from '@/app/actions/report';
import { blockUser } from '@/app/actions/blocks';
import { adminRemovePost, getViewerIsAdmin } from '@/app/actions/admin';
import { POST_REPORT_REASONS, type PostReportReason } from '@/lib/moderation/report-reasons';

// -----------------------------------------------------------------------------
// PostViewerMenu — v1.w.UI.58
//
// 3-Punkte-Dropdown für nicht-eigene Posts auf /p/[postId].
// Konsolidiert vier Aktionen in einem Menü (statt Post-Detail ohne Menü):
//   1. Kein Interesse  → markPostNotInteresting → Feed-Algorithmus-Feedback
//   2. Melden          → reportPost             → Moderation-Queue
//   3. Link kopieren   → navigator.clipboard
//   4. Blockieren      → blockUser              → Redirect zu /
//
// Im FeedCard existiert ein ähnliches Menü (nur Kein-Interesse + Melden +
// Link), hier kommt Blockieren dazu weil wir auf der Post-Detail-Seite mehr
// Platz und Kontext haben.
//
// Auth-Gate: Aktionen 1/2/4 erfordern Login → toast('Bitte anmelden.')
// Blockieren hat eigenen window.confirm-Dialog (gleiche UX wie ProfileBlockButton).
// -----------------------------------------------------------------------------

export function PostViewerMenu({
  postId,
  targetUserId,
  targetUsername,
  isAuthenticated,
}: {
  postId: string;
  targetUserId: string;
  targetUsername: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { data: viewerIsAdmin } = useQuery({
    queryKey: ['viewer-is-admin'],
    queryFn: getViewerIsAdmin,
    staleTime: Infinity,
    enabled: isAuthenticated,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<PostReportReason>('spam');
  const [reportDone, setReportDone] = useState(false);

  const requireAuth = () => {
    if (!isAuthenticated) {
      toast('Bitte zuerst anmelden.');
      return false;
    }
    return true;
  };

  const handleNotInterested = async () => {
    if (!requireAuth()) return;
    setPending(true);
    try {
      const res = await markPostNotInteresting(postId);
      if (res.ok) {
        toast('Wir zeigen dir weniger davon.');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  const handleReport = async () => {
    if (!requireAuth()) return;
    setPending(true);
    try {
      const res = await reportPost(postId, reportReason);
      if (res.ok) {
        setReportDone(true);
        toast('Danke für deine Meldung. Unser Team prüft das.');
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/p/${postId}`;
      await navigator.clipboard.writeText(url);
      toast('Link kopiert.');
    } catch {
      toast.error('Kopieren fehlgeschlagen.');
    }
  };

  const handleAdminRemove = async () => {
    if (!window.confirm('Diesen Beitrag als Admin entfernen? Wird protokolliert.')) return;
    setPending(true);
    try {
      const res = await adminRemovePost(postId);
      if (res.ok) {
        toast('Beitrag entfernt.');
        router.push('/' as Route);
      } else {
        toast.error(res.error ?? 'Entfernen fehlgeschlagen.');
      }
    } finally {
      setPending(false);
    }
  };

  const handleBlock = async () => {
    if (!requireAuth()) return;
    const confirmed = window.confirm(
      `@${targetUsername} blockieren?\n\nDieser Account kann dir dann nicht mehr folgen, dir keine Nachrichten schicken und deine Posts nicht sehen.`,
    );
    if (!confirmed) return;
    setPending(true);
    try {
      const res = await blockUser(targetUserId);
      if (res.ok) {
        toast.success(`@${targetUsername} wurde blockiert.`);
        router.push('/' as Route);
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Weitere Optionen"
          disabled={pending}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); void handleNotInterested(); }}
        >
          <EyeOff className="h-4 w-4" />
          <span>Kein Interesse</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            if (!requireAuth()) return;
            setReportDone(false);
            setReportOpen(true);
          }}
        >
          <Flag className="h-4 w-4" />
          <span>Melden</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); void handleCopyLink(); }}
        >
          <LinkIcon className="h-4 w-4" />
          <span>Link kopieren</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => { e.preventDefault(); void handleBlock(); }}
        >
          <ShieldOff className="h-4 w-4" />
          <span>Blockieren</span>
        </DropdownMenuItem>
        {viewerIsAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => { e.preventDefault(); void handleAdminRemove(); }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Entfernen (Admin)</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{reportDone ? 'Meldung eingereicht' : 'Post melden'}</DialogTitle>
        </DialogHeader>
        {reportDone ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Danke für deine Meldung. Unser Team prüft sie so schnell wie möglich.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Wähle den Grund für deine Meldung:</p>
              <div className="flex flex-col gap-1.5">
                {POST_REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="post-report-reason"
                      value={reason.value}
                      checked={reportReason === reason.value}
                      onChange={() => setReportReason(reason.value)}
                      className="accent-primary"
                    />
                    {reason.label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)} disabled={pending}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => void handleReport()} disabled={pending}>
                {pending ? 'Wird gesendet…' : 'Melden'}
              </Button>
            </DialogFooter>
          </>
        )}
        {reportDone && (
          <DialogFooter>
            <Button size="sm" onClick={() => setReportOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
