import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../themeStore';
import { darkColors, lightColors } from '../theme';
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(async () => { await AsyncStorage.clear(); useThemeStore.getState().setMode('dark'); useThemeStore.getState().setSystemScheme('dark'); });
it('restores the light palette when storage resolves after the system effect', async () => {
  await AsyncStorage.setItem('vibes-theme-v1', JSON.stringify({ version: 2, state: { mode: 'light' } }));
  await useThemeStore.persist.rehydrate();
  expect(useThemeStore.getState().resolved).toBe('light');
  expect(useThemeStore.getState().colors).toBe(lightColors);
});
it('resolves a saved system preference against the current device scheme', async () => {
  useThemeStore.getState().setSystemScheme('light');
  await AsyncStorage.setItem('vibes-theme-v1', JSON.stringify({ version: 2, state: { mode: 'system' } }));
  await useThemeStore.persist.rehydrate();
  expect(useThemeStore.getState().colors).toBe(lightColors);
  useThemeStore.getState().setSystemScheme('dark');
  expect(useThemeStore.getState().colors).toBe(darkColors);
});
it('ignores invalid persisted theme values', async () => {
  await AsyncStorage.setItem('vibes-theme-v1', JSON.stringify({ version: 2, state: { mode: 'broken' } }));
  await useThemeStore.persist.rehydrate();
  expect(useThemeStore.getState().mode).toBe('dark');
  expect(useThemeStore.getState().colors).toBe(darkColors);
});
