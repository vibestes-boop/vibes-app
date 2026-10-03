/* eslint-disable @typescript-eslint/no-require-imports */
import { Keyboard, type KeyboardEvent } from 'react-native';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import CreateCameraScreen from '../../app/create/camera';
let mockParams: { mode?: string } = {};
let mockCameraPermission = { granted: false, canAskAgain: true };
const mockPush = jest.fn(), mockReplace = jest.fn(), mockCapture = jest.fn();
const mockRouter = { back: jest.fn(), replace: mockReplace, push: mockPush };
const mockRequestCamera = jest.fn();
const mockRequestMicrophone = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }));
jest.mock('expo-camera', () => ({
  CameraView: (props: object) => require('react').createElement(require('react-native').View, { ...props, testID: 'capture-camera' }),
  useCameraPermissions: () => [mockCameraPermission, mockRequestCamera],
  useMicrophonePermissions: () => [{ granted: false, canAskAgain: true }, mockRequestMicrophone],
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/components/camera/MusicPickerSheet', () => ({ MusicPickerSheet: () => null }));
jest.mock('@/components/create/CreateGlass', () => ({ GlassPanel: ({ children }: { children: React.ReactNode }) => children, useCreateGlass: () => ({}) }));
jest.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/useThemedStatusBar', () => ({ useThemedStatusBar: () => {} }));
jest.mock('@/lib/useTheme', () => ({ useTheme: () => ({ colors: require('../theme').darkColors, isDark: true }) }));
jest.mock('react-native-view-shot', () => {
  const React = require('react'), { View } = require('react-native');
  return React.forwardRef(function Shot({ children, ...props }: any, ref: any) { React.useImperativeHandle(ref, () => ({ capture: mockCapture })); return React.createElement(View, props, children); });
});
beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockCameraPermission = { granted: false, canAskAgain: true }; });
it('opens the direct text editor with denied camera and microphone access, without mounting or requesting either', () => {
  mockParams = { mode: 'text' };
  const screen = render(<CreateCameraScreen />);
  expect(screen.getByPlaceholderText('ux.textPlaceholder')).toBeTruthy();
  expect(screen.queryByTestId('capture-camera')).toBeNull();
  expect(mockRequestCamera).not.toHaveBeenCalled();
  expect(mockRequestMicrophone).not.toHaveBeenCalled();
  expect(screen.queryByText('create.recording')).toBeNull();
});
it('requests only camera access when the capture route opens', () => {
  const screen = render(<CreateCameraScreen />);
  expect(screen.getByText('create.cameraAccess')).toBeTruthy();
  expect(mockRequestCamera).toHaveBeenCalledTimes(1);
  expect(mockRequestMicrophone).not.toHaveBeenCalled();
});
it('shows a muted photo preview without microphone access', () => {
  mockCameraPermission = { granted: true, canAskAgain: true };
  const screen = render(<CreateCameraScreen />);
  expect(screen.getByTestId('capture-camera').props.mode).toBe('picture');
  expect(screen.getByTestId('capture-camera').props.mute).toBe(true);
  expect(mockRequestCamera).not.toHaveBeenCalled();
  expect(mockRequestMicrophone).not.toHaveBeenCalled();
});
it('offers settings instead of another impossible permission request after permanent denial', () => {
  mockCameraPermission = { granted: false, canAskAgain: false };
  const screen = render(<CreateCameraScreen />);
  expect(screen.getByText('nativeUi.settings')).toBeTruthy();
  expect(mockRequestCamera).not.toHaveBeenCalled();
});

it('restores text actions when Android sends keyboardDidHide', () => {
  const callbacks: Record<string, (event: KeyboardEvent) => void> = {};
  const subscribe = Keyboard.addListener.bind(Keyboard);
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => { callbacks[name] = callback; return subscribe(name, callback); });
  mockParams = { mode: 'text' };
  const screen = render(<CreateCameraScreen />);
  act(() => callbacks.keyboardDidShow({ endCoordinates: { height: 300 } } as KeyboardEvent));
  expect(screen.queryByText('create.next')).toBeNull();
  act(() => callbacks.keyboardDidHide({} as KeyboardEvent));
  expect(screen.getByText('create.next')).toBeTruthy();
  screen.unmount(); spy.mockRestore();
});

it('keeps empty text from continuing and exposes background colors even without a software keyboard', () => {
  mockParams = { mode: 'text' };
  const screen = render(<CreateCameraScreen />);
  expect(screen.getByRole('button', { name: 'create.next' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText('editorUx.background')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('ux.textPlaceholder'), '  ');
  expect(screen.getByRole('button', { name: 'create.next' }).props.accessibilityState.disabled).toBe(true);
  fireEvent.changeText(screen.getByPlaceholderText('ux.textPlaceholder'), 'Ein Gedanke');
  expect(screen.getByRole('button', { name: 'create.next' }).props.accessibilityState.disabled).toBe(false);
});

it('captures non-empty text once and routes a story to review without posting', async () => {
  jest.useFakeTimers(); mockParams = { mode: 'text' }; mockCapture.mockResolvedValue('/text.jpg');
  const screen = render(<CreateCameraScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('ux.textPlaceholder'), 'Meine Geschichte');
  const story = screen.getByRole('button', { name: 'editorUx.storyPreview' });
  fireEvent.press(story); fireEvent.press(story);
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(mockCapture).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/create-story', params: { mediaUri: 'file:///text.jpg', mediaType: 'image' } });
  screen.unmount(); jest.useRealTimers();
});
it('does not capture or navigate after the text editor closes during preparation', async () => {
  jest.useFakeTimers(); mockParams = { mode: 'text' }; mockCapture.mockResolvedValue('/text.jpg');
  const screen = render(<CreateCameraScreen />);
  fireEvent.changeText(screen.getByPlaceholderText('ux.textPlaceholder'), 'Ein Gedanke');
  fireEvent.press(screen.getByRole('button', { name: 'create.next' }));
  screen.unmount();
  await act(async () => { await jest.advanceTimersByTimeAsync(400); });
  expect(mockCapture).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
  jest.useRealTimers();
});
