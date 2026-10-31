import { IMAGE_RETRY_DELAYS, retryUri } from '../imageRetry';

describe('Neuversuch eines Fotos', () => {
  it('lässt die Adresse beim ersten Versuch unverändert', () => {
    expect(retryUri('https://x/a.jpg', 0)).toBe('https://x/a.jpg');
  });
  it('hängt beim Neuversuch einen Zähler an', () => {
    expect(retryUri('https://x/a.jpg', 1)).toBe('https://x/a.jpg?retry=1');
    expect(retryUri('https://x/a.jpg?w=720', 2)).toBe('https://x/a.jpg?w=720&retry=2');
  });
  it('versucht es zweimal still, mit wachsender Pause', () => {
    expect(IMAGE_RETRY_DELAYS).toHaveLength(2);
    expect(IMAGE_RETRY_DELAYS[1]).toBeGreaterThan(IMAGE_RETRY_DELAYS[0]);
  });
});
