import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BUNNY_DOWN_FOR_MS,
  BUNNY_STREAM_ENABLED,
  __resetBunnyHealth,
  bunnyHlsAllowed,
  bunnyHlsUrl,
  bunnyZoneHealthy,
  probeBunny,
  recheckBunnyIfDue,
  reportBunnyHlsError,
} from '../bunny';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const respond = (status: number) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({ status, ok: status >= 200 && status < 300 });
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  global.fetch = jest.fn();
  // Die Zonen-Logik wird mit eingeschaltetem Bunny geprüft; der Aus-Zustand unten
  __resetBunnyHealth({ enabled: true });
  await AsyncStorage.clear();
  jest.useRealTimers();
});

it('baut die Playlist-Adresse aus der guid', () => {
  expect(bunnyHlsUrl('abc')).toBe('https://vz-6857f4f1-6d5.b-cdn.net/abc/playlist.m3u8');
  expect(bunnyHlsUrl(null)).toBeNull();
});

it('sperrt HLS bei 403 für alle Videos und merkt es sich', async () => {
  respond(403);
  await probeBunny('g1');
  expect(bunnyZoneHealthy()).toBe(false);
  expect(Number(await AsyncStorage.getItem('bunny-hls-down-until-v1'))).toBeGreaterThan(Date.now());
});

it('lässt HLS an, wenn nur ein einzelnes Video fehlt (404)', async () => {
  respond(404);
  await probeBunny('g1');
  expect(bunnyZoneHealthy()).toBe(true);
});

it('fragt bei Fehlern einzelner Videos nicht jedes Mal neu', async () => {
  respond(404);
  reportBunnyHlsError('g1');
  await flush();
  reportBunnyHlsError('g2');
  await flush();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('prüft nach Ablauf der Sperre still und gibt HLS bei Erfolg frei', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  respond(403);
  await probeBunny('g1');
  expect(bunnyZoneHealthy()).toBe(false);

  recheckBunnyIfDue('g1'); // Sperre läuft noch → keine Abfrage
  expect(global.fetch).toHaveBeenCalledTimes(1);

  jest.setSystemTime(Date.now() + BUNNY_DOWN_FOR_MS + 1000);
  expect(bunnyZoneHealthy()).toBe(false); // erst die Prüfung entscheidet
  respond(200);
  recheckBunnyIfDue('g1');
  await flush();
  await flush();
  expect(bunnyZoneHealthy()).toBe(true);
  expect(await AsyncStorage.getItem('bunny-hls-down-until-v1')).toBeNull();
});

it('entscheidet offline nichts', async () => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await probeBunny('g1');
  expect(bunnyZoneHealthy()).toBe(true);
});

it('Bunny aus: kein HLS und keine Abfrage, auch nicht nach Fehlern', async () => {
  __resetBunnyHealth(); // Vorgabe aus lib/bunny.ts
  expect(BUNNY_STREAM_ENABLED).toBe(false);
  expect(bunnyHlsAllowed()).toBe(false);
  reportBunnyHlsError('g1');
  recheckBunnyIfDue('g1');
  await flush();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('Bunny an und Zone gesund: HLS erlaubt', () => {
  expect(bunnyHlsAllowed()).toBe(true);
});
