/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ExploreGridItem } from '../ExploreGridItem';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/useTheme', () => ({ useTheme: () => ({ colors: require('@/lib/theme').darkColors }) }));
jest.mock('expo-image', () => ({ Image: (props: object) => require('react').createElement(require('react-native').Image, { ...props, testID: 'media-image' }) }));
const item = { id: 'post-1', author_id: 'author-1', profiles: { username: 'amir', avatar_url: null }, media_type: 'image', media_url: 'https://example.test/photo.jpg', caption: 'A landscape' };
beforeEach(() => mockPush.mockClear());
it('opens the post from its media card', () => {
  const screen = render(<ExploreGridItem item={item} width={192} />);
  fireEvent.press(screen.getByLabelText('A landscape'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-1' } });
});
it('opens the author independently without forwarding the press to the post', () => {
  const screen = render(<ExploreGridItem item={item} />);
  const stopPropagation = jest.fn();
  fireEvent.press(screen.getByLabelText('@amir'), { stopPropagation });
  expect(stopPropagation).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'author-1' } });
});
it('uses a video thumbnail and never decodes an MP4 as an image', () => {
  const video = { ...item, media_type: 'video', media_url: 'https://example.test/clip.mp4', thumbnail_url: 'https://example.test/cover.jpg' };
  const screen = render(<ExploreGridItem item={video} />);
  expect(screen.getByTestId('media-image').props.source).toEqual({ uri: video.thumbnail_url });
  screen.rerender(<ExploreGridItem item={{ ...video, thumbnail_url: null }} />);
  expect(screen.queryByTestId('media-image')).toBeNull();
});
it('recovers a failed preview when the recycled card gets a different image', () => {
  const screen = render(<ExploreGridItem item={item} />);
  fireEvent(screen.getByTestId('media-image'), 'error');
  expect(screen.queryByTestId('media-image')).toBeNull();
  screen.rerender(<ExploreGridItem item={{ ...item, id: 'post-2', media_url: 'https://example.test/new.jpg' }} />);
  expect(screen.getByTestId('media-image').props.source).toEqual({ uri: 'https://example.test/new.jpg' });
});
