import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, FlatList, BackHandler} from 'react-native';
import type {ResumeTitle} from '../api/history';
import * as api from '../api/stremio';
import {dp, dim} from '../components/tv';
import {useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {CatalogGrid} from '../components/CatalogGrid';
import {MenuItem} from '../components/PlayerControl';
import {Choice} from '../components/Choice';
import {Spotlight} from '../components/Spotlight';
import {Hero} from '../components/Hero';
import {Poster} from '../components/Poster';
export function Board({
  list,
  open,
  discover = false,
  saved,
  startingGenre,
  spotlightId,
  repeatSpotlight,
  trailer,
  toggleLibrary,
  records,
  dismiss,
  history = [],
  resume,
  historyError,
  search,
}: {
  list: api.Addon[];
  open: (m: api.Meta) => void;
  discover?: boolean;
  saved?: api.Meta[];
  spotlightId?: string;
  repeatSpotlight?: boolean;
  startingGenre?: {type: string; genre: string};
  trailer: (m: api.Meta) => Promise<void>;
  toggleLibrary?: (m: api.Meta, add: boolean) => Promise<void>;
  records?: api.LibraryRecord[];
  dismiss?: (item: ResumeTitle) => Promise<void>;
  history?: ResumeTitle[];
  resume?: (item: ResumeTitle) => void;
  historyError?: string;
  search: () => void;
}) {
  const [rows, setRows] = useState<
    {
      key: string;
      name: string;
      cards: api.Meta[];
      type?: string;
      genres?: string[];
      catalogId?: string;
      paged?: boolean;
    }[]
  >([]);
  const [selected, focus] = useState<api.Meta>();
  const [message, setMessage] = useState('Loading catalogs…');

  const [filter, setFilter] = useState(0);
  const [type, setType] = useState(startingGenre?.type || '');
  const [genre, setGenre] = useState(startingGenre?.genre || '');
  const [genreCards, setGenreCards] = useState<api.Meta[]>([]);
  const [genreMessage, setGenreMessage] = useState('');
  const [choosingGenre, showGenres] = useState(false);
  const available = type ? rows.filter((row) => row.type === type) : rows;
  const chosen = available[filter % (available.length || 1)];
  useEffect(() => {
    let live = true;
    if (!chosen || !genre || !chosen.genres?.includes(genre)) return;
    setGenreCards([]);
    setGenreMessage('Loading…');
    api
      .loadCatalog({
        url: chosen.key.replace(
          /\.json$/,
          '/genre=' + encodeURIComponent(genre) + '.json',
        ),
      })
      .then((cards) => {
        if (live) {
          setGenreCards(cards);
          setGenreMessage(cards.length ? '' : 'No matching titles.');
        }
      })
      .catch(() => {
        if (live) setGenreMessage('Could not load this genre.');
      });
    return () => {
      live = false;
    };
  }, [chosen, genre]);
  const activeRow =
    genre && chosen?.genres?.includes(genre)
      ? {...chosen, cards: genreCards}
      : chosen;
  const [all, setAll] = useState<string>();
  const [context, setContext] = useState<ResumeTitle>();
  const [sort, setSort] = useState(0);
  const sorts = [
    'Last watched',
    'A–Z',
    'Z–A',
    'Most watched',
    'Watched',
    'Not watched',
  ];
  useEffect(() => {
    if (!all && !context && !choosingGenre) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (choosingGenre) showGenres(false);
      else if (context) setContext(undefined);
      else setAll(undefined);
      return true;
    });
    return () => listener.remove();
  }, [context, all, choosingGenre]);
  useEffect(() => {
    let live = true;
    setRows([]);
    focus(undefined);

    setMessage('Loading catalogs…');
    if (saved) {
      const byId = new Map(records?.map((r) => [r._id, r.state]));
      const sorted = [...saved].filter((m) =>
        sort === 4
          ? !!byId.get(m.id)?.timesWatched
          : sort === 5
          ? !byId.get(m.id)?.timesWatched
          : true,
      );
      sorted.sort((a, b) => {
        if (sort === 1 || sort === 2)
          return a.name.localeCompare(b.name) * (sort === 1 ? 1 : -1);
        if (sort === 3)
          return (
            (byId.get(b.id)?.timesWatched || 0) -
            (byId.get(a.id)?.timesWatched || 0)
          );
        return (
          (Date.parse(byId.get(b.id)?.lastWatched || '') || 0) -
          (Date.parse(byId.get(a.id)?.lastWatched || '') || 0)
        );
      });
      const groups = Array.from(new Set(sorted.map((m) => m.type))).map(
        (type) => ({
          key: type,
          name:
            type === 'series' ? 'Series' : type === 'movie' ? 'Movies' : type,
          cards: sorted.filter((m) => m.type === type),
        }),
      );
      setRows(groups);
      focus(sorted[0]);
      setMessage(sorted.length ? '' : 'No titles in this view.');
      return;
    }
    const entries = api.catalogs(list);
    (async () => {
      let loaded = 0;
      for (let i = 0; i < entries.length && live; i += 3) {
        const slice = await Promise.all(
          entries.slice(i, i + 3).map(async (c) => {
            try {
              const cards = await api.loadCatalog(c);
              return cards.length
                ? {
                    key: c.url,
                    catalogId: c.catalogId,
                    paged: c.paged,
                    name: c.name,
                    cards,
                    type: c.type,
                    genres: c.genres,
                  }
                : null;
            } catch {
              return null;
            }
          }),
        );
        if (!live) return;
        const valid = slice.filter((x) => x !== null);
        loaded += valid.length;
        setRows((prev) => prev.concat(valid));
        if (valid.length) focus((prev) => prev || valid[0].cards[0]);
      }
      if (live) setMessage(loaded ? '' : 'No catalogs are available.');
    })();
    return () => {
      live = false;
    };
  }, [list, saved, records, sort]);
  const spotlight = rows.find((r) => r.catalogId === spotlightId) || rows[0];
  const homeRows =
    !discover && repeatSpotlight === false && spotlightId !== 'off'
      ? rows.filter((row) => row !== spotlight)
      : rows;
  const [focusedResume, setFocusedResume] = useState<ResumeTitle>();
  const resumeItem =
    history.find(
      (r) => r.id === focusedResume?.id && r.type === focusedResume?.type,
    ) || history[0];
  useTVEventHandler(
    useCallback(
      (event) => {
        if (
          !context &&
          !all &&
          event.eventKeyAction !== 1 &&
          event.eventType === 'menu' &&
          resumeItem &&
          selected?.id === resumeItem.id
        )
          setContext(resumeItem);
      },
      [context, all, resumeItem, selected],
    ),
  );
  const displayRows = history.length
    ? [
        {key: 'continue-watching', name: 'Continue Watching', cards: history},
        ...homeRows,
      ]
    : homeRows;
  const render = useCallback(
    ({item, index}: {item: (typeof rows)[number]; index: number}) => (
      <View style={{marginBottom: 15}}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <Text
            style={{
              fontSize: dp(dim.catalog_header_text_size),
              color: 'white',
              marginLeft: dp(discover ? dim.content_padding_start : 14),
              marginBottom: 7,
            }}>
            {item.name}
          </Text>
          <View style={{flexDirection: 'row'}}>
            {item.key === 'continue-watching' && resumeItem && (
              <MenuItem
                label="Options"
                onPress={() => setContext(resumeItem)}
              />
            )}
            <MenuItem label="See all  ›" onPress={() => setAll(item.key)} />
          </View>
        </View>
        <FlatList
          horizontal
          data={item.cards}
          keyExtractor={(m) => m.type + ':' + m.id}
          initialNumToRender={9}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: dp(discover ? dim.content_padding_start : 14),
          }}
          renderItem={({item: m, index: card}) => (
            <Poster
              compact={!discover}
              longPress={
                item.key === 'continue-watching'
                  ? () => setContext(m as ResumeTitle)
                  : undefined
              }
              newEpisodes={
                item.key === 'continue-watching'
                  ? (m as ResumeTitle).newEpisodes
                  : undefined
              }
              item={m}
              first={!discover && index === 0 && card === 0}
              open={
                item.key === 'continue-watching' && resume
                  ? (m) => resume(m as ResumeTitle)
                  : open
              }
              progress={
                item.key === 'continue-watching'
                  ? (m as ResumeTitle).offset / (m as ResumeTitle).duration
                  : undefined
              }
              focus={(v) => {
                focus(v);
                if (item.key === 'continue-watching')
                  setFocusedResume(v as ResumeTitle);
              }}
            />
          )}
        />
      </View>
    ),
    [open, discover, resume, resumeItem],
  );
  const grid =
    activeRow?.key === all && activeRow
      ? activeRow
      : displayRows.find((row) => row.key === all);
  if (choosingGenre && chosen)
    return (
      <FlatList
        data={['', ...(chosen.genres || [])]}
        keyExtractor={(g) => g || 'all'}
        renderItem={({item}) => (
          <MenuItem
            label={item || 'All genres'}
            onPress={() => {
              setGenre(item);
              showGenres(false);
            }}
          />
        )}
      />
    );
  if (context)
    return (
      <View style={{padding: dp(24)}}>
        <Text style={{color: 'white', fontSize: dp(20)}}>{context.name}</Text>
        <Choice
          first
          label="Resume"
          onPress={() => {
            setContext(undefined);
            resume?.(context);
          }}
        />
        <Choice
          label="Dismiss from Continue Watching"
          onPress={() => {
            dismiss?.(context).catch(() =>
              setMessage('Could not sync dismissal to your account.'),
            );
            setContext(undefined);
          }}
        />
        <Choice label="Back" onPress={() => setContext(undefined)} />
      </View>
    );
  if (grid)
    return (
      <CatalogGrid
        key={grid.key + '|' + genre}
        name={grid.name}
        cards={grid.cards}
        back={() => setAll(undefined)}
        genre={genre}
        base={'paged' in grid && grid.paged ? grid.key : undefined}
        open={
          grid.key === 'continue-watching' && resume
            ? (m) => resume(m as ResumeTitle)
            : open
        }
        options={
          grid.key === 'continue-watching'
            ? (m) => setContext(m as ResumeTitle)
            : undefined
        }
      />
    );
  return (
    <View style={{flex: 1}}>
      {saved && (
        <Choice
          label={'Sort · ' + sorts[sort]}
          onPress={() => setSort((n) => (n + 1) % sorts.length)}
        />
      )}
      {discover && <Hero item={selected} />}
      {historyError ? (
        <Text style={{color: 'white', marginLeft: 20}}>{historyError}</Text>
      ) : null}
      {!displayRows.length ? (
        <Text style={{fontSize: 22, color: 'white', margin: 20}}>
          {message}
        </Text>
      ) : null}
      <View
        style={{
          flex: 1,
          marginTop: discover ? dp(dim.meta_preview_content_overlap) : 0,
        }}>
        {discover && rows.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: dp(dim.content_padding_start),
            }}>
            {!saved && (
              <MenuItem
                label={type || 'All types'}
                onPress={() => {
                  setType(
                    type === '' ? 'movie' : type === 'movie' ? 'series' : '',
                  );
                  setFilter(0);
                  setGenre('');
                }}
              />
            )}
            {available.length > 1 && (
              <MenuItem
                label="‹"
                onPress={() => {
                  setFilter(
                    (v) => (v - 1 + available.length) % available.length,
                  );
                  setGenre('');
                }}
              />
            )}
            {chosen && (
              <MenuItem
                label={chosen.name + '  ›'}
                onPress={() => {
                  setFilter((v) => (v + 1) % available.length);
                  setGenre('');
                }}
              />
            )}
            {!!chosen?.genres?.length && (
              <MenuItem
                label={genre || 'All genres'}
                onPress={() => showGenres(true)}
              />
            )}
          </View>
        ) : null}
        {genre && !!genreMessage && (
          <Text style={{color: 'white'}}>{genreMessage}</Text>
        )}
        <FlatList
          data={discover ? (activeRow ? [activeRow] : []) : displayRows}
          ListHeaderComponent={
            discover || spotlightId === 'off' ? undefined : (
              <Spotlight
                cards={spotlight?.cards || []}
                records={records}
                trailer={trailer}
                toggleLibrary={toggleLibrary}
                open={open}
                search={search}
              />
            )
          }
          renderItem={render}
          keyExtractor={(r) => r.key}
          initialNumToRender={3}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}
