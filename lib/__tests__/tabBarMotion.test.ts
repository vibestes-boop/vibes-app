import { renderHook } from '@testing-library/react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { tabBarCompact, useTabBarScroll } from '../tabBarMotion';

// Der Reanimated-Mock gibt bei makeMutable nur den Startwert zurück; hier braucht
// es ein Objekt mit .value, und withTiming springt direkt ans Ziel (jest.mock wird
// vor die Importe gehoben).
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  makeMutable: (value: number) => ({ value }),
  withTiming: (to: number) => to,
}));

const LIST = { contentSize: { height: 4000, width: 400 }, layoutMeasurement: { height: 900, width: 400 } };
const scrollTo = (onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void, y: number) =>
  onScroll({ nativeEvent: { ...LIST, contentOffset: { x: 0, y } } } as unknown as NativeSyntheticEvent<NativeScrollEvent>);

function setup() {
  const { result } = renderHook(() => useTabBarScroll());
  scrollTo(result.current, 0);
  return result.current;
}

it('wird beim Runterscrollen kompakt und beim Hochscrollen wieder voll', () => {
  const onScroll = setup();
  scrollTo(onScroll, 120);
  expect(tabBarCompact.value).toBe(1);
  scrollTo(onScroll, 100);
  expect(tabBarCompact.value).toBe(0);
});

it('ignoriert kleines Zittern unter der Schwelle', () => {
  const onScroll = setup();
  scrollTo(onScroll, 200);
  expect(tabBarCompact.value).toBe(1);
  scrollTo(onScroll, 195);
  scrollTo(onScroll, 198);
  expect(tabBarCompact.value).toBe(1);
});

it('bleibt ganz oben voll, auch beim Ziehen zum Aktualisieren', () => {
  const onScroll = setup();
  scrollTo(onScroll, 300);
  expect(tabBarCompact.value).toBe(1);
  scrollTo(onScroll, 20);
  expect(tabBarCompact.value).toBe(0);
  scrollTo(onScroll, -60);
  expect(tabBarCompact.value).toBe(0);
});

it('lässt das Nachfedern am Listenende nicht als Hochscrollen zählen', () => {
  const onScroll = setup();
  scrollTo(onScroll, 3100);
  expect(tabBarCompact.value).toBe(1);
  scrollTo(onScroll, 3160);
  scrollTo(onScroll, 3120);
  expect(tabBarCompact.value).toBe(1);
});
