import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {Player} from '../src/screens/Player';
jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  multiGet: async () => [],
}));
let mockRemote: (key: {eventType: string; eventKeyAction: number}) => void;
const mockVideo = {
  currentTime: 25,
  duration: 120,
  readyState: 4,
  paused: true,
  volume: 1,
};
jest.mock('@amazon-devices/react-native-kepler', () => ({
  TVFocusGuideView: require('react-native').View,
  useTVEventHandler: (handler: typeof mockRemote) => {
    mockRemote = handler;
  },
}));
jest.mock('@amazon-devices/react-native-w3cmedia', () => ({
  Video: require('react').forwardRef(
    (_props: unknown, ref: React.Ref<unknown>) => {
      require('react').useImperativeHandle(ref, () => mockVideo);
      return null;
    },
  ),
}));
jest.mock('@amazon-devices/torrentengine', () => ({TorrentEngine: {}}));
it('scrubs directly on the timeline, commits once after repeated taps, and stays paused', () => {
  jest.useFakeTimers();
  const screen = render(
    <Player stream={{url: 'https://example.org/sample.mp4'}} back={() => {}} />,
  );
  try {
    fireEvent(screen.getByLabelText('Playback position'), 'focus');
    act(() => {
      mockRemote({eventType: 'right', eventKeyAction: 0});
      mockRemote({eventType: 'right', eventKeyAction: 1});
    });
    expect(mockVideo.currentTime).toBe(25);
    act(() => {
      jest.advanceTimersByTime(450);
    });
    expect(mockVideo.currentTime).toBe(35);
    act(() => {
      mockRemote({eventType: 'left', eventKeyAction: 0});
      jest.advanceTimersByTime(500);
    });
    expect(mockVideo.currentTime).toBe(25);
    expect(mockVideo.paused).toBe(true);
  } finally {
    screen.unmount();
    jest.useRealTimers();
  }
});
