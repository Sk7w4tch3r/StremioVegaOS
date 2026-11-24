import Storage from '@amazon-devices/react-native-async-storage__async-storage';
import {watchedEpisodes} from './watched';
import {Meta, LibraryRecord, updateLibraryItem, details} from './stremio';
export type ResumeTitle = Meta & {
  videoId: string;
  lastStream?: string;
  offset: number;
  duration: number;
  modified: number;
  newEpisodes?: number;
  pendingSync?: boolean;
  finished?: boolean;
};
let writes = Promise.resolve();
const storageKey = (scope: string) => 'playback.history.' + scope;
export async function localHistory(scope: string): Promise<ResumeTitle[]> {
  await writes;
  const data = await Storage.getItem(storageKey(scope));
  return data ? JSON.parse(data) : [];
}
export function savePosition(scope: string, item: ResumeTitle) {
  const save = writes.then(async () => {
    const data = await Storage.getItem(storageKey(scope));
    const rows: ResumeTitle[] = data ? JSON.parse(data) : [];
    await Storage.setItem(
      storageKey(scope),
      JSON.stringify(
        [
          item,
          ...rows.filter(
            (r) =>
              r.id !== item.id ||
              r.type !== item.type ||
              r.videoId !== item.videoId,
          ),
        ].slice(0, 200),
      ),
    );
  });
  writes = save.catch(() => {});
  return save;
}
export async function syncPosition(
  scope: string,
  key: string,
  mark: ResumeTitle,
) {
  const episodes =
    mark.finished && mark.type === 'series'
      ? (await details(mark)).videos
      : undefined;
  await updateLibraryItem(key, mark, (item) => {
    const previousTime = Date.parse(item.state?.lastWatched || '');
    if (previousTime >= mark.modified) return false;
    const state = item.state || {};
    item.state = {
      ...state,
      video_id: mark.videoId,
      duration: Math.round(mark.duration * 1000),
      timeOffset: Math.round(mark.offset * 1000),
      lastWatched: new Date(mark.modified).toISOString(),
    };
    if (mark.finished) {
      item.state.timesWatched = (state.timesWatched || 0) + 1;
      item.state.flaggedWatched = 1;
      if (episodes?.some((v) => v.id === mark.videoId)) {
        const field = watchedEpisodes(episodes, state.watched);
        field.watched.add(mark.videoId);
        item.state.watched = field.serialize();
      }
    }
    if (item.removed) item.temp = true;
    return true;
  });
  const clear = writes.then(async () => {
    const k = storageKey(scope);
    const data = await Storage.getItem(k);
    if (!data) return;
    const rows: ResumeTitle[] = JSON.parse(data);
    const row = rows.find(
      (r) =>
        r.type === mark.type &&
        r.id === mark.id &&
        r.modified === mark.modified &&
        r.videoId === mark.videoId,
    );
    if (row?.pendingSync) {
      delete row.pendingSync;
      await Storage.setItem(k, JSON.stringify(rows));
    }
  });
  writes = clear.catch(() => {});
  return clear;
}
export function continueWatching(
  cloud: LibraryRecord[],
  local: ResumeTitle[],
  updates: Meta[] = [],
) {
  const merged = new Map<string, ResumeTitle>();
  for (const r of cloud) {
    const state = r.state;
    const eligible =
      r.type !== 'other' &&
      r.type !== 'tv' &&
      !r.behaviorHints?.live &&
      (!r.removed || r.temp);
    merged.set(r.type + ':' + r._id, {
      id: r._id,
      type: r.type,
      name: r.name,
      poster: r.poster,
      videoId: state?.video_id || r._id,
      offset: eligible ? (state?.timeOffset || 0) / 1000 : 0,
      duration: (state?.duration || 0) / 1000,
      modified: Date.parse(r._mtime) || 0,
    });
  }
  for (const r of local) {
    const id = r.type + ':' + r.id;
    const remote = merged.get(id);
    if (!remote || r.modified >= remote.modified) merged.set(id, r);
    else if (r.videoId === remote.videoId) remote.lastStream = r.lastStream;
  }
  const released = new Map<string, Map<string, number>>();
  const library = new Map(cloud.map((r) => [r._id, r]));
  const now = Date.now();
  for (const m of updates) {
    const row = library.get(m.id);
    if (!row) continue;
    const recent = released.get(m.id) || new Map<string, number>();
    const since = Date.parse(row.state?.lastWatched || '') || 0;
    for (const v of m.videos || []) {
      const day = Date.parse(v.released || '');
      if (day > since && day <= now) recent.set(v.id, day);
    }
    released.set(m.id, recent);
  }
  for (const [id, videos] of released) {
    const r = library.get(id);
    if (!r || !videos.size) continue;
    const item = merged.get(r.type + ':' + id);
    if (!item) continue;
    const ordered = [...videos]
      .filter(
        ([, date]) =>
          !local.some((mark) => mark.id === id && mark.modified >= date),
      )
      .sort((a, b) => a[1] - b[1]);
    if (!ordered.length) continue;
    merged.set(r.type + ':' + id, {
      ...item,
      newEpisodes: ordered.length,
      videoId: item.offset ? item.videoId : ordered[0][0],
      modified: Math.max(
        item.offset ? item.modified : 0,
        ordered[ordered.length - 1][1],
      ),
    });
  }
  return [...merged.values()]
    .filter((r) => r.offset > 0 || !!r.newEpisodes)
    .sort((a, b) => b.modified - a.modified);
}
