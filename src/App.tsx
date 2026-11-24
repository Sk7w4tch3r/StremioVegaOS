import React, {useCallback, useEffect, useState} from 'react';
import {
  AppState,
  Linking,
  FlatList,
  BackHandler,
  View,
  Text,
  ScrollView,
  TextInput,
} from 'react-native';
import Storage from '@amazon-devices/react-native-async-storage__async-storage';
import {
  useHideSplashScreenCallback,
  usePreventHideSplashScreen,
} from '@amazon-devices/react-native-kepler';
import {Choice} from './components/Choice';
import {Board} from './screens/Board';
import {TitleDetails} from './screens/TitleDetails';
import {AddonBrowser} from './screens/AddonBrowser';
import {AddonCard} from './components/AddonCard';
import {color} from './components/tv';
import {Rail} from './components/Rail';
import {Poster} from './components/Poster';
import {Calendar} from './screens/Calendar';
import {Settings} from './screens/Settings';
import {SignIn} from './screens/SignIn';
import {
  continueWatching,
  localHistory,
  savePosition,
  syncPosition,
  ResumeTitle,
} from './api/history';
import {Player, episodeLabel} from './screens/Player';
import * as api from './api/stremio';

export type Page =
  | 'Home'
  | 'Discover'
  | 'Search'
  | 'Calendar'
  | 'Library'
  | 'Add-ons'
  | 'Settings'
  | 'Sign in';
const title = {color: 'white', fontSize: 32, fontWeight: 'bold' as const};
const body = {color: '#dddaed', fontSize: 20};
export function App() {
  usePreventHideSplashScreen();
  const hide = useHideSplashScreenCallback();
  const [page, setPage] = useState<Page>('Home'),
    [key, setKey] = useState('');
  const [list, setList] = useState(api.official),
    [cards, setCards] = useState<api.Meta[]>([]);
  const [selected, select] = useState<api.Meta>(),
    [detail, setDetail] = useState<api.Meta>();
  const [episode, setEpisode] = useState(''),
    [streams, setStreams] = useState<api.Stream[]>([]),
    [playing, play] = useState<api.Stream>();
  const [trailer, setTrailer] = useState<api.Stream>();
  const [startingGenre, setStartingGenre] = useState<{
    type: string;
    genre: string;
  }>();
  const [streamOffset, setStreamOffset] = useState<number>();
  const [playerSession, setPlayerSession] = useState(0);
  const [captions, setCaptions] = useState(true),
    [seek, setSeek] = useState(10);
  const [spotlightId, setSpotlightId] = useState('');
  const [repeatSpotlight, setRepeatSpotlight] = useState(true);
  const [audioLanguage, setAudioLanguage] = useState('');
  const [subtitleLanguage, setSubtitleLanguage] = useState('');
  const [countdown, setCountdown] = useState(10);
  const [records, setRecords] = useState<api.LibraryRecord[]>([]);
  const [activeAddon, setActiveAddon] = useState<api.Addon>();
  const [entry, setEntry] = useState(''),
    [query, search] = useState(''),
    [notice, say] = useState(''),
    [busy, wait] = useState(false);
  useEffect(() => {
    Storage.multiGet([
      'captions',
      'seek',
      'nextCountdown',
      'spotlightId',
      'repeatSpotlight',
      'audioLanguage',
      'subtitleLanguage',
    ])
      .then((pairs) => {
        const values = Object.fromEntries(pairs);
        if (
          values.nextCountdown &&
          [0, 5, 10, 20].includes(Number(values.nextCountdown))
        )
          setCountdown(Number(values.nextCountdown));
        setSpotlightId(values.spotlightId || '');
        setRepeatSpotlight(values.repeatSpotlight !== 'false');
        setAudioLanguage(values.audioLanguage || '');
        setSubtitleLanguage(values.subtitleLanguage || '');
        setCaptions(values.captions !== 'false');
        if ([10, 20, 30].includes(Number(values.seek)))
          setSeek(Number(values.seek));
      })
      .catch((e) => say(String(e)));
    Storage.multiGet(['account', 'historyScope'])
      .then(async (pairs) => {
        const values = Object.fromEntries(pairs);
        if (values.account) {
          const id = values.historyScope || String(Date.now());
          if (!values.historyScope) await Storage.setItem('historyScope', id);
          setScope(id);
          setKey(values.account);
        } else setScope('guest');
      })
      .catch((e) => say(String(e)));
  }, []);
  const [groups, setGroups] = useState<api.SearchGroup[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [scope, setScope] = useState('');
  useEffect(() => {
    let active = true;
    setSearchHistory([]);
    if (scope)
      Storage.getItem('search.' + scope)
        .then((raw) => {
          if (active && raw) setSearchHistory(JSON.parse(raw));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [scope]);
  function saveSearch(terms: string[]) {
    setSearchHistory(terms);
    Storage.setItem('search.' + scope, JSON.stringify(terms)).catch(() =>
      say('Could not save search history.'),
    );
  }
  const [history, setHistory] = useState<ResumeTitle[]>([]);
  const [episodeHistory, setEpisodeHistory] = useState<ResumeTitle[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [refresh, refreshHistory] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshHistory((v) => v + 1);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let live = true;
    if (!scope || page !== 'Home' || selected || playing) return;
    setHistoryError('');
    (async () => {
      const [remote, local] = await Promise.allSettled([
        key ? api.libraryRecords(key) : Promise.resolve([]),
        localHistory(scope),
      ]);
      if (!live) return;
      const records = remote.status === 'fulfilled' ? remote.value : [];
      const stored = local.status === 'fulfilled' ? local.value : [];
      setEpisodeHistory(stored);
      if (remote.status === 'fulfilled') setRecords(records);
      if (key && remote.status === 'fulfilled') {
        for (const mark of stored
          .filter((row) => row.pendingSync)
          .sort((a, b) => a.modified - b.modified)) {
          try {
            await syncPosition(scope, key, mark);
          } catch {
            if (live)
              setHistoryError(
                'Progress saved on this TV. Account sync will retry.',
              );
            break;
          }
        }
      }
      if (!live) return;
      setHistory(continueWatching(records, stored));
      if (records.length) {
        const updates = await api.notificationVideos(list, records);
        if (!live) return;
        setHistory(continueWatching(records, stored, updates));
      }
      if (remote.status === 'rejected')
        setHistoryError('Could not refresh Continue Watching from Stremio.');
    })();
    return () => {
      live = false;
    };
  }, [scope, key, page, selected, playing, refresh, list]);
  const resume = useCallback((m: ResumeTitle) => {
    setDetail(m);
    select(m);
    setEpisode(m.videoId);
  }, []);
  const signed = useCallback(async (k: string) => {
    const id = String(Date.now());
    await Storage.multiSet([
      ['account', k],
      ['historyScope', id],
    ]);
    setHistory([]);
    setEpisodeHistory([]);
    setRecords([]);
    setScope(id);
    setKey(k);
    setPage('Home');
  }, []);
  useEffect(() => {
    let live = true;
    setList(api.official);
    if (key)
      api
        .addons(key)
        .then((v) => {
          if (live) setList(v);
        })
        .catch(() => {
          if (live) say('Could not load your add-ons');
        });
    return () => {
      live = false;
    };
  }, [key]);
  const back = useCallback(() => {
    if (trailer) setTrailer(undefined);
    else if (activeAddon) setActiveAddon(undefined);
    else if (playing) play(undefined);
    else if (episode) {
      setEpisode('');
      if (selected?.type !== 'series') select(undefined);
    } else if (selected) select(undefined);
    else if (page !== 'Home') setPage('Home');
    else return false;
    return true;
  }, [trailer, activeAddon, playing, episode, selected, page]);
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', back);
    return () => h.remove();
  }, [back]);
  useEffect(() => {
    let live = true;
    say('');
    wait(true);
    setCards([]);
    setGroups([]);
    setStreams([]);
    async function load() {
      if (selected) {
        if (episode) {
          const v = await api.streams(list, selected.type, episode);
          if (live) setStreams(v);
        } else if (selected.type !== 'series' && live) setEpisode(selected.id);
      } else if (page === 'Library' && key) {
        const rows = await api.libraryRecords(key);
        if (live) {
          setRecords(rows);
          setCards(
            rows.filter((r) => !r.removed).map((r) => ({...r, id: r._id})),
          );
        }
      } else if (page === 'Search' && query) {
        const found = await api.searchCatalogs(list, query);
        if (live) {
          setGroups(found);
          if (!found.length) say('No results for “' + query + '”.');
        }
      }
    }
    load()
      .catch((e) => {
        if (live) say(String(e));
      })
      .finally(() => {
        if (live) wait(false);
      });
    return () => {
      live = false;
    };
  }, [page, key, query, selected, episode, list]);
  useEffect(() => {
    let live = true;
    setDetail(selected);
    if (selected)
      api
        .details(selected)
        .then((m) => {
          if (live) setDetail(m);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [selected]);
  const meta = detail?.id === selected?.id ? detail : selected;
  const currentVideo = meta?.videos?.find((v) => v.id === episode);
  const perEpisode = React.useMemo(() => {
    const map = new Map<string, ResumeTitle>();
    for (const row of [...episodeHistory, ...history]) {
      if (
        row.id === selected?.id &&
        row.type === selected.type &&
        (!map.has(row.videoId) ||
          map.get(row.videoId)!.modified <= row.modified)
      )
        map.set(row.videoId, row);
    }
    return map;
  }, [selected, history, episodeHistory]);
  function startStream(s: api.Stream, offset?: number) {
    setStreamOffset(offset);
    setPlayerSession((n) => n + 1);
    play(s);
  }
  const advance = React.useRef<{id: string; previous: api.Stream} | undefined>(
    undefined,
  );
  useEffect(() => {
    const request = advance.current;
    if (
      !request ||
      request.id !== episode ||
      busy ||
      !streams.length ||
      !selected ||
      playing
    )
      return;
    advance.current = undefined;
    const compatible = streams.filter(
      (s) => s.provider === request.previous.provider,
    );
    const match =
      compatible.find((s) => s.name === request.previous.name) || compatible[0];
    if (match) startStream(match, 0);
  }, [streams, episode, busy, selected, playing]);
  const submitSearch = () => {
    const value = entry.trim();
    if (/^(https?:\/\/|magnet:\?)/i.test(value)) startStream({url: value});
    else {
      if (value)
        saveSearch(
          [value, ...searchHistory.filter((q) => q !== value)].slice(0, 20),
        );
      search(value);
    }
  };
  const go = (p: Page) => {
    advance.current = undefined;
    setStartingGenre(undefined);
    setTrailer(undefined);
    play(undefined);
    setEpisode('');
    select(undefined);
    setActiveAddon(undefined);
    if (p === 'Home') refreshHistory((v) => v + 1);
    setPage(p);
  };
  async function openTrailer(m: api.Meta) {
    const info = m.trailerStreams?.[0];
    if (info?.url && /^https?:\/\//i.test(info.url)) {
      setTrailer({url: info.url, name: m.name + ' · Trailer'});
      return;
    }
    const yt =
      info?.ytId ||
      m.trailers?.find((t) => t.type.toLowerCase() === 'trailer')?.source;
    if (!yt || !/^[a-zA-Z0-9_-]{11}$/.test(yt))
      throw new Error('No playable trailer for this title.');
    await Linking.openURL('https://www.youtube.com/watch?v=' + yt);
  }
  async function changeItem(
    title: api.Meta,
    change: (row: api.LibraryRecord) => boolean,
  ) {
    const row = await api.updateLibraryItem(key, title, change);
    setRecords((prev) => [...prev.filter((r) => r._id !== row._id), row]);
  }
  return (
    <View
      onLayout={hide}
      style={{
        flex: 1,
        backgroundColor: color.primaryColor,
        flexDirection: 'row',
      }}>
      {trailer ? (
        <Player
          stream={trailer}
          back={() => setTrailer(undefined)}
          seek={seek}
          captions={captions}
        />
      ) : playing ? (
        <Player
          key={playerSession}
          stream={playing}
          streams={streams}
          onStream={startStream}
          episodes={meta?.videos}
          episodeId={episode}
          countdown={countdown}
          addons={list}
          mediaType={selected?.type}
          audioLanguage={audioLanguage}
          subtitleLanguage={subtitleLanguage}
          watchedField={
            records.find((r) => r._id === selected?.id)?.state?.watched
          }
          progress={perEpisode.get(episode)}
          episodeHistory={perEpisode}
          onEpisode={(id, automatic) => {
            advance.current = automatic ? {id, previous: playing} : undefined;
            setStreams([]);
            play(undefined);
            setEpisode(id);
          }}
          back={back}
          captions={captions}
          seek={seek}
          title={[selected?.name, currentVideo && episodeLabel(currentVideo)]
            .filter(Boolean)
            .join(' – ')}
          initialTime={streamOffset ?? perEpisode.get(episode)?.offset ?? 0}
          onPosition={(offset, duration, finished) => {
            if (!scope || !selected || !episode) return;
            const {id, type, name, poster} = selected;
            const position: ResumeTitle = {
              id,
              type,
              name,
              poster,
              videoId: episode,
              offset,
              duration,
              modified: Date.now(),
              pendingSync: !!key,
              finished,
              lastStream: api.streamSignature(playing),
            };
            setEpisodeHistory((previous) =>
              [
                position,
                ...previous.filter(
                  (r) =>
                    r.id !== id || r.type !== type || r.videoId !== episode,
                ),
              ].slice(0, 200),
            );
            setHistory((previous) => [
              ...(offset > 0 ? [position] : []),
              ...previous.filter((r) => r.id !== id || r.type !== type),
            ]);
            savePosition(scope, position)
              .then(() =>
                key
                  ? syncPosition(scope, key, position).catch(() =>
                      setHistoryError(
                        'Progress saved on this TV. Account sync will retry.',
                      ),
                    )
                  : undefined,
              )
              .catch(() =>
                setHistoryError(
                  'Could not save playback progress on this Fire TV.',
                ),
              );
          }}
        />
      ) : (
        <>
          {!selected && <Rail active={page} signedIn={!!key} go={go} />}
          <View style={{flex: 1}}>
            {page === 'Settings' ? (
              <Settings
                catalogs={api.catalogs(list)}
                spotlightId={spotlightId}
                repeatSpotlight={repeatSpotlight}
                setSpotlight={(id) => {
                  setSpotlightId(id);
                  Storage.setItem('spotlightId', id).catch(() =>
                    say('Could not save Spotlight catalog.'),
                  );
                }}
                toggleRepeat={() => {
                  setRepeatSpotlight(!repeatSpotlight);
                  Storage.setItem(
                    'repeatSpotlight',
                    String(!repeatSpotlight),
                  ).catch(() => say('Could not save Home settings.'));
                }}
                captions={captions}
                seek={seek}
                account={!!key}
                audioLanguage={audioLanguage}
                subtitleLanguage={subtitleLanguage}
                chooseLanguage={async (which, code) => {
                  await Storage.setItem(which, code);
                  if (which === 'audioLanguage') setAudioLanguage(code);
                  else setSubtitleLanguage(code);
                }}
                countdown={countdown}
                changeCountdown={() => {
                  const choices = [0, 5, 10, 20];
                  const n =
                    choices[(choices.indexOf(countdown) + 1) % choices.length];
                  Storage.setItem('nextCountdown', String(n))
                    .then(() => setCountdown(n))
                    .catch((e) => say(String(e)));
                }}
                play={(url) => startStream({url})}
                toggle={() => {
                  const next = !captions;
                  Storage.setItem('captions', String(next))
                    .then(() => setCaptions(next))
                    .catch((e) => say(String(e)));
                }}
                changeSeek={() => {
                  const next = seek === 30 ? 10 : seek + 10;
                  Storage.setItem('seek', String(next))
                    .then(() => setSeek(next))
                    .catch((e) => say(String(e)));
                }}
                openAccount={() => {
                  if (!key) {
                    go('Sign in');
                    return;
                  }
                  Storage.removeItem('account')
                    .then(() => {
                      setHistory([]);
                      setEpisodeHistory([]);
                      setRecords([]);
                      setEntry('');
                      search('');
                      setScope('guest');
                      setKey('');
                      go('Home');
                    })
                    .catch((e) => say(String(e)));
                }}
              />
            ) : page === 'Sign in' ? (
              <SignIn onSuccess={signed} back={back} />
            ) : !selected &&
              (page === 'Home' ||
                page === 'Discover' ||
                (page === 'Library' && !!key)) ? (
              <Board
                key={page}
                search={() => go('Search')}
                list={list}
                open={select}
                discover={page === 'Discover' || page === 'Library'}
                history={page === 'Home' ? history : undefined}
                resume={resume}
                historyError={page === 'Home' ? historyError : ''}
                records={records}
                startingGenre={startingGenre}
                spotlightId={spotlightId}
                repeatSpotlight={repeatSpotlight}
                trailer={openTrailer}
                toggleLibrary={
                  key
                    ? (m, add) =>
                        changeItem(m, (row) => {
                          row.removed = !add;
                          row.temp = false;
                          return true;
                        })
                    : undefined
                }
                dismiss={async (item) => {
                  const mark = {
                    ...item,
                    offset: 0,
                    newEpisodes: 0,
                    modified: Date.now(),
                    pendingSync: !!key,
                  };
                  await savePosition(scope, mark);
                  setHistory((prev) =>
                    prev.filter(
                      (r) => r.id !== item.id || r.type !== item.type,
                    ),
                  );
                  if (key) await syncPosition(scope, key, mark);
                }}
                saved={page === 'Library' ? cards : undefined}
              />
            ) : page === 'Calendar' && !selected ? (
              key ? (
                <Calendar
                  list={list}
                  account={key}
                  open={(m, id) => {
                    select(m);
                    setEpisode(id);
                  }}
                />
              ) : (
                <Choice
                  label="Sign in to view your calendar"
                  onPress={() => go('Sign in')}
                />
              )
            ) : selected ? (
              <TitleDetails
                accountKey={key}
                key={selected.id + ':' + episode}
                meta={meta || selected}
                episode={episode}
                streams={streams}
                progress={perEpisode.get(episode)}
                episodeHistory={perEpisode}
                record={records.find((r) => r._id === selected.id)}
                trailer={openTrailer}
                searchPerson={(name) => {
                  go('Search');
                  setEntry(name);
                  search(name);
                }}
                browseGenre={(genre) => {
                  go('Discover');
                  setStartingGenre({type: selected.type, genre});
                }}
                changeLibrary={
                  key ? (change) => changeItem(selected, change) : undefined
                }
                busy={busy}
                notice={notice}
                back={back}
                open={startStream}
                choose={setEpisode}
              />
            ) : (
              <ScrollView
                key={page}
                style={{flex: 1, padding: 24}}
                keyboardShouldPersistTaps="handled">
                <Text style={title}>{page}</Text>
                {notice ? <Text style={body}>{notice}</Text> : null}
                {page === 'Add-ons' ? (
                  <View>
                    {activeAddon ? (
                      <View>
                        <AddonCard
                          addon={activeAddon}
                          onPress={() => setActiveAddon(undefined)}
                        />
                        <Text style={body}>
                          {activeAddon.manifest.resources
                            ?.map((r) => (typeof r === 'string' ? r : r.name))
                            .join(' · ')}
                        </Text>
                        {key && !activeAddon.flags?.protected && (
                          <Choice
                            label={
                              list.some(
                                (a) =>
                                  a.transportUrl === activeAddon.transportUrl,
                              )
                                ? 'Uninstall add-on'
                                : 'Install add-on'
                            }
                            onPress={() => {
                              if (busy) return;
                              wait(true);
                              say('');
                              api
                                .saveAddon(
                                  key,
                                  activeAddon,
                                  !list.some(
                                    (a) =>
                                      a.transportUrl ===
                                      activeAddon.transportUrl,
                                  ),
                                )
                                .then((items) => {
                                  setList(items);
                                  setActiveAddon(undefined);
                                })
                                .catch(() =>
                                  say('Could not update your add-ons.'),
                                )
                                .finally(() => wait(false));
                            }}
                          />
                        )}
                        <Choice
                          label="Back"
                          onPress={() => setActiveAddon(undefined)}
                        />
                      </View>
                    ) : (
                      <AddonBrowser list={list} select={setActiveAddon} />
                    )}
                  </View>
                ) : (
                  <View>
                    {page === 'Search' ? (
                      <View style={{flexDirection: 'row'}}>
                        <TextInput
                          value={entry}
                          onChangeText={setEntry}
                          placeholder="Search or paste link"
                          placeholderTextColor="#aaa"
                          onSubmitEditing={submitSearch}
                          style={{
                            width: 350,
                            color: 'white',
                            fontSize: 24,
                            backgroundColor: '#29283e',
                            padding: 12,
                          }}
                        />
                        <Choice label="Search" onPress={submitSearch} />
                      </View>
                    ) : null}
                    {page === 'Search' &&
                      !query &&
                      searchHistory.length > 0 && (
                        <View>
                          <Text style={body}>Recent searches</Text>
                          {searchHistory.map((term) => (
                            <Choice
                              key={term}
                              label={term}
                              onPress={() => {
                                setEntry(term);
                                search(term);
                              }}
                            />
                          ))}
                          <Choice
                            label="Clear search history"
                            onPress={() => saveSearch([])}
                          />
                        </View>
                      )}
                    {page === 'Search' &&
                      groups.map((group) => (
                        <View key={group.url}>
                          <Text style={body}>{group.name}</Text>
                          <FlatList
                            horizontal
                            data={group.cards}
                            keyExtractor={(m) => m.type + ':' + m.id}
                            initialNumToRender={8}
                            renderItem={({item}) => (
                              <Poster
                                item={item}
                                open={select}
                                focus={() => {}}
                              />
                            )}
                          />
                        </View>
                      ))}
                    {page === 'Library' && !key ? (
                      <Choice label="Sign in" onPress={() => go('Sign in')} />
                    ) : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 15,
                      }}>
                      {cards.map((m) => (
                        <Poster
                          key={m.type + m.id}
                          item={m}
                          open={select}
                          focus={() => {}}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </>
      )}
    </View>
  );
}
