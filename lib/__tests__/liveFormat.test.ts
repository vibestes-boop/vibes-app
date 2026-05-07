import { formatLiveCount } from '../liveFormat';

describe('formatLiveCount', () => {
  it('keeps small numbers unchanged', () => {
    expect(formatLiveCount(0)).toBe('0');
    expect(formatLiveCount(42)).toBe('42');
    expect(formatLiveCount(999)).toBe('999');
  });

  it('formats thousands and millions consistently', () => {
    expect(formatLiveCount(1_000)).toBe('1.0K');
    expect(formatLiveCount(12_340)).toBe('12.3K');
    expect(formatLiveCount(1_000_000)).toBe('1.0M');
    expect(formatLiveCount(2_550_000)).toBe('2.5M');
  });
});
