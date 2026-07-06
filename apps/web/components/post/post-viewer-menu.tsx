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
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

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
  const { t } = useI18n();
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
      toast(t('comments.loginFirst'));
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
        toast(t('postMenu.notInterestedToast'));
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
        toast(t('postMenu.reportThanksToast'));
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
      toast(t('postMenu.linkCopied'));
    } catch {
      toast.error(t('postMenu.copyFailed'));
    }
  };

  const handleAdminRemove = async () => {
    if (!window.confirm(t('postMenu.adminRemoveConfirm'))) return;
    setPending(true);
    try {
      const res = await adminRemovePost(postId);
      if (res.ok) {
        toast(t('postMenu.adminRemovedToast'));
        router.push('/' as Route);
      } else {
        toast.error(res.error ?? t('postMenu.adminRemoveFailed'));
      }
    } finally {
      setPending(false);
    }
  };

  const handleBlock = async () => {
    if (!requireAuth()) return;
    const confirmed = window.confirm(t('postMenu.blockConfirm', { username: targetUsername }));
    if (!confirmed) return;
    setPending(true);
    try {
      const res = await blockUser(targetUserId);
      if (res.ok) {
        toast.success(t('postMenu.blockedToast', { username: targetUsername }));
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
          aria-label={t('postMenu.moreOptions')}
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
          <span>{t('postMenu.notInterested')}</span>
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
          <span>{t('postMenu.report')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); void handleCopyLink(); }}
        >
          <LinkIcon className="h-4 w-4" />
          <span>{t('postMenu.copyLink')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => { e.preventDefault(); void handleBlock(); }}
        >
          <ShieldOff className="h-4 w-4" />
          <span>{t('postMenu.block')}</span>
        </DropdownMenuItem>
        {viewerIsAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => { e.preventDefault(); void handleAdminRemove(); }}
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('postMenu.adminRemove')}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{reportDone ? t('postMenu.reportDoneTitle') : t('postMenu.reportTitle')}</DialogTitle>
        </DialogHeader>
        {reportDone ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {t('postMenu.reportThanksLong')}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('postMenu.reportChooseReason')}</p>
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
                    {t(`postMenu.reason_${reason.value}` as TranslationKey)}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setReportOpen(false)} disabled={pending}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={() => void handleReport()} disabled={pending}>
                {pending ? t('postMenu.reportSubmitting') : t('postMenu.report')}
              </Button>
            </DialogFooter>
          </>
        )}
        {reportDone && (
          <DialogFooter>
            <Button size="sm" onClick={() => setReportOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
