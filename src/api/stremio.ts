import defaults from '../data/json/officialAddons.json';
export type Meta = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  cast?: string[];
  director?: string[];
  links?: {name: string; category: string; url: string}[];
  trailerStreams?: {url?: string; ytId?: string; title?: string}[];
  trailers?: {source: string; type: string}[];
  background?: string;
  logo?: string;
  releaseInfo?: string;
  runtime?: string;
  imdbRating?: string;
  genres?: string[];
  description?: string;
  videos?: {
    id: string;
    title: string;
    thumbnail?: string;
    overview?: string;
    released?: string;
    season?: number;
    episode?: number;
  }[];
};
export type Stream = {
  provider?: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  subtitles?: Subtitle[];
};
type Resource =
  | string
  | {name: string; types?: string[]; idPrefixes?: string[]};
export type Addon = {
  transportUrl: string;
  flags?: {official?: boolean; protected?: boolean};
  manifest: {
    id?: string;
    addonCatalogs?: Catalog[];
    name: string;
    description?: string;
    version?: string;
    logo?: string;
    types: string[];
    resources: Resource[];
    idPrefixes?: string[];
  };
};
export const official = defaults as Addon[];
const cinema = 'https://v3-cinemeta.strem.io';
async function json<T>(url: string, body?: object): Promise<T> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: abort.signal,
      ...(body
        ? {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!r.ok) throw new Error('Request failed (' + r.status + ')');
    return (await r.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
async function result<T>(url: string, body?: object): Promise<T> {
  const v = await json<{result?: T; error?: {message: string}}>(url, body);
  if (v.result === undefined)
    throw new Error(v.error?.message || 'Stremio returned an empty response');
  return v.result;
}
export const linkCode = () =>
  result<{code: string; link: string; qrcode: string}>(
    'https://link.stremio.com/api/v2/create?type=Create',
  );
export const readCode = (code: string) =>
  json<{result?: {authKey?: string}; error?: {message: string}}>(
    'https://link.stremio.com/api/v2/read?type=Read&code=' +
      encodeURIComponent(code),
  );
export const addons = (authKey: string) =>
  result<{addons: Addon[]}>('https://api.strem.io/api/addonCollectionGet', {
    type: 'AddonCollectionGet',
    authKey,
    update: true,
  }).then((v) => v.addons);
export type LibraryRecord = Omit<Meta, 'id'> & {
  _id: string;
  _mtime: string;
  removed?: boolean;
  temp?: boolean;
  behaviorHints?: {live?: boolean; defaultVideoId?: string};
  state?: {
    timeOffset?: number;
    duration?: number;
    video_id?: string;
    lastWatched?: string;
    watched?: string;
    noNotif?: boolean;
    timesWatched?: number;
    flaggedWatched?: number;
  };
};
export const libraryRecords = (authKey: string) =>
  result<LibraryRecord[]>('https://api.strem.io/api/datastoreGet', {
    authKey,
    collection: 'libraryItem',
    ids: [],
    all: true,
  });
export const getLibraryItem = (authKey: string, id: string) =>
  result<LibraryRecord[]>('https://api.strem.io/api/datastoreGet', {
    authKey,
    collection: 'libraryItem',
    ids: [id],
    all: false,
  }).then((rows) => rows.find((r) => r._id === id));

let libraryWrite = Promise.resolve();
export function updateLibraryItem(
  authKey: string,
  title: Meta,
  change: (item: LibraryRecord) => boolean,
) {
  const write = libraryWrite.then(async () => {
    const existing = await getLibraryItem(authKey, title.id);
    const now = new Date().toISOString();
    const item = existing || {
      _id: title.id,
      _ctime: now,
      _mtime: now,
      name: title.name,
      type: title.type,
      poster: title.poster,
      posterShape: 'poster',
      removed: true,
      temp: true,
      state: {
        timeWatched: 0,
        overallTimeWatched: 0,
        timesWatched: 0,
        timeOffset: 0,
        flaggedWatched: 0,
        duration: 0,
        noNotif: false,
      },
    };
    if (change(item)) {
      item._mtime = now;
      const response = await result<{success: boolean}>(
        'https://api.strem.io/api/datastorePut',
        {
          authKey,
          collection: 'libraryItem',
          changes: [item],
        },
      );
      if (!response.success)
        throw new Error('Could not update your Stremio library.');
    }
    return item;
  });
  libraryWrite = write.then(
    () => {},
    () => {},
  );
  return write;
}

export const library = (authKey: string) =>
  libraryRecords(authKey).then((rows) =>
    rows.filter((r) => !r.removed).map((r) => ({...r, id: r._id})),
  );
export const catalog = (type: string, search: string) =>
  json<{metas: Meta[]}>(
    cinema +
      '/catalog/' +
      type +
      (search ? '/top/search=' + encodeURIComponent(search) : '/top') +
      '.json',
  ).then((v) => v.metas);
export const details = (m: Meta) =>
  json<{meta: Meta}>(
    cinema +
      '/meta/' +
      encodeURIComponent(m.type) +
      '/' +
      encodeURIComponent(m.id) +
      '.json',
  ).then(({meta}) => ({
    ...meta,
    videos: meta.videos?.map((entry, index) => {
      const v = entry as typeof entry & {
        name?: string;
        number?: number;
        description?: string;
      };
      const episode = v.episode ?? v.number;
      return {
        ...v,
        episode,
        title: v.title || v.name || 'Episode ' + (episode ?? index + 1),
        overview: v.overview || v.description,
      };
    }),
  }));
function providers(list: Addon[], resource: string, type: string, id: string) {
  return list.filter(
    (a) =>
      /^https?:\/\//.test(a.transportUrl) &&
      a.manifest.resources?.some((r) => {
        const names = typeof r === 'string' ? a.manifest : r;
        const prefixes = names.idPrefixes;
        return (
          (typeof r === 'string' ? r : r.name) === resource &&
          (!names.types || names.types.includes(type)) &&
          (!prefixes || prefixes.some((p) => id.startsWith(p)))
        );
      }),
  );
}
export type Subtitle = {
  id: string;
  url: string;
  lang: string;
  provider?: string;
};
export async function subtitles(list: Addon[], type: string, id: string) {
  const results = await Promise.allSettled(
    providers(list, 'subtitles', type, id).map(async (a) => {
      const base = a.transportUrl.replace(/\/manifest\.json\/?$/, '');
      const data = await json<{subtitles: Subtitle[]}>(
        base +
          '/subtitles/' +
          encodeURIComponent(type) +
          '/' +
          encodeURIComponent(id) +
          '.json',
      );
      return (data.subtitles || [])
        .filter((s) => /^https?:\/\//i.test(s.url))
        .map((s) => ({...s, provider: a.manifest.name}));
    }),
  );
  if (results.length && results.every((r) => r.status === 'rejected'))
    throw new Error('Subtitle providers could not be reached.');
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
export async function streams(list: Addon[], type: string, id: string) {
  const sources = providers(list, 'stream', type, id);
  const loaded = await Promise.allSettled(
    sources.map(async (a) => {
      const base = a.transportUrl.replace(/\/manifest\.json\/?$/, '');
      const data = await json<{streams: Stream[]}>(
        base +
          '/stream/' +
          encodeURIComponent(type) +
          '/' +
          encodeURIComponent(id) +
          '.json',
      );
      return data.streams
        .filter((s) => s.infoHash || /^(https?:|magnet:)/i.test(s.url || ''))
        .map((s) => ({
          ...s,
          name: s.name || a.manifest.name,
          provider: a.manifest.name,
        }));
    }),
  );
  if (loaded.length && loaded.every((x) => x.status === 'rejected'))
    throw new Error('The stream add-ons could not be reached.');
  return loaded.flatMap((x) => (x.status === 'fulfilled' ? x.value : []));
}
export function streamSignature(s: Stream) {
  // Store a comparison token instead of persisting a provider URL or credential.
  const content = [
    s.provider,
    s.name,
    s.description || s.title,
    s.infoHash,
    s.fileIdx,
    !s.description && !s.title && !s.infoHash ? s.url?.split('?')[0] : '',
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++)
    hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function magnet(s: Stream) {
  if (s.url?.startsWith('magnet:')) return s.url;
  if (!s.infoHash) return '';
  return (
    'magnet:?xt=urn:btih:' +
    encodeURIComponent(s.infoHash) +
    (s.sources || [])
      .filter((v) => v.startsWith('tracker:'))
      .map((v) => '&tr=' + encodeURIComponent(v.slice(8)))
      .join('')
  );
}

type Catalog = {
  id: string;
  name?: string;
  type: string;
  extra?: {
    isRequired?: boolean;
    name?: string;
    optionsLimit?: number;
    options?: string[];
  }[];
  extraRequired?: string[];
};
export function catalogs(list: Addon[]) {
  return list.flatMap((a) =>
    ((a.manifest as Addon['manifest'] & {catalogs?: Catalog[]}).catalogs || [])
      .filter(
        (c) =>
          (c.type === 'movie' || c.type === 'series') &&
          !c.extra?.some((e) => e.isRequired) &&
          !c.extraRequired?.length,
      )
      .map((c) => ({
        type: c.type,
        catalogId: [a.manifest.id || a.manifest.name, c.type, c.id].join('/'),
        paged: !!c.extra?.some((e) => e.name === 'skip'),
        genres: c.extra?.find((e) => e.name === 'genre')?.options || [],
        url:
          a.transportUrl.replace(/\/manifest\.json\/?$/, '') +
          '/catalog/' +
          encodeURIComponent(c.type) +
          '/' +
          encodeURIComponent(c.id) +
          '.json',
        name:
          a.manifest.name +
          ' – ' +
          (c.name || c.id) +
          ' ' +
          (c.type === 'movie' ? 'movies' : 'series'),
      })),
  );
}
export const loadCatalog = (c: {url: string}) =>
  json<{metas: Meta[]}>(c.url).then((v) => v.metas || []);

// Stremio's lastVideosIds catalog lets an add-on return recent episodes in one request.
export async function notificationVideos(
  addons: Addon[],
  records: LibraryRecord[],
  extraName: 'calendarVideosIds' | 'lastVideosIds' = 'lastVideosIds',
) {
  const eligible = records
    .filter((r) =>
      extraName === 'calendarVideosIds'
        ? !r.removed && !r.temp
        : r.type !== 'movie' &&
          r.type !== 'other' &&
          r.type !== 'tv' &&
          !r.removed &&
          !r.temp &&
          !r.state?.noNotif &&
          !r.behaviorHints?.live &&
          !r.behaviorHints?.defaultVideoId,
    )
    .sort((a, b) => Date.parse(b._mtime) - Date.parse(a._mtime));
  const requests: Promise<Meta[]>[] = [];
  for (const a of addons) {
    for (const c of (a.manifest as Addon['manifest'] & {catalogs?: Catalog[]})
      .catalogs || []) {
      const filter = c.extra?.find((e) => e.name === extraName);
      if (!filter) continue;
      const ids = eligible
        .filter((r) => r.type === c.type)
        .slice(0, filter.optionsLimit || 100)
        .map((r) => r._id);
      if (!ids.length) continue;
      const base = a.transportUrl.replace(/\/manifest\.json\/?$/, '');
      requests.push(
        json<{metas: Meta[]}>(
          base +
            '/catalog/' +
            encodeURIComponent(c.type) +
            '/' +
            encodeURIComponent(c.id) +
            '/' +
            extraName +
            '=' +
            encodeURIComponent(ids.join(',')) +
            '.json',
        ).then((x) => x.metas || []),
      );
    }
  }
  return (await Promise.allSettled(requests)).flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  );
}

export type SearchGroup = {name: string; url: string; cards: Meta[]};
export async function searchCatalogs(list: Addon[], query: string) {
  const catalogs = list.flatMap((addon) =>
    (
      (addon.manifest as Addon['manifest'] & {catalogs?: Catalog[]}).catalogs ||
      []
    )
      .filter(
        (c) =>
          c.extra?.some((e) => e.name === 'search') &&
          !c.extra.some((e) => e.isRequired && e.name !== 'search') &&
          !c.extraRequired?.some((name) => name !== 'search'),
      )
      .map((c) => ({
        name: (c.name || c.id) + ' · ' + c.type + ' · ' + addon.manifest.name,
        url:
          addon.transportUrl.replace(/\/manifest\.json\/?$/, '') +
          '/catalog/' +
          encodeURIComponent(c.type) +
          '/' +
          encodeURIComponent(c.id) +
          '/search=' +
          encodeURIComponent(query) +
          '.json',
      })),
  );
  const responses = await Promise.allSettled(
    catalogs.map(async (c) => ({...c, cards: await loadCatalog(c)})),
  );
  if (responses.length && responses.every((r) => r.status === 'rejected'))
    throw new Error('Search providers could not be reached.');
  return responses.flatMap((r) =>
    r.status === 'fulfilled' && r.value.cards.length ? [r.value] : [],
  );
}

export async function addonDirectory(list: Addon[]) {
  const endpoints = list.flatMap((a) =>
    (a.manifest.addonCatalogs || [])
      .filter((c) => c.type === 'all' && !c.extraRequired?.length)
      .map(
        (c) =>
          a.transportUrl.replace(/\/manifest\.json\/?$/, '') +
          '/addon_catalog/all/' +
          encodeURIComponent(c.id) +
          '.json',
      ),
  );
  const responses = await Promise.allSettled(
    endpoints.map((url) => json<{addons: Addon[]}>(url)),
  );
  const found = responses.flatMap((r) =>
    r.status === 'fulfilled' ? r.value.addons || [] : [],
  );
  return [
    ...new Map(
      [...official, ...found]
        .filter((a) => a.manifest?.id && /^https?:\/\//.test(a.transportUrl))
        .map((a) => [a.transportUrl, a]),
    ).values(),
  ];
}
export async function saveAddon(
  authKey: string,
  addon: Addon,
  install: boolean,
) {
  const fresh = await addons(authKey);
  const same = (a: Addon) => a.transportUrl === addon.transportUrl;
  if (install === fresh.some(same)) return fresh;
  if (!install && fresh.find(same)?.flags?.protected)
    throw new Error('This built-in add-on is required.');
  const next = install ? [...fresh, addon] : fresh.filter((a) => !same(a));
  const response = await result<{success: boolean}>(
    'https://api.strem.io/api/addonCollectionSet',
    {type: 'AddonCollectionSet', authKey, addons: next},
  );
  if (!response.success) throw new Error('Could not save add-ons.');
  return next;
}

export async function inspectAddon(address: string): Promise<Addon> {
  const url = address.trim().replace(/^stremio:\/\//i, 'https://');
  if (!/^https?:\/\/[^\s]+$/i.test(url))
    throw new Error('Enter an add-on manifest URL.');
  const manifest = await json<Addon['manifest']>(url);
  if (
    !manifest.id ||
    !manifest.name ||
    !Array.isArray(manifest.types) ||
    !Array.isArray(manifest.resources)
  ) {
    throw new Error('This URL did not return a Stremio add-on manifest.');
  }
  return {transportUrl: url, manifest};
}

export type Rating = 'watched' | 'liked' | 'loved' | null;
export const getRating = (authKey: string, m: Meta) =>
  json<{status: Rating}>(
    'https://likes.stremio.com/api/get_status?authToken=' +
      encodeURIComponent(authKey) +
      '&mediaId=' +
      encodeURIComponent(m.id) +
      '&mediaType=' +
      encodeURIComponent(m.type),
  ).then((r) => r.status);
export async function rateTitle(authKey: string, m: Meta, status: Rating) {
  const response = await json<{rating?: {status: Rating} | null}>(
    'https://likes.stremio.com/api/send',
    {
      authToken: authKey,
      mediaId: m.id,
      mediaType: m.type,
      status,
    },
  );
  return response.rating?.status ?? null;
}
