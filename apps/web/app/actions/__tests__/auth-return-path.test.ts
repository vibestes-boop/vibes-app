/** @jest-environment node */
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn().mockResolvedValue(new Headers({ host: 'localhost:3000' })) }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));

import { createClient } from '@/lib/supabase/server';
import { getSafeReturnPath } from '@/lib/auth/return-path';
import { signInWithMagicLink, signInWithOAuth } from '../auth';
import { GET } from '@/app/auth/callback/route';
import { NextRequest } from 'next/server';

const otp = jest.fn();
const oauth = jest.fn();
const exchange = jest.fn();
const getUser = jest.fn();
const profile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  otp.mockResolvedValue({ error: null });
  oauth.mockResolvedValue({ error: { message: 'Cancelled' }, data: null });
  exchange.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: 'viewer' } } });
  profile.mockResolvedValue({ data: { username: 'viewer' } });
  (createClient as jest.Mock).mockResolvedValue({
    auth: { signInWithOtp: otp, signInWithOAuth: oauth, exchangeCodeForSession: exchange, getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: profile }) }) }),
  });
});

test.each(['/create', '/shop/saved?sort=new#products', '/u/test?tab=shop'])('preserves local destination %s', (path) => {
  expect(getSafeReturnPath(path)).toBe(path);
});

test.each([null, '', 'https://example.com', '//example.com', '/\\example.com', '/\t/example.com', '/\n/example.com'])('rejects unsafe destination %s', (path) => {
  expect(getSafeReturnPath(path)).toBe('/');
});

test('magic link carries the original destination to the callback', async () => {
  const form = new FormData();
  form.set('email', 'test@example.com');
  form.set('next', '/create?type=photo');
  expect(await signInWithMagicLink(form)).toMatchObject({ ok: true });
  const callback = new URL(otp.mock.calls[0][0].options.emailRedirectTo);
  expect(callback.pathname).toBe('/auth/callback');
  expect(callback.searchParams.get('next')).toBe('/create?type=photo');
});

test('magic link rejects an external return path', async () => {
  const form = new FormData();
  form.set('email', 'test@example.com');
  form.set('next', '//example.com');
  await signInWithMagicLink(form);
  expect(new URL(otp.mock.calls[0][0].options.emailRedirectTo).searchParams.get('next')).toBe('/');
});

test('OAuth errors retain the destination for a retry', async () => {
  await expect(signInWithOAuth('google', '/shop/saved')).rejects.toThrow('next=%2Fshop%2Fsaved');
  expect(new URL(oauth.mock.calls[0][0].options.redirectTo).searchParams.get('next')).toBe('/shop/saved');
});

test.each(['error=access_denied', '', 'code=expired'])('callback failure keeps the destination (%s)', async (query) => {
  exchange.mockResolvedValue({ error: { message: 'expired' } });
  const response = await GET(new NextRequest(`https://serlo.test/auth/callback?next=%2Fcreate&${query}`));
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/login');
  expect(location.searchParams.get('next')).toBe('/create');
  expect(location.searchParams.has('error')).toBe(true);
});

test('callback resumes the requested action after authentication', async () => {
  const response = await GET(new NextRequest('https://serlo.test/auth/callback?code=ok&next=%2Fcreate'));
  expect(response.headers.get('location')).toBe('https://serlo.test/create');
});

test('first login carries the destination into onboarding', async () => {
  profile.mockResolvedValue({ data: null });
  const response = await GET(new NextRequest('https://serlo.test/auth/callback?code=ok&next=%2Fcreate'));
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/onboarding');
  expect(location.searchParams.get('next')).toBe('/create');
});

test('callback keeps recovery on the password reset screen', async () => {
  const response = await GET(new NextRequest('https://serlo.test/auth/callback?code=ok&type=recovery&next=%2Fcreate'));
  expect(response.headers.get('location')).toBe('https://serlo.test/auth/reset-password');
});
