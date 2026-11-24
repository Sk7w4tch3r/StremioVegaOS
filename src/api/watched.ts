import {fromByteArray, toByteArray} from 'base64-js';
import type {Meta} from './stremio';
const {deflate, inflate} = require('pako') as {
  deflate: (bytes: Uint8Array) => Uint8Array;
  inflate: (bytes: Uint8Array) => Uint8Array;
};
type Videos = NonNullable<Meta['videos']>;

// Stremio core stores a compressed little-endian bitmap anchored to an episode ID.
export function watchedEpisodes(videos: Videos, field?: string) {
  const ordered = [...videos].sort(
    (a, b) =>
      (a.season ?? -1) - (b.season ?? -1) ||
      (a.episode ?? -1) - (b.episode ?? -1) ||
      (Date.parse(a.released || '') || 0) - (Date.parse(b.released || '') || 0),
  );
  const ids = ordered.map((v) => v.id);
  const watched = new Set<string>();
  if (field) {
    const match = field.match(/^(.*):(\d+):([^:]+)$/);
    if (!match) throw new Error('Invalid episode history');
    const anchor = ids.indexOf(match[1]);
    if (anchor < 0)
      throw new Error('Episode catalog does not match saved history');
    const bits = inflate(toByteArray(match[3]));
    const shift = Number(match[2]) - 1 - anchor;
    ids.forEach((id, i) => {
      const index = i + shift;
      if (index >= 0 && bits[index >> 3] & (1 << index % 8)) watched.add(id);
    });
  }
  return {
    watched,
    serialize() {
      const bytes = new Uint8Array(Math.ceil(ids.length / 8));
      let last = 0;
      ids.forEach((id, i) => {
        if (watched.has(id)) {
          bytes[i >> 3] |= 1 << i % 8;
          last = i;
        }
      });
      return ids[last] + ':' + (last + 1) + ':' + fromByteArray(deflate(bytes));
    },
  };
}
