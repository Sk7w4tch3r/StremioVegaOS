import React, {useState} from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
  BackHandler,
  Linking,
} from 'react-native';
import {Meta, Stream, streamSignature, LibraryRecord} from '../api/stremio';
import {getRating, rateTitle, type Rating} from '../api/stremio';
import {ShareCode} from '../components/ShareCode';
import {watchedEpisodes} from '../api/watched';
import {EpisodeCatalog} from '../components/EpisodeCatalog';
import {TitleLogo} from '../components/TitleLogo';
import {dp} from '../components/tv';
import {MenuItem, PlayerControl} from '../components/PlayerControl';
import {ResumeTitle} from '../api/history';
type Props = {
  meta: Meta;
  accountKey?: string;
  trailer: (m: Meta) => Promise<void>;
  searchPerson: (name: string) => void;
  browseGenre: (genre: string) => void;
  episode: string;
  streams: Stream[];
  progress?: ResumeTitle;
  episodeHistory?: ReadonlyMap<string, ResumeTitle>;
  busy: boolean;
  notice: string;
  record?: LibraryRecord;
  changeLibrary?: (change: (row: LibraryRecord) => boolean) => Promise<void>;
  back: () => void;
  open: (s: Stream) => void;
  choose: (id: string) => void;
};
export function TitleDetails({
  meta,
  accountKey,
  trailer,
  searchPerson,
  browseGenre,
  episode,
  streams,
  progress,
  episodeHistory,
  busy,
  notice,
  record,
  changeLibrary,
  back,
  open,
  choose,
}: Props) {
  const [share, setShare] = useState(false);
  const shareUrl =
    meta.links?.find(
      (l) =>
        l.category.toLowerCase() === 'share' && /^https?:\/\//i.test(l.url),
    )?.url ||
    'https://web.stremio.com/#/detail/' +
      encodeURIComponent(meta.type) +
      '/' +
      encodeURIComponent(meta.id);
  const [infoOpen, setInfoOpen] = useState(false);
  React.useEffect(() => {
    if (!infoOpen && !share) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setInfoOpen(false);
      setShare(false);
      return true;
    });
    return () => sub.remove();
  }, [infoOpen, share]);
  const [rating, setRating] = useState<Rating>();
  const [ratingError, setRatingError] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  React.useEffect(() => {
    let live = true;
    if (!accountKey || !infoOpen) return;
    setRating(undefined);
    setRatingError('');
    getRating(accountKey, meta)
      .then((value) => {
        if (live) setRating(value);
      })
      .catch(() => {
        if (live) setRatingError('Could not load your rating.');
      });
    return () => {
      live = false;
    };
  }, [accountKey, meta, infoOpen]);
  async function rate(value: Rating) {
    if (!accountKey || ratingBusy || rating === undefined) return;
    setRatingBusy(true);
    setRatingError('');
    try {
      setRating(
        await rateTitle(accountKey, meta, rating === value ? null : value),
      );
    } catch {
      setRatingError('Could not save your rating.');
    } finally {
      setRatingBusy(false);
    }
  }
  const [saving, setSaving] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  function mutate(change: (row: LibraryRecord) => boolean) {
    if (!changeLibrary || saving) return;
    setSaving(true);
    setLibraryError('');
    changeLibrary(change)
      .catch(() =>
        setLibraryError('Could not save to your account. Try again.'),
      )
      .finally(() => setSaving(false));
  }
  const inLibrary = !!record && !record.removed;
  const watched = !!record?.state?.timesWatched;
  const video = meta.videos?.find((v) => v.id === episode);
  const [provider, setProvider] = useState('');
  const [filtering, filter] = useState(false);
  const sources = Array.from(
    new Set(streams.map((s) => s.provider || s.name || 'Streams')),
  );
  const filtered = provider
    ? streams.filter((s) => (s.provider || s.name) === provider)
    : streams;
  const heading = video
    ? 'S' + video.season + ' E' + video.episode + ' · ' + video.title
    : episode
    ? 'Streams'
    : 'Episodes';
  const left =
    progress &&
    progress.videoId === episode &&
    progress.duration > progress.offset
      ? Math.ceil((progress.duration - progress.offset) / 60)
      : 0;
  const [focused, setFocused] = useState(false);
  const episodes = React.useMemo(() => meta.videos || [], [meta.videos]);
  const seen = React.useMemo(() => {
    try {
      return watchedEpisodes(episodes, record?.state?.watched).watched;
    } catch {
      return new Set<string>();
    }
  }, [episodes, record?.state?.watched]);
  function markEpisodes(ids: string[], value: boolean) {
    mutate((row) => {
      const field = watchedEpisodes(episodes, row.state?.watched);
      for (const id of ids) {
        if (value) field.watched.add(id);
        else field.watched.delete(id);
      }
      row.state = {...row.state, watched: field.serialize()};
      if (value) {
        const latest = episodes
          .filter((v) => ids.includes(v.id))
          .reduce(
            (n, v) => Math.max(n, Date.parse(v.released || '') || 0),
            Date.parse(row.state.lastWatched || '') || 0,
          );
        if (latest) row.state.lastWatched = new Date(latest).toISOString();
      }
      return true;
    });
  }
  const seasonIds = episodes
    .filter(
      (v) =>
        v.season === video?.season &&
        !(Date.parse(v.released || '') > Date.now()),
    )
    .map((v) => v.id);
  const [browsing, browse] = useState(!episode);
  const art = meta.background || meta.poster;
  const date = video?.released && new Date(video.released);
  const info = [
    date && Number.isFinite(date.getTime())
      ? date.toLocaleDateString()
      : meta.releaseInfo,
    meta.runtime,
    left ? left + ' min left' : '',
  ]
    .filter(Boolean)
    .join('      ');
  const main =
    filtered.find((s) => progress?.lastStream === streamSignature(s)) ||
    filtered[0];
  return (
    <View style={{flex: 1, backgroundColor: '#100e1b'}}>
      {!!art && (
        <Image
          source={{uri: art}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
      <Image
        source={require('../assets/player/backdrop.png')}
        style={{width: '100%', height: '100%', position: 'absolute'}}
        resizeMode="stretch"
      />
      <View style={{alignSelf: 'flex-start', margin: dp(8)}}>
        <PlayerControl icon="back" label="Back" onPress={back} />
      </View>
      <View
        style={{
          position: 'absolute',
          top: dp(42),
          left: dp(25),
          width: '36%',
          height: dp(80),
        }}>
        <TitleLogo uri={meta.logo} name={meta.name} />
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: dp(22),
          left: dp(25),
          width: '48%',
          alignItems: 'flex-start',
        }}>
        {!!video?.thumbnail && (
          <Image
            source={{uri: video.thumbnail}}
            style={{
              width: dp(132),
              height: dp(74),
              borderRadius: dp(5),
              marginBottom: dp(9),
            }}
          />
        )}
        <Text style={s.title}>{video?.title || meta.name}</Text>
        {!!info && <Text style={s.line}>{info}</Text>}
        <Text numberOfLines={3} style={s.desc}>
          {video?.overview || meta.description}
        </Text>
        {!!main && (
          <Pressable
            accessibilityRole="button"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPress={() => open(main)}
            style={{
              paddingVertical: dp(8),
              paddingHorizontal: dp(16),
              borderRadius: dp(18),
              borderWidth: 2,
              borderColor: focused ? 'white' : 'transparent',
              backgroundColor: '#4f9d69',
            }}>
            <Text style={s.button}>
              {left ? '▶   Resume   ·   ' + left + ' min left' : '▶   Watch'}
            </Text>
          </Pressable>
        )}
        <View style={{flexDirection: 'row'}}>
          <MenuItem label="Share" onPress={() => setShare(true)} />
          {!!(meta.trailerStreams?.length || meta.trailers?.length) && (
            <MenuItem
              label="Trailer"
              onPress={() =>
                trailer(meta).catch(() =>
                  setLibraryError('Could not open this trailer on the TV.'),
                )
              }
            />
          )}
          {!!(
            meta.cast?.length ||
            meta.genres?.length ||
            meta.imdbRating ||
            meta.links?.length
          ) && (
            <MenuItem
              label="Title information"
              onPress={() => setInfoOpen(true)}
            />
          )}
        </View>
        {changeLibrary && (
          <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
            <MenuItem
              label={inLibrary ? 'Remove from library' : 'Add to library'}
              onPress={() =>
                mutate((row) => {
                  row.removed = inLibrary;
                  row.temp = false;
                  return true;
                })
              }
            />
            {video && (
              <MenuItem
                label={
                  seen.has(video.id)
                    ? 'Mark episode unwatched'
                    : 'Mark episode watched'
                }
                onPress={() => markEpisodes([video.id], !seen.has(video.id))}
              />
            )}
            {video && seasonIds.length > 1 && (
              <MenuItem
                label={
                  seasonIds.every((id) => seen.has(id))
                    ? 'Mark season unwatched'
                    : 'Mark season watched'
                }
                onPress={() =>
                  markEpisodes(
                    seasonIds,
                    !seasonIds.every((id) => seen.has(id)),
                  )
                }
              />
            )}
            {meta.type === 'movie' && (
              <MenuItem
                label={watched ? 'Mark unwatched' : 'Mark watched'}
                onPress={() =>
                  mutate((row) => {
                    row.state = {
                      ...row.state,
                      timesWatched: watched ? 0 : 1,
                      flaggedWatched: watched ? 0 : 1,
                      timeOffset: 0,
                    };
                    if (!watched)
                      row.state.lastWatched = new Date().toISOString();
                    return true;
                  })
                }
              />
            )}
            {meta.type === 'series' && inLibrary && (
              <MenuItem
                label={
                  'New episode notifications · ' +
                  (record?.state?.noNotif ? 'Off' : 'On')
                }
                onPress={() =>
                  mutate((row) => {
                    row.state = {
                      ...row.state,
                      noNotif: !record?.state?.noNotif,
                    };
                    return true;
                  })
                }
              />
            )}
          </View>
        )}
        {(saving || !!libraryError) && (
          <Text style={s.line}>{saving ? 'Saving…' : libraryError}</Text>
        )}
      </View>
      {share ? (
        <View style={s.drawer}>
          <MenuItem
            first
            label="‹ Back to title"
            onPress={() => setShare(false)}
          />
          <ShareCode url={shareUrl} />
        </View>
      ) : infoOpen ? (
        <ScrollView style={s.drawer}>
          <MenuItem
            first
            label="‹ Back to title"
            onPress={() => setInfoOpen(false)}
          />
          {accountKey && rating !== undefined && (
            <View style={{flexDirection: 'row'}}>
              <MenuItem
                label={rating === 'liked' ? '✓ Liked' : 'Like'}
                onPress={() => rate('liked')}
              />
              <MenuItem
                label={rating === 'loved' ? '✓ Loved' : 'Love'}
                onPress={() => rate('loved')}
              />
            </View>
          )}
          {!!ratingError && <Text style={s.line}>{ratingError}</Text>}
          {/^tt[0-9]+$/.test(meta.id) && (
            <MenuItem
              label={'IMDb ' + (meta.imdbRating || '')}
              onPress={() =>
                Linking.openURL(
                  'https://www.imdb.com/title/' + meta.id + '/',
                ).catch(() =>
                  setLibraryError('IMDb could not open on this TV.'),
                )
              }
            />
          )}
          {(meta.genres || []).map((g) => (
            <MenuItem
              key={'genre' + g}
              label={g}
              detail="Genre"
              onPress={() => browseGenre(g)}
            />
          ))}
          {(meta.links || [])
            .filter((l) =>
              ['cast', 'directors', 'director'].includes(
                l.category.toLowerCase(),
              ),
            )
            .map((l) => (
              <MenuItem
                key={l.category + l.name}
                label={l.name}
                detail={l.category}
                onPress={() => searchPerson(l.name)}
              />
            ))}
        </ScrollView>
      ) : (
        <View style={s.drawer}>
          {episode && episodes.length > 0 ? (
            <MenuItem
              label={browsing ? '‹   Return to streams' : heading}
              detail={browsing ? undefined : '‹   Browse seasons and episodes'}
              onPress={() => {
                browse(!browsing);
                filter(false);
              }}
            />
          ) : (
            <Text style={s.heading}>{heading}</Text>
          )}
          {episode && !browsing ? (
            <>
              {!!sources.length && (
                <MenuItem
                  label={(provider || 'All') + '   ▾'}
                  onPress={() => filter(!filtering)}
                />
              )}
              {filtering ? (
                <FlatList
                  data={['', ...sources]}
                  keyExtractor={(x) => 'provider:' + x}
                  renderItem={({item}) => (
                    <MenuItem
                      label={item || 'All'}
                      onPress={() => {
                        setProvider(item);
                        filter(false);
                      }}
                    />
                  )}
                />
              ) : (
                <FlatList
                  key={episode + provider}
                  data={filtered}
                  initialNumToRender={7}
                  windowSize={3}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({item, index}) => (
                    <View>
                      {(index === 0 ||
                        filtered[index - 1].provider !== item.provider) && (
                        <Text style={s.group}>
                          {(item.provider || 'Streams').toUpperCase()}
                        </Text>
                      )}
                      <MenuItem
                        first={index === 0}
                        label={
                          (item.name || 'Stream').replace(/\n/g, ' ') +
                          (progress?.lastStream === streamSignature(item)
                            ? '   ·   Last used'
                            : '')
                        }
                        detail={item.description || item.title}
                        onPress={() => open(item)}
                      />
                    </View>
                  )}
                />
              )}
            </>
          ) : (
            <EpisodeCatalog
              videos={episodes}
              watched={seen}
              progress={progress}
              episodeHistory={episodeHistory}
              currentId={episode}
              choose={(id) => {
                browse(false);
                filter(false);
                choose(id);
              }}
            />
          )}
          {notice || busy || (episode && !streams.length) ? (
            <Text style={s.line}>
              {notice || (busy ? 'Loading…' : 'No streams available.')}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  drawer: {
    position: 'absolute',
    right: dp(14),
    top: dp(44),
    bottom: dp(14),
    width: '24%',
    minWidth: dp(218),
    padding: dp(7),
    borderRadius: dp(12),
    backgroundColor: 'rgba(20,16,28,0.95)',
  },
  logo: {color: 'white', fontSize: dp(32), fontWeight: 'bold'},
  title: {fontSize: dp(20), fontWeight: 'bold', color: 'white'},
  line: {fontSize: dp(11), color: 'white', marginVertical: dp(6)},
  desc: {
    fontSize: dp(11),
    lineHeight: dp(16),
    color: '#c1bcc9',
    marginBottom: dp(12),
  },
  button: {fontSize: dp(12), color: 'white', fontWeight: 'bold'},
  heading: {
    color: 'white',
    fontSize: dp(13),
    fontWeight: 'bold',
    padding: dp(8),
  },
  group: {
    fontSize: dp(9),
    color: '#d4cad5',
    fontWeight: 'bold',
    marginTop: dp(8),
    paddingLeft: dp(8),
  },
});
