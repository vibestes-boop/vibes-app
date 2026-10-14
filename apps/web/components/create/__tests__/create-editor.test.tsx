import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CreateEditor } from '../create-editor';
import { publishPost, saveDraft, schedulePost } from '@/app/actions/posts';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/app/actions/posts', () => ({ publishPost: jest.fn(), schedulePost: jest.fn(), saveDraft: jest.fn(), requestR2UploadUrl: jest.fn(), searchHashtagSuggestions: jest.fn().mockResolvedValue([]), searchMentionSuggestions: jest.fn().mockResolvedValue([]) }));
jest.mock('@/components/ai/ai-image-sheet', () => ({ AIImageSheet: () => null }));
jest.mock('../music-picker-dialog', () => ({ MusicPickerDialog: () => null, MUSIC_LIBRARY: [] }));

beforeEach(() => jest.clearAllMocks());
function setup() {
  render(<CreateEditor viewerId="qa-user" initialDraft={{ id: 'draft-123', caption: 'Mein Testentwurf', tags: [], mediaUrl: '/discover/sharoy.webp', mediaType: 'image', thumbnailUrl: null, settings: {} }} />);
}
test('a rejected publish keeps the draft and offers clear feedback', async () => {
  jest.mocked(publishPost).mockRejectedValue(new Error('offline'));
  setup();fireEvent.click(screen.getByRole('button', { name: 'Jetzt posten' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deine Eingaben sind weiterhin vorhanden');
  expect(screen.getByDisplayValue('Mein Testentwurf')).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Jetzt posten' })).toBeEnabled());
});
test('saving a draft preserves its id and does not claim automatic saving', async () => {
  jest.mocked(saveDraft).mockResolvedValue({ ok: true, data: { id: 'draft-123' } });
  setup();expect(screen.queryByText(/Automatisch gespeichert/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Entwurf' }));
  await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft-123', caption: 'Mein Testentwurf' })));
});


test('a failed scheduled post keeps visible feedback inside the scheduling dialog', async () => {
  jest.mocked(schedulePost).mockRejectedValue(new Error('offline'));
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Planen' }));
  fireEvent.click(screen.getByRole('button', { name: 'In 1h' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Planen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deine Eingaben sind weiterhin vorhanden');
  expect(screen.getByText('Zeitpunkt wählen')).toBeVisible();
  expect(screen.getByDisplayValue('Mein Testentwurf')).toBeInTheDocument();
});


test('empty scheduling fields cannot submit or break the editor, and a valid replacement works', async () => {
  jest.mocked(schedulePost).mockResolvedValue({ ok: false, error: 'Isolierte Rückmeldung' });
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Planen' }));
  fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '' } });
  const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Planen' });
  expect(confirm).toBeDisabled();
  expect(screen.getByText('Bitte Datum und Uhrzeit vollständig auswählen.')).toBeVisible();
  expect(schedulePost).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'In 1h' }));
  expect(confirm).toBeEnabled(); fireEvent.click(confirm);
  await waitFor(() => expect(schedulePost).toHaveBeenCalledWith(expect.objectContaining({ draftId: 'draft-123', publishAt: expect.any(String) })));
  expect(await screen.findByRole('alert')).toHaveTextContent('Isolierte Rückmeldung');
});
