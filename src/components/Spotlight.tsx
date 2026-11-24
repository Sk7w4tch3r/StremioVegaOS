import React, {useEffect, useState} from 'react';
import {View, Text, Image, Pressable} from 'react-native';
import * as api from '../api/stremio';
import {TitleLogo} from './TitleLogo';
import {dp} from './tv';
import {PlayerControl, MenuItem} from './PlayerControl';
export function Spotlight({
  cards,
  records,
  trailer,
  toggleLibrary,
  open,
  search,
}: {
  cards: api.Meta[];
  records?: api.LibraryRecord[];
  trailer: (m: api.Meta) => Promise<void>;
  toggleLibrary?: (m: api.Meta, add: boolean) => Promise<void>;
  open: (m: api.Meta) => void;
  search: () => void;
}) {
  const [index, setIndex] = useState(0),
    [auto, setAuto] = useState(true),
    [focused, setFocused] = useState(''),
    [extra, setExtra] = useState<api.Meta>();
  const [actionError, setError] = useState('');
  const [pending, setPending] = useState(false);
  function action(run: () => Promise<void>) {
    if (pending) return;
    setError('');
    setPending(true);
    run()
      .catch(() => setError('Could not complete this action.'))
      .finally(() => setPending(false));
  }
  const size = Math.min(6, cards.length),
    item = cards[index % size],
    m = extra?.id === item?.id ? extra : item;
  useEffect(() => {
    let live = true;
    if (item && (!item.background || !item.logo || !item.trailerStreams))
      api
        .details(item)
        .then((result) => {
          if (live) setExtra(result);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [item]);
  useEffect(() => {
    if (size < 2 || !auto || focused) return;
    const t = setTimeout(() => setIndex((n) => (n + 1) % size), 10000);
    return () => clearTimeout(t);
  }, [index, auto, size, focused]);
  return (
    <View style={{height: dp(305), backgroundColor: '#131020'}}>
      {!!(m?.background || m?.poster) && (
        <Image
          source={{uri: m?.background || m?.poster}}
          style={{width: '100%', height: '100%', position: 'absolute'}}
          resizeMode="cover"
        />
      )}
      <Image
        source={require('../assets/player/backdrop.png')}
        resizeMode="stretch"
        style={{width: '100%', height: '100%', position: 'absolute'}}
      />
      <Pressable
        accessibilityRole="button"
        onFocus={() => setFocused('search')}
        onBlur={() => setFocused('')}
        onPress={search}
        style={{
          alignSelf: 'center',
          marginTop: dp(7),
          width: dp(210),
          borderRadius: dp(16),
          backgroundColor: 'rgba(39,35,47,0.7)',
          borderWidth: 1,
          borderColor: focused === 'search' ? 'white' : 'transparent',
          paddingHorizontal: dp(14),
          paddingVertical: dp(5),
        }}>
        <Text style={{color: '#ddd', fontSize: dp(11)}}>
          Search or paste link
        </Text>
      </Pressable>
      {!!m && (
        <View
          style={{
            position: 'absolute',
            bottom: dp(12),
            left: dp(14),
            width: '46%',
          }}>
          <TitleLogo uri={m.logo} name={m.name} small />
          <Text
            numberOfLines={1}
            style={{
              color: '#e9e6ed',
              fontSize: dp(11),
              fontWeight: 'bold',
              marginVertical: dp(6),
            }}>
            {[
              m.releaseInfo,
              m.runtime,
              m.imdbRating && 'IMDb ' + m.imdbRating,
              m.genres?.slice(0, 3).join(', '),
            ]
              .filter(Boolean)
              .join('     ')}
          </Text>
          <Text
            numberOfLines={3}
            style={{color: '#cec9d5', fontSize: dp(11), lineHeight: dp(15)}}>
            {m.description}
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Pressable
              onPress={() => open(m)}
              onFocus={() => setFocused('watch')}
              onBlur={() => setFocused('')}
              accessibilityRole="button"
              style={{
                alignSelf: 'flex-start',
                marginTop: dp(8),
                backgroundColor: '#654ab7',
                paddingHorizontal: dp(14),
                paddingVertical: dp(6),
                borderRadius: dp(16),
                borderWidth: 2,
                borderColor: focused === 'watch' ? 'white' : 'transparent',
              }}>
              <Text
                style={{color: 'white', fontWeight: 'bold', fontSize: dp(12)}}>
                ▶ Watch
              </Text>
            </Pressable>
            {toggleLibrary && (
              <MenuItem
                label={
                  records?.some((r) => r._id === m.id && !r.removed)
                    ? 'In library ✓'
                    : '+ Library'
                }
                onPress={() =>
                  action(() =>
                    toggleLibrary(
                      m,
                      !records?.some((r) => r._id === m.id && !r.removed),
                    ),
                  )
                }
              />
            )}
            {m.trailerStreams?.length || m.trailers?.length ? (
              <MenuItem
                label="Trailer"
                onPress={() => action(() => trailer(m))}
              />
            ) : null}
          </View>
          {!!actionError && <Text style={{color: 'white'}}>{actionError}</Text>}
        </View>
      )}
      {size > 1 && (
        <View
          style={{
            position: 'absolute',
            right: dp(8),
            bottom: dp(12),
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <PlayerControl
            icon="back"
            label="Previous title"
            onPress={() => setIndex((n) => (n - 1 + size) % size)}
          />
          {cards.slice(0, size).map((c, i) => (
            <View
              key={c.id}
              style={{
                marginHorizontal: 1,
                height: dp(2),
                width: dp(12),
                borderRadius: 2,
                backgroundColor: index % size === i ? 'white' : '#716b78',
              }}
            />
          ))}
          <PlayerControl
            icon="forward"
            label="Next title"
            onPress={() => setIndex((n) => (n + 1) % size)}
          />
          <PlayerControl
            icon={auto ? 'pause' : 'play'}
            label="Pause or resume spotlight"
            onPress={() => setAuto((v) => !v)}
          />
        </View>
      )}
    </View>
  );
}
