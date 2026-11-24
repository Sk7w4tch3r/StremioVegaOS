import React, {useState} from 'react';
import {Text, View, Image, Pressable, FlatList} from 'react-native';
import {type Meta} from '../api/stremio';
import {dp, dim, color} from '../components/tv';
import {Choice} from '../components/Choice';
type Video = NonNullable<Meta['videos']>[number];
function Episode({video, open}: {video: Video; open: (id: string) => void}) {
  const [focused, focus] = useState(false);
  return (
    <Pressable
      onPress={() => open(video.id)}
      onFocus={() => focus(true)}
      onBlur={() => focus(false)}
      style={{
        width: dp((dim.meta_poster_size * 16) / 9),
        marginRight: dp(dim.card_margin_end),
      }}>
      <View
        style={{
          height: dp(dim.meta_poster_size),
          borderRadius: dp(dim.cardViewCornerRadius),
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: focused ? 'white' : 'transparent',
          backgroundColor: color.secondaryColor,
        }}>
        {video.thumbnail ? (
          <Image
            style={{width: '100%', height: '100%'}}
            source={{uri: video.thumbnail}}
          />
        ) : null}
        <Text
          style={{
            position: 'absolute',
            top: 5,
            right: 6,
            color: 'white',
            backgroundColor: color.secondaryColor,
            padding: 4,
          }}>
          E{video.episode ?? '–'}
        </Text>
      </View>
      <Text numberOfLines={1} style={{color: 'white', fontSize: dp(13)}}>
        {video.title}
      </Text>
    </Pressable>
  );
}
export function Episodes({
  videos,
  open,
}: {
  videos: Video[];
  open: (id: string) => void;
}) {
  const seasons = Array.from(new Set(videos.map((v) => v.season ?? 1))).sort(
    (a, b) => a - b,
  );
  const [season, choose] = useState(seasons.includes(1) ? 1 : seasons[0]);
  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row'}}>
        <FlatList
          horizontal
          data={seasons}
          keyExtractor={String}
          renderItem={({item}) => (
            <Choice label={'Season ' + item} onPress={() => choose(item)} />
          )}
        />
      </View>
      <FlatList
        key={season}
        horizontal
        data={videos.filter((v) => (v.season ?? 1) === season)}
        keyExtractor={(v) => v.id}
        renderItem={({item}) => <Episode video={item} open={open} />}
      />
    </View>
  );
}
