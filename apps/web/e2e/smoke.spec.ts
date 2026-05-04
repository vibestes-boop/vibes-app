import { expect, test, type APIRequestContext } from '@playwright/test';

type ExplorePost = {
  id?: unknown;
};

type ExploreResponse = {
  posts?: unknown;
  hasMore?: unknown;
};

async function getExplorePosts(request: APIRequestContext): Promise<ExplorePost[]> {
  const response = await request.get('/api/feed/explore?offset=0&limit=6&sort=forYou');

  expect(response.ok(), `Explore API returned ${response.status()}`).toBe(true);

  const body = (await response.json()) as ExploreResponse;
  expect(Array.isArray(body.posts), 'Explore API returns a posts array').toBe(true);
  expect(typeof body.hasMore, 'Explore API returns a hasMore flag').toBe('boolean');

  return body.posts as ExplorePost[];
}

test.describe('public web smoke', () => {
  test('logged-out landing renders the public entrypoint', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.ok(), 'Home route should load').toBe(true);
    await expect(page).toHaveTitle(/Serlo/);
    const landing = page
      .getByTestId('public-landing')
      .or(page.locator('main').filter({
        has: page.getByRole('heading', { name: /Live\. Shop\. Community\./i }),
      }))
      .first();

    await expect(landing).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Live\. Shop\. Community\./i }),
    ).toBeVisible();
    await expect(
      landing.getByRole('link', { name: 'Einloggen' }).first(),
    ).toBeVisible();
  });

  test('login page exposes the passwordless auth options', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });

    expect(response?.ok(), 'Login route should load').toBe(true);
    await expect(
      page.getByTestId('auth-magic-link-form').or(page.locator('form')).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('auth-email-input').or(page.locator('input[type="email"]')).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('auth-submit-button').or(page.locator('button[type="submit"]')).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('oauth-google-button').or(page.getByRole('button', { name: /Google/i })).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('oauth-apple-button').or(page.getByRole('button', { name: /Apple/i })).first(),
    ).toBeVisible();
  });

  test('create flow protects uploads for anonymous visitors', async ({ page }) => {
    await page.goto('/create', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login\?next=(%2Fcreate|\/create)$/);
    await expect(
      page.getByTestId('auth-magic-link-form').or(page.locator('form')).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('auth-email-input').or(page.locator('input[type="email"]')).first(),
    ).toBeVisible();
  });

  test('explore API and a public post detail route stay healthy', async ({ page, request }) => {
    const posts = await getExplorePosts(request);
    const firstPost = posts.find((post) => typeof post.id === 'string');

    if (!firstPost || typeof firstPost.id !== 'string') {
      test.skip(true, 'No public posts are available for the smoke test.');
      return;
    }

    const response = await page.goto(`/p/${firstPost.id}`, { waitUntil: 'domcontentloaded' });

    expect(response?.ok(), 'Public post detail route should load').toBe(true);
    const detailPage = page.getByTestId('post-detail-page').or(page.locator('main')).first();
    await expect(detailPage).toBeVisible();
    await expect(detailPage).not.toContainText(/404|Seite nicht gefunden|Page not found/i);
  });
});
