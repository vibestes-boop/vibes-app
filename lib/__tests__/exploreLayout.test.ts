import { buildDiscoveryRows } from '../exploreLayout';
const posts = (count: number) => Array.from({ length: count }, (_, i) => ({ id: String(i) }));
describe('discovery placement across pagination and screen sizes', () => {
  it('keeps people after the first four posts when another page is appended', () => {
    for (const count of [4, 30, 60]) {
      const rows = buildDiscoveryRows(posts(count), 2, true);
      expect(rows.findIndex(row => row.kind === 'people')).toBe(2);
      expect(rows.filter(row => row.kind === 'people')).toHaveLength(1);
    }
  });
  it.each([1, 2, 3])('retains every post in order at %i columns, including an incomplete row', columns => {
    const items = posts(31);
    const rows = buildDiscoveryRows(items, columns, true);
    expect(rows.flatMap(row => row.kind === 'posts' ? row.posts : [])).toEqual(items);
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
  });
  it('still shows available people when the post feed is empty or short', () => {
    for (const count of [0, 1, 3]) {
      const rows = buildDiscoveryRows(posts(count), 2, true);
      expect(rows.at(-1)?.kind).toBe('people');
      expect(rows.filter(row => row.kind === 'people')).toHaveLength(1);
    }
  });
  it('does not insert people into search results or when there are no suggestions', () => {
    expect(buildDiscoveryRows(posts(40), 2, false).every(row => row.kind === 'posts')).toBe(true);
    expect(buildDiscoveryRows([], 2, false)).toEqual([]);
  });
});
