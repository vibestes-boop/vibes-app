import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestI18nProvider } from '@/test-utils/i18n';
import { ExplorePostGrid } from '../explore-post-grid';
import type { FeedPost } from '@/lib/data/feed';

jest.mock('../explore-video-card', () => ({ ExploreVideoCard: ({ caption }: { caption: string }) => <div>{caption}</div> }));
function post(caption: string) {
  return { id: caption, caption, author: { username: 'test', display_name: null } } as FeedPost;
}
function response(caption: string) {
  return { ok: true, json: async () => ({ posts: [post(caption)], hasMore: false }) };
}
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function setup() {
  render(<TestI18nProvider><ExplorePostGrid initialPosts={[post('Initial')]} initialHasMore={false} /></TestI18nProvider>);
}

test('a slow earlier sort cannot replace the latest selection, even if abort is ignored', async () => {
  let resolveOlder!: (value: ReturnType<typeof response>) => void;
  global.fetch = jest.fn()
    .mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve; }))
    .mockResolvedValueOnce(response('Newest result'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Trending' }));
  fireEvent.click(screen.getByRole('button', { name: 'Neueste' }));
  await screen.findByText('Newest result');
  await act(async () => resolveOlder(response('Stale result')));
  expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
  expect(screen.getByText('Newest result')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Neueste' })).toHaveAttribute('aria-pressed', 'true');
});

test('a failed tab load offers a retry for that same sort', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response('Recovered'));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Neueste' }));
  await screen.findByText('Beiträge konnten nicht geladen werden.');
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  await screen.findByText('Recovered');
  expect(global.fetch).toHaveBeenLastCalledWith('/api/feed/explore?offset=0&limit=12&sort=newest', expect.objectContaining({ signal: expect.anything() }));
  expect(screen.queryByText('Beiträge konnten nicht geladen werden.')).not.toBeInTheDocument();
});

test('an empty successful response has a clear state instead of a blank grid', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [], hasMore: false }) });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Trending' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Hier gibt es noch keine Beiträge.');
});
