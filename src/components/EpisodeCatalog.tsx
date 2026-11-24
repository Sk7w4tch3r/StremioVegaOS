import React, {useMemo, useState} from 'react';
import {FlatList, Text, TextInput, View, Image} from 'react-native';
import {Meta} from '../api/stremio';
import {MenuItem, PlayerControl} from './PlayerControl';
import {dp} from './tv';

type Episode = NonNullable<Meta['videos']>[number];
const pageSize = 12;
export function EpisodeCatalog({
  videos,
  currentId,
  watched,
  progress,
  episodeHistory,
  choose,
}: {
  videos: Episode[];
  currentId?: string;
  watched?: Set<string>;
  progress?: {videoId: string; duration: number; offset: number};
  episodeHistory?: ReadonlyMap<
    string,
    {videoId: string; duration: number; offset: number}
  >;
  choose: (id: string) => void;
}) {
  const seasons = useMemo(
    () =>
      Array.from(new Set(videos.map((v) => v.season ?? 1))).sort(
        (a, b) => a - b,
      ),
    [videos],
  );
  const current = videos.find((v) => v.id === currentId);
  const [selected, setSelected] = useState<number>();
  const season =
    selected ?? current?.season ?? (seasons.includes(1) ? 1 : seasons[0]);
  const [query, search] = useState('');
  const term = query.trim().toLowerCase();
  const episodes = useMemo(
    () =>
      videos
        .filter((v) =>
          term
            ? [v.title, 'S' + (v.season ?? 1) + 'E' + v.episode].some((value) =>
                value.toLowerCase().includes(term),
              )
            : (v.season ?? 1) === season,
        )
        .sort(
          (a, b) =>
            (a.season ?? 1) - (b.season ?? 1) ||
            (a.episode ?? 0) - (b.episode ?? 0),
        ),
    [videos, season, term],
  );
  const [chosenPage, setPage] = useState<number>();
  const lastPage = Math.max(0, Math.ceil(episodes.length / pageSize) - 1);
  const page = Math.min(
    chosenPage ??
      Math.max(
        0,
        Math.floor(episodes.findIndex((v) => v.id === currentId) / pageSize),
      ),
    lastPage,
  );
  const [picking, setPicking] = useState(false);
  function changeSeason(n: number) {
    search('');
    setSelected(n);
    setPage(0);
    setPicking(false);
  }
  const idx = seasons.indexOf(season);
  const seasonName = (n: number) => (n === 0 ? 'Specials' : 'Season ' + n);
  if (!videos.length)
    return (
      <Text style={{color: '#ccc', padding: dp(8)}}>
        No episodes available.
      </Text>
    );
  return (
    <View style={{flex: 1}}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        {idx > 0 ? (
          <PlayerControl
            icon="back"
            label="Previous season"
            onPress={() => changeSeason(seasons[idx - 1])}
          />
        ) : (
          <View style={{width: dp(32)}} />
        )}
        <MenuItem
          key={season}
          first
          label={seasonName(season) + '   ▾'}
          onPress={() => setPicking(!picking)}
        />
        {idx < seasons.length - 1 ? (
          <PlayerControl
            icon="forward"
            label="Next season"
            onPress={() => changeSeason(seasons[idx + 1])}
          />
        ) : (
          <View style={{width: dp(32)}} />
        )}
      </View>
      <TextInput
        value={query}
        onChangeText={(value) => {
          search(value);
          setPage(0);
          setPicking(false);
        }}
        placeholder="Search all episodes"
        accessibilityLabel="Search all episodes"
        placeholderTextColor="#bbb"
        style={{
          color: 'white',
          backgroundColor: '#302a39',
          fontSize: dp(12),
          padding: dp(6),
        }}
      />
      {picking ? (
        <FlatList
          key="seasons"
          data={seasons}
          keyExtractor={String}
          renderItem={({item}) => (
            <MenuItem
              label={seasonName(item)}
              onPress={() => changeSeason(item)}
            />
          )}
        />
      ) : (
        <>
          {lastPage > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              {page > 0 ? (
                <PlayerControl
                  icon="back"
                  label="Previous episode page"
                  onPress={() => setPage(page - 1)}
                />
              ) : (
                <View style={{width: dp(32)}} />
              )}
              <Text style={{color: '#ddd', fontSize: dp(11)}}>
                Page {page + 1} of {lastPage + 1}
              </Text>
              {page < lastPage ? (
                <PlayerControl
                  icon="forward"
                  label="Next episode page"
                  onPress={() => setPage(page + 1)}
                />
              ) : (
                <View style={{width: dp(32)}} />
              )}
            </View>
          )}
          <FlatList
            ListEmptyComponent={
              <Text style={{color: 'white', padding: dp(8)}}>
                No matching episodes
              </Text>
            }
            key={season + ':' + page}
            data={episodes.slice(page * pageSize, (page + 1) * pageSize)}
            keyExtractor={(v) => v.id}
            renderItem={({item, index}) => {
              const position = episodeHistory?.get(item.id) ?? progress;
              return (
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  {!!item.thumbnail && (
                    <Image
                      source={{uri: item.thumbnail}}
                      resizeMode="cover"
                      style={{
                        width: dp(48),
                        height: dp(30),
                        borderRadius: dp(3),
                      }}
                    />
                  )}
                  <View style={{flex: 1}}>
                    <MenuItem
                      label={
                        (item.id === currentId ? '▶  ' : '') +
                        (watched?.has(item.id) ? '✓  ' : '') +
                        (term ? 'S' + (item.season ?? 1) + ' E' : '') +
                        (item.episode ?? page * pageSize + index + 1) +
                        '.  ' +
                        item.title
                      }
                      detail={[
                        item.released &&
                        Number.isFinite(Date.parse(item.released))
                          ? new Date(item.released).toLocaleDateString()
                          : '',
                        position &&
                        position.videoId === item.id &&
                        position.duration > position.offset &&
                        position.offset > 0
                          ? Math.ceil(
                              (position.duration - position.offset) / 60,
                            ) + ' min left'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onPress={() => choose(item.id)}
                    />
                  </View>
                </View>
              );
            }}
          />
        </>
      )}
    </View>
  );
}
