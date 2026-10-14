import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessageThread } from '../message-thread';
import { TestI18nProvider } from '@/test-utils/i18n';
import { sendDirectMessage, deleteMessage, toggleMessageReaction, loadOlderMessages, requestImageUploadPath } from '@/app/actions/messages';
import type { MessageWithContext } from '@/lib/data/messages';

const mockUpload = jest.fn();
const mockInsert = { current: undefined as undefined | ((payload: { new: MessageWithContext }) => void) };
jest.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({
  channel: () => { const channel = { on: jest.fn(), subscribe: jest.fn(), track: jest.fn(), presenceState: () => ({}) }; channel.on.mockImplementation((_event, filter, callback) => { if (filter.table === 'messages' && filter.event === 'INSERT') mockInsert.current = callback; return channel; }); channel.subscribe.mockReturnValue(channel); return channel; },
  removeChannel: jest.fn(),
  storage: { from: () => ({ upload: mockUpload, getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/upload.png' } }) }) },
}) }));
jest.mock('@/app/actions/messages', () => ({ sendDirectMessage: jest.fn(), markConversationRead: jest.fn().mockResolvedValue({ ok: true }), toggleMessageReaction: jest.fn(), deleteMessage: jest.fn(), loadOlderMessages: jest.fn(), requestImageUploadPath: jest.fn() }));
jest.mock('../product-link-card', () => ({ ProductLinkCard: () => null }));
jest.mock('../gif-picker', () => ({ GifPicker: ({ onSelect }: { onSelect: (url: string) => void }) => <button onClick={() => onSelect('https://example.test/test.gif')}>Test-GIF wählen</button> }));

beforeEach(() => { jest.clearAllMocks(); HTMLElement.prototype.scrollTo = jest.fn(); mockInsert.current = undefined; });
function setup(initialMessages: MessageWithContext[] = [], initialHasMore = false) {
  return render(<TestI18nProvider><MessageThread conversationId="qa-conversation" viewerId="qa-me" initialMessages={initialMessages} initialHasMore={initialHasMore} initialReactions={[]} otherUser={{ id: 'qa-other', username: 'test-person', display_name: 'Testperson', avatar_url: null }} isSelf productShare={null} /></TestI18nProvider>);
}
function send(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Notiz schreiben' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Nachricht senden' }));
}

test('a failed message stays visible and can be retried without losing its content', async () => {
  jest.mocked(sendDirectMessage).mockResolvedValueOnce({ ok: false, error: 'offline' }).mockResolvedValueOnce({ ok: true, data: { id: 'saved-message' } });
  setup();send('Isolierte Testnachricht');
  expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gesendet');
  expect(screen.getByText('Isolierte Testnachricht')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(sendDirectMessage).toHaveBeenCalledTimes(2);
  expect(sendDirectMessage).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'Isolierte Testnachricht', conversationId: 'qa-conversation' }));
  expect(screen.getAllByText('Isolierte Testnachricht')).toHaveLength(1);
});

test('a server acknowledgement completes sending even when realtime is unavailable', async () => {
  jest.mocked(sendDirectMessage).mockResolvedValue({ ok: true, data: { id: 'saved-message' } });
  setup();send('Ohne Realtime');
  await waitFor(() => expect(screen.queryByText('Wird gesendet…')).not.toBeInTheDocument());
  expect(await screen.findByRole('button', { name: 'Nachrichtenaktionen' })).toBeVisible();
});

test('an early realtime delivery and a later action response produce only one message', async () => {
  let finish!: (value: Awaited<ReturnType<typeof sendDirectMessage>>) => void;
  jest.mocked(sendDirectMessage).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  setup();send('Einmal anzeigen');
  await act(async () => {
    mockInsert.current?.({ new: { id: 'saved-message', sender_id: 'qa-me', content: 'Einmal anzeigen', image_url: null, created_at: new Date().toISOString() } as MessageWithContext });
    finish({ ok: true, data: { id: 'saved-message' } });
  });
  expect(screen.getAllByText('Einmal anzeigen')).toHaveLength(1);
  expect(screen.queryByText('Wird gesendet…')).not.toBeInTheDocument();
});

test('GIF failures use the same visible retry flow', async () => {
  jest.mocked(sendDirectMessage).mockRejectedValue(new Error('offline'));
  setup();fireEvent.click(screen.getByRole('button', { name: 'GIF senden' }));fireEvent.click(screen.getByRole('button', { name: 'Test-GIF wählen' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gesendet');
  expect(sendDirectMessage).toHaveBeenCalledWith(expect.objectContaining({ imageUrl: 'https://example.test/test.gif' }));
});

test('composition Enter does not submit an unfinished word', () => {
  setup();fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Text' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
  expect(sendDirectMessage).not.toHaveBeenCalled();
});

test('a slow send shows the outgoing message immediately while waiting for the server', async () => {
  let finish!: (value: Awaited<ReturnType<typeof sendDirectMessage>>) => void;
  jest.mocked(sendDirectMessage).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  setup(); send('Langsame Verbindung');
  expect(await screen.findByText('Langsame Verbindung')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Wird gesendet');
  await act(async () => finish({ ok: true, data: { id: 'slow-message' } }));
});


const existingMessage = { id: 'qa-existing', sender_id: 'qa-me', conversation_id: 'qa-conversation', content: 'Vorhandene Nachricht', image_url: null, created_at: new Date().toISOString(), read: false, post: null, reply_to: null } as MessageWithContext;
function action(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Nachrichtenaktionen' }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

test.each(['response', 'exception'])('a failed deletion (%s) keeps the message and allows a successful retry', async mode => {
  const request = jest.mocked(deleteMessage);
  if (mode === 'exception') request.mockRejectedValueOnce(new Error('offline'));
  else request.mockResolvedValueOnce({ ok: false, error: 'offline' });
  request.mockResolvedValueOnce({ ok: true, data: null });
  setup([existingMessage]); action('Löschen');
  expect(await screen.findByRole('alert')).toHaveTextContent('Löschen fehlgeschlagen');
  expect(screen.getByText('Vorhandene Nachricht')).toBeVisible();
  action('Löschen');
  await waitFor(() => expect(screen.queryByText('Vorhandene Nachricht')).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledTimes(2);
});

test('failed reactions do not appear as saved and can be applied once on retry', async () => {
  jest.mocked(toggleMessageReaction).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, data: { added: true } });
  setup([existingMessage]); action('Reagieren');
  fireEvent.click(screen.getByRole('button', { name: '🔥' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reaktion');
  expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  action('Reagieren'); fireEvent.click(screen.getByRole('button', { name: '🔥' }));
  expect(await screen.findByRole('button', { pressed: true })).toHaveTextContent('🔥1');
});

test('a failed history request releases loading and a retry can load older messages', async () => {
  jest.mocked(loadOlderMessages).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, data: { messages: [{ ...existingMessage, id: 'qa-older', content: 'Ältere Testnachricht' }], hasMore: false } });
  setup([existingMessage], true); fireEvent.click(screen.getByRole('button', { name: 'Ältere Nachrichten laden' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Ältere Nachrichten konnten nicht geladen werden');
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  expect(await screen.findByText('Ältere Testnachricht')).toBeVisible();
  expect(screen.getByText('Vorhandene Nachricht')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each(['path', 'storage'])('an upload exception (%s) does not lock the composer or erase text', async stage => {
  URL.createObjectURL = jest.fn().mockReturnValue('blob:qa-image'); URL.revokeObjectURL = jest.fn();
  const request = jest.mocked(requestImageUploadPath);
  request.mockReset(); mockUpload.mockReset();
  if (stage === 'path') request.mockRejectedValueOnce(new Error('offline'));
  else mockUpload.mockRejectedValueOnce(new Error('offline'));
  request.mockResolvedValue({ ok: true, data: { path: 'qa/image.png', bucket: 'qa' } });
  mockUpload.mockResolvedValue({ error: null });
  const { container } = setup();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mein Text bleibt' } });
  const file = new File(['qa'], 'qa.png', { type: 'image/png' });
  const input = container.querySelector('input[type=file]')!;
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Bild konnte nicht hochgeladen');
  expect(screen.getByRole('textbox')).toHaveValue('Mein Text bleibt');
  expect(screen.getByRole('button', { name: 'Bild anhängen' })).toBeEnabled();
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByText('✓ bereit')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeEnabled();
});
