import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {App} from '../src/App';
import * as api from '../src/api/stremio';
jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  multiGet: async (keys: string[]) =>
    keys.map((k) => [
      k,
      k === 'account'
        ? 'test-account'
        : k === 'historyScope'
        ? 'test-scope'
        : null,
    ]),
  getItem: async () => null,
}));
jest.mock('@amazon-devices/react-native-kepler', () => ({
  usePreventHideSplashScreen: () => {},
  useHideSplashScreenCallback: () => () => {},
  useTVEventHandler: () => {},
  TVFocusGuideView: require('react-native').View,
}));
jest.mock('@amazon-devices/react-native-w3cmedia', () => ({Video: () => null}));
jest.mock('@amazon-devices/torrentengine', () => ({TorrentEngine: {}}));
jest.mock('../src/api/stremio', () => ({
  ...jest.requireActual('../src/api/stremio'),
  official: [],
  addons: jest.fn().mockResolvedValue([]),
  libraryRecords: jest.fn(),
  notificationVideos: jest.fn().mockResolvedValue([]),
  details: jest.fn(),
  streams: jest.fn(),
}));
const meta = {
  id: 'test:series',
  type: 'series',
  name: 'Test Show',
  videos: [
    {id: 'test:series:1:4', title: 'Fourth episode', season: 1, episode: 4},
  ],
};
it('opens a saved episode from Home and passes its title into the player', async () => {
  (api.libraryRecords as jest.Mock).mockResolvedValue([
    {
      ...meta,
      _id: meta.id,
      state: {video_id: meta.videos[0].id, timeOffset: 60000, duration: 300000},
    },
  ]);
  (api.details as jest.Mock).mockResolvedValue(meta);
  (api.streams as jest.Mock).mockResolvedValue([
    {url: 'https://example.org/video.mp4', name: 'Public stream'},
  ]);
  const screen = render(<App />);
  await screen.findByText('Continue Watching');
  fireEvent.press(await screen.findByLabelText(meta.name));
  await waitFor(() =>
    expect(api.streams).toHaveBeenCalledWith([], meta.type, meta.videos[0].id),
  );
  expect(await screen.findByText('S1 E4 · Fourth episode')).toBeTruthy();
  fireEvent.press(await screen.findByText('Public stream'));
  expect(
    await screen.findByText('Test Show – Fourth episode (1×4)'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Playback position')).toBeTruthy();
  expect(screen.getByLabelText('Subtitles')).toBeTruthy();
  screen.unmount();
});
