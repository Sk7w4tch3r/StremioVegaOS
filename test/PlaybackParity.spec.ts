/* global globalThis */
import {parseCaptions} from '../src/api/captions';
import {watchedEpisodes} from '../src/api/watched';
import {updateLibraryItem} from '../src/api/stremio';

it('reads SRT and WebVTT timestamps, multiline captions and cue settings', () => {
  expect(
    parseCaptions('1\r\n00:00:03,100 --> 00:00:05,000\r\n<i>Hi</i>\r\nthere'),
  ).toEqual([{start: 3.1, end: 5, text: 'Hi\nthere'}]);
  expect(
    parseCaptions(
      'WEBVTT\n\n00:12.000 --> 00:13.000 align:center\nHi &amp; bye',
    ),
  ).toEqual([{start: 12, end: 13, text: 'Hi & bye'}]);
});
it('reads a Stremio core watched bitmap and round-trips an edited episode', () => {
  const videos = Array.from({length: 8}, (_, i) => ({
    id: 'tt2934286:1:' + (i + 1),
    title: 'Episode ' + (i + 1),
    season: 1,
    episode: i + 1,
  }));
  const field = watchedEpisodes(videos, 'tt2934286:1:5:5:eJyTZwAAAEAAIA==');
  expect([...field.watched]).toEqual(videos.slice(0, 5).map((v) => v.id));
  field.watched.add(videos[7].id);
  expect(watchedEpisodes(videos, field.serialize()).watched).toEqual(
    field.watched,
  );
});
it('preserves unrelated library fields and only updates the requested record', async () => {
  const json = (result: unknown) =>
    Promise.resolve({ok: true, json: async () => ({result})});
  const original = globalThis.fetch;
  const fetcher = jest
    .fn()
    .mockReturnValueOnce(
      json([
        {
          _id: 'show',
          removed: false,
          state: {watched: 'existing', noNotif: true},
          unrelated: 42,
        },
      ]),
    )
    .mockReturnValueOnce(json({success: true}));
  globalThis.fetch = fetcher;
  try {
    await updateLibraryItem(
      'test',
      {id: 'show', name: 'Show', type: 'series'},
      (row) => {
        row.state = {...row.state, timeOffset: 12345};
        return true;
      },
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      ids: ['show'],
      all: false,
    });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).changes).toEqual([
      expect.objectContaining({
        unrelated: 42,
        state: {watched: 'existing', noNotif: true, timeOffset: 12345},
      }),
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
