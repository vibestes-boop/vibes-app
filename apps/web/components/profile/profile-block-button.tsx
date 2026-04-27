'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff, MoreHorizontal, Flag } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { blockUser } from '@/app/actions/blocks';
import { reportUser, type UserReportReason } from '@/app/actions/report';

// -----------------------------------------------------------------------------
// ProfileBlockButton — v1.w.UI.54 / v1.w.UI.116.
//
// 3-Punkte-Dropdown auf fremden Profilen für eingeloggte User.
// Einträge:
//   • „Melden"     → öffnet Reason-Dialog; schreibt in user_reports
//   • „Blockieren" → Bestätigungs-Dialog; Redirect zu /
// -----------------------------------------------------------------------------

const REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: 'spam',          label: 'Spam oder irreführend' },
  { value: 'harassment',    label: 'Belästigung oder Mobbing' },
  { value: 'inappropriate', label: 'Unangemessene Inhalte' },
  { value: 'fake_account',  label: 'Gefälschtes Konto' },
  { value: 'other',         label: 'Anderer Grund' },
];

export function ProfileBlockButton({
  targetUserId,
  targetUsername,
}: {
  targetUserId: string;
  targetUsername: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // ── Report dialog state ───────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<UserReportReason>('spam');
  const [reportPending, setReportPending] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const handleBlock = async () => {
    const confirmed = window.confirm(
      `@${targetUsername} blockieren?\n\nDieser Account kann dir dann nicht mehr folgen, dir keine Nachrichten schicken und deine Posts nicht sehen.`,
    );
    if (!confirmed) return;

    setPending(true);
    try {
      const result = await blockUser(targetUserId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`@${targetUsername} wurde blockiert.`);
      router.push('/');
    } finally {
      setPending(false);
    }
  };

  const handleReport = async () => {
    setReportPending(true);
    try {
      const result = await reportUser(targetUserId, reportReason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReportDone(true);
    } finally {
      setReportPending(false);
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
            onSelect={(e) => {
              e.preventDefault();
              setReportDone(false);
              setReportReason('spam');
              setReportOpen(true);
            }}
          >
            <Flag className="h-4 w-4" />
            <span>Melden</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => { e.preventDefault(); void handleBlock(); }}
          >
            <ShieldOff className="h-4 w-4" />
            <span>Blockieren</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reportDone ? 'Meldung eingereicht' : `@${targetUsername} melden`}
            </DialogTitle>
          </DialogHeader>

          {reportDone ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Danke für deine Meldung. Unser Team wird sie so schnell wie möglich prüfen.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Wähle den Grund für deine Meldung:</p>
                <div className="flex flex-col gap-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-primary"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReportOpen(false)}
                  disabled={reportPending}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={void handleReport}
                  disabled={reportPending}
                >
                  {reportPending ? 'Wird gesendet…' : 'Melden'}
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
