import {continueWatching, ResumeTitle} from '../src/api/history';
import type {LibraryRecord, Meta} from '../src/api/stremio';
jest.mock(
  '@amazon-devices/react-native-async-storage__async-storage',
  () => ({}),
);
const record: LibraryRecord = {
  _id: 'series1',
  name: 'Show',
  type: 'series',
  _mtime: '2025-01-01',
  state: {timeOffset: 0, lastWatched: '2025-01-01'},
};
const episodes: Meta = {
  ...record,
  id: record._id,
  videos: [
    {id: 'e1', title: 'Seen', released: '2024-12-31'},
    {id: 'e2', title: 'New', released: '2025-01-02'},
    {id: 'e3', title: 'Later', released: '2099-01-01'},
  ],
};
it('includes unwatched releases once, even without a resume offset', () => {
  expect(continueWatching([record], [], [episodes, episodes])).toEqual([
    expect.objectContaining({videoId: 'e2', newEpisodes: 1, offset: 0}),
  ]);
});
it('prefers the latest local resume and clears finished titles', () => {
  const local: ResumeTitle = {
    id: record._id,
    name: record.name,
    type: record.type,
    videoId: 'e2',
    duration: 800,
    offset: 18,
    modified: Date.parse('2025-01-03'),
  };
  expect(continueWatching([record], [local], [episodes])).toEqual([local]);
  expect(
    continueWatching([record], [{...local, offset: 0}], [episodes]),
  ).toEqual([]);
});
