import type { FeedPost, FeedAuthor } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// Factory für FeedPost-Test-Fixtures.
//
// Zentraler Ort damit Schema-Änderungen (neue Pflicht-Felder in @shared/types
// Post) genau hier angepasst werden müssen und nicht in jedem Test.
// `overrides` erlauben, Einzelfälle punktuell abzuändern (z.B. liked_by_me:
// true für Unlike-Tests oder geteilten Author für Follow-Tests).
// -----------------------------------------------------------------------------

let counter = 0;

function makeAuthor(overrides: Partial<FeedAuthor> = {}): FeedAuthor {
  const i = overrides.id ?? `user-${counter}`;
  return {
    id: i,
    username: `user_${counter}`,
    display_name: `User ${counter}`,
    avatar_url: null,
    verified: false,
    ...overrides,
  };
}

export function makeFeedPost(overrides: Partial<FeedPost> = {}): FeedPost {
  counter += 1;
  const id = overrides.id ?? `post-${counter}`;
  const author = overrides.author
    ? makeAuthor(overrides.author)
    : makeAuthor({ id: `user-${counter}` });

  const base: FeedPost = {
    // Post-Pflichtfelder (@shared/types):
    id,
    user_id: author.id,
    caption: `Caption ${counter}`,
    video_url: `https://example.com/${id}.mp4`,
    thumbnail_url: null,
    duration_secs: null,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    hashtags: [],
    music_id: null,
    allow_comments: true,
    allow_duet: true,
    allow_stitch: true,
    allow_download: true,
    created_at: new Date('2026-04-20T12:00:00Z').toISOString(),
    // FeedPost-Erweiterung:
    author,
    liked_by_me: false,
    saved_by_me: false,
    following_author: false,
    reposted_by_me: false,
    media_type: 'video',
    women_only: false,
  };

  return { ...base, ...overrides, author };
}

export function resetFeedPostCounter(): void {
  counter = 0;
}
