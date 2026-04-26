/**
 * @jest-environment jsdom
 *
 * Tests für `components/profile/follow-button.tsx` (v1.w.UI.71).
 *
 * FollowButton hat drei Render-Zustände:
 *   1. isSelf=true   → „Profil bearbeiten"-Link nach /settings/profile
 *   2. !isAuthenticated → „Folgen"-Link nach /login?next=/u/[username]
 *   3. Authentifiziert → Toggle-Button (Folgen / Folgst du) mit Server Action
 *
 * Mock-Strategie:
 *   - @/components/ui/button: asChild→ Passthrough des Childs, sonst <button>.
 *     Vermeidet @radix-ui/react-slot-Komplexität in jsdom.
 *   - @/app/actions/engagement: toggleFollow als jest.fn() mit steuerbarem
 *     Resolved-Value. Server Actions sind in jsdom normale async-Functions.
 *   - sonner: toast.success / toast.error als jest.fn() Handles.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FollowButton } from '../follow-button';

// ── useTransition-Mock — isPending per Test steuerbar ────────────────────────
// React 18 concurrent-mode: isPending bleibt true für die gesamte Dauer der
// async startTransition-Callback-Auflösung — auch innerhalb von act(). In jsdom
// schlägt waitFor mit Timeout fehl weil der Spinner nie verschwindet.
// Lösung: useTransition auf synchronen Pass-Through mocken (fn() direkt aufrufen,
// kein async scheduling). mockIsPending steuert den disabled/Spinner-Zustand in
// Spinner-spezifischen Tests explizit; Default ist false (kein Spinner).
let mockIsPending = false;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useTransition: () => [mockIsPending, (fn: () => void | Promise<void>) => { void fn(); }],
}));

// ── Button-Mock — asChild gibt das Kind direkt zurück ────────────────────────
jest.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: ({
      children,
      asChild,
      onClick,
      disabled,
      className,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
      onClick?: () => void;
      disabled?: boolean;
      className?: string;
    }) => {
      if (asChild && React.isValidElement(children)) {
        // asChild: child-Element übernimmt die Rolle des Buttons
        return children;
      }
      return (
        <button onClick={onClick} disabled={disabled} className={className}>
          {children}
        </button>
      );
    },
  };
});

// ── toggleFollow-Mock ────────────────────────────────────────────────────────
const mockToggleFollow = jest.fn();
jest.mock('@/app/actions/engagement', () => ({
  toggleFollow: (...args: unknown[]) => mockToggleFollow(...args),
}));

// ── sonner toast-Mock ────────────────────────────────────────────────────────
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error:   (...args: unknown[]) => mockToastError(...args),
  },
}));

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

const BASE_PROPS = {
  isAuthenticated: true,
  isFollowing: false,
  isSelf: false,
  username: 'test_user',
  targetUserId: 'uid-42',
};

// ── isSelf ────────────────────────────────────────────────────────────────────

describe('FollowButton — isSelf', () => {
  it('rendert „Profil bearbeiten"-Link für den eigenen Account', () => {
    render(<FollowButton {...BASE_PROPS} isSelf={true} />);
    const link = screen.getByRole('link', { name: /profil bearbeiten/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/settings/profile');
  });

  it('rendert keinen Follow/Unfollow-Button wenn isSelf=true', () => {
    render(<FollowButton {...BASE_PROPS} isSelf={true} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ── Nicht eingeloggt ──────────────────────────────────────────────────────────

describe('FollowButton — nicht authentifiziert', () => {
  it('rendert „Folgen"-Link nach /login?next=... für Gäste', () => {
    render(<FollowButton {...BASE_PROPS} isAuthenticated={false} />);
    const link = screen.getByRole('link', { name: /folgen/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/login');
    expect(link.getAttribute('href')).toContain(encodeURIComponent('/u/test_user'));
  });

  it('rendert keinen <button> wenn nicht eingeloggt', () => {
    render(<FollowButton {...BASE_PROPS} isAuthenticated={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ── Render-Zustände (authentifiziert) ────────────────────────────────────────

describe('FollowButton — Render-Zustände (authentifiziert)', () => {
  it('zeigt „Folgen" wenn isFollowing=false', () => {
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);
    expect(screen.getByRole('button', { name: /folgen/i })).toBeInTheDocument();
  });

  it('zeigt „Folgst du" wenn isFollowing=true', () => {
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);
    expect(screen.getByRole('button', { name: /folgst du/i })).toBeInTheDocument();
  });

  it('Button ist anfangs nicht disabled', () => {
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

// ── Optimistisches Follow ─────────────────────────────────────────────────────

describe('FollowButton — Optimistisches Follow', () => {
  beforeEach(() => {
    mockIsPending = false;
    mockToggleFollow.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('Button ist während der laufenden Action disabled (Spinner sichtbar)', () => {
    // mockIsPending=true simuliert useTransition isPending direkt — kein
    // never-resolving Promise nötig; der Button rendert Loader und ist disabled.
    mockIsPending = true;
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    // isPending=true → Button ist disabled und zeigt Spinner
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('zeigt „Folgst du" nach erfolgreichem Folgen', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: true } });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /folgen/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Folgst du/i)).toBeInTheDocument();
    });
  });

  it('ruft toggleFollow mit korrekten Argumenten auf', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: true } });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mockToggleFollow).toHaveBeenCalledWith('uid-42', false);
  });

  it('zeigt Toast nach erfolgreichem Folgen', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: true } });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('@test_user'),
      );
    });
  });

  it('zeigt keinen Toast nach erfolgreichem Entfolgen', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: false } });
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

// ── Optimistisches Unfollow ───────────────────────────────────────────────────

describe('FollowButton — Optimistisches Unfollow', () => {
  beforeEach(() => {
    mockIsPending = false;
    mockToggleFollow.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('Button ist während der laufenden Action disabled (Spinner sichtbar)', () => {
    // mockIsPending=true simuliert useTransition isPending → Loader sichtbar.
    mockIsPending = true;
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('zeigt „Folgen" nach erfolgreichem Entfolgen', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: false } });
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /folgst du/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/^Folgen$/i)).toBeInTheDocument();
    });
  });

  it('ruft toggleFollow(uid, currentlyFollowing=true) auf', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: false } });
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(mockToggleFollow).toHaveBeenCalledWith('uid-42', true);
  });
});

// ── Fehler-Rollback ───────────────────────────────────────────────────────────

describe('FollowButton — Fehler-Rollback', () => {
  beforeEach(() => {
    mockIsPending = false;
    mockToggleFollow.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it('rollt optimistisches Follow zurück wenn toggleFollow ok:false', async () => {
    mockToggleFollow.mockResolvedValue({ ok: false, error: 'Netzwerkfehler' });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    // act() flusht die komplette async Transition (optimistisch + Rollback)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // Nach dem Rollback: wieder "Folgen" (nicht "Folgst du")
    await waitFor(() => {
      expect(screen.getByText(/^Folgen$/i)).toBeInTheDocument();
    });
  });

  it('zeigt toast.error nach fehlgeschlagenem Follow', async () => {
    mockToggleFollow.mockResolvedValue({ ok: false, error: 'Netzwerkfehler' });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Aktion fehlgeschlagen',
        expect.objectContaining({ description: 'Netzwerkfehler' }),
      );
    });
  });

  it('rollt optimistisches Unfollow zurück wenn toggleFollow ok:false', async () => {
    mockToggleFollow.mockResolvedValue({ ok: false, error: 'Serverfehler' });
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    // Rollback: zurück auf "Folgst du"
    await waitFor(() => {
      expect(screen.getByText(/Folgst du/i)).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalled();
  });
});

// ── Server-Action-Bestätigung (data.following) ───────────────────────────────

describe('FollowButton — Server setzt finalen following-State', () => {
  it('übernimmt result.data.following=true vom Server', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: true } });
    render(<FollowButton {...BASE_PROPS} isFollowing={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Folgst du/i)).toBeInTheDocument();
    });
  });

  it('übernimmt result.data.following=false vom Server', async () => {
    mockToggleFollow.mockResolvedValue({ ok: true, data: { following: false } });
    render(<FollowButton {...BASE_PROPS} isFollowing={true} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Folgst du/i)).not.toBeInTheDocument();
    });
  });
});
