/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommentPanel } from '../comment-panel';

// -----------------------------------------------------------------------------
// CommentPanel — v1.w.UI.11 Phase C inline-right-column-Variante der Kommentar-
// Ansicht. Die Liste/Compose-Logik selbst testet der `CommentsBody` separat
// via `comment-sheet.test.tsx` (falls vorhanden) bzw. die neue Body-Suite.
// Hier nur Panel-spezifisches:
//   - X-Close-Button ist da und triggert onClose
//   - allowComments=false blockiert das Compose-Textarea
//   - viewerId=null zeigt Login-Prompt statt Compose-Form
// -----------------------------------------------------------------------------

// Supabase-Client-Call muss stubbed werden, sonst crasht der Query bei
// fehlender ENV in JSDOM.
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

// Server-Action für Compose — default no-op, Tests die Submit testen wollen
// können es overriden.
jest.mock('@/app/actions/engagement', () => ({
  createComment: jest.fn(async () => ({ ok: true, data: { id: 'c1' } })),
}));

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CommentPanel', () => {
  it('rendert Close-Button und triggert onClose', () => {
    const onClose = jest.fn();
    renderWithQC(
      <CommentPanel
        postId="post-1"
        allowComments={true}
        viewerId="viewer-1"
        onClose={onClose}
      />,
    );

    const closeBtn = screen.getByLabelText('Kommentare schließen');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zeigt Lock-Hinweis wenn allowComments=false', () => {
    renderWithQC(
      <CommentPanel
        postId="post-1"
        allowComments={false}
        viewerId="viewer-1"
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByText(/Kommentare sind für diesen Post deaktiviert/i),
    ).toBeInTheDocument();
    // Kein Textarea gerendert wenn Kommentare disabled
    expect(screen.queryByPlaceholderText(/Kommentar hinzufügen/i)).not.toBeInTheDocument();
  });

  it('zeigt Login-Prompt wenn viewerId=null', () => {
    renderWithQC(
      <CommentPanel
        postId="post-1"
        allowComments={true}
        viewerId={null}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(/Melde dich an, um zu kommentieren/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Login/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Kommentar hinzufügen/i)).not.toBeInTheDocument();
  });

  it('rendert Compose-Textarea wenn viewerId + allowComments gesetzt', () => {
    renderWithQC(
      <CommentPanel
        postId="post-1"
        allowComments={true}
        viewerId="viewer-1"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByPlaceholderText(/Kommentar hinzufügen/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Kommentar senden')).toBeInTheDocument();
  });
});
