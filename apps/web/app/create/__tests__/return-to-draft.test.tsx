import CreatePage from '../page';
jest.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(url); } }));
jest.mock('@/lib/auth/cookies', () => ({ hasSupabaseAuthCookie: async () => false }));
jest.mock('@/lib/auth/session', () => ({ getUser: jest.fn() }));
jest.mock('@/lib/data/posts', () => ({ getDraft: jest.fn() }));
jest.mock('@/lib/data/shop', () => ({ getMyProducts: jest.fn() }));
jest.mock('@/components/create/create-editor', () => ({ CreateEditor: () => null }));

test('login keeps the exact draft instead of sending the user to a blank editor', async () => {
  await expect(CreatePage({ searchParams: Promise.resolve({ draftId: 'draft-123' }) })).rejects.toThrow('/login?next=%2Fcreate%3FdraftId%3Ddraft-123');
});
test('a new post still returns to the empty editor', async () => {
  await expect(CreatePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('/login?next=%2Fcreate');
});
