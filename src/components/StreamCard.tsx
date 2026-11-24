import React, {useState} from 'react';
import {Image, Pressable, Text, View} from 'react-native';
import type {Stream} from '../api/stremio';
import {dp, dim, color} from './tv';
// Theme.Stremio selects card_stream_item_large_layout for the default card.
export function StreamCard({
  stream,
  first,
  open,
}: {
  stream: Stream;
  first: boolean;
  open: () => void;
}) {
  const [focused, focus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      hasTVPreferredFocus={first}
      onFocus={() => focus(true)}
      onBlur={() => focus(false)}
      onPress={open}
      style={{
        width: dp(dim.streamCardWidth),
        height: dp(dim.streamCardHeight),
        paddingHorizontal: dp(dim.streamCardPadding),
        borderRadius: dp(dim.cardViewCornerRadius),
        marginRight: dp(dim.card_margin_end),
        borderWidth: dp(2),
        borderColor: focused ? 'white' : 'transparent',
        backgroundColor: color.secondaryColor,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <Text
        style={{
          width: dp(dim.stream_card_name_width),
          fontSize: dp(dim.stream_card_text_size),
          color: 'white',
          paddingLeft: dp(dim.stream_card_name_padding_start),
        }}>
        {stream.name}
      </Text>
      <Text
        numberOfLines={8}
        style={{
          flex: 1,
          fontSize: dp(dim.stream_card_text_size),
          color: color.surface_light5_90,
          paddingHorizontal: dp(dim.streamCardPadding),
        }}>
        {stream.description || stream.title}
      </Text>
      <View
        style={{
          width: dp(dim.stream_card_play_icon_radius),
          height: dp(dim.stream_card_play_icon_radius),
          borderRadius: dp(dim.stream_card_play_icon_radius / 2),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? color.accentColorSecondary : 'transparent',
        }}>
        <Image
          style={{width: dp(24), height: dp(24)}}
          source={require('../assets/android-tv/play.png')}
        />
      </View>
    </Pressable>
  );
}
