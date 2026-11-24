import React, {useState} from 'react';
import {Pressable, Text, Image, StyleSheet, View} from 'react-native';
import {dp, dim, color} from './tv';
import type {Meta} from '../api/stremio';
export function Poster({
  item,
  focus,
  open,
  longPress,
  first = false,
  progress,
  compact,
  newEpisodes,
}: {
  item: Meta;
  focus: (m: Meta) => void;
  open: (m: Meta) => void;
  longPress?: () => void;
  first?: boolean;
  progress?: number;
  compact?: boolean;
  newEpisodes?: number;
}) {
  const [active, setActive] = useState(false);
  return (
    <View style={compact ? {width: dp(90), marginRight: dp(9)} : undefined}>
      <Pressable
        hasTVPreferredFocus={first}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        onLongPress={longPress}
        onPress={() => open(item)}
        onFocus={() => {
          setActive(true);
          focus(item);
        }}
        onBlur={() => setActive(false)}
        style={[
          styles.poster,
          compact && {width: dp(90), height: dp(135), marginRight: 0},
          active && styles.active,
        ]}>
        {item.poster ? (
          <Image
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            source={{uri: item.poster}}
          />
        ) : (
          <Text style={styles.name}>{item.name}</Text>
        )}
        {!!newEpisodes && (
          <Text
            style={{
              position: 'absolute',
              top: dp(6),
              right: dp(4),
              paddingHorizontal: dp(4),
              backgroundColor: 'white',
              color: '#6549a7',
              borderRadius: dp(4),
              fontSize: dp(9),
              fontWeight: 'bold',
            }}>
            +{newEpisodes}
          </Text>
        )}
        {progress !== undefined && Number.isFinite(progress) && (
          <View
            style={{
              position: 'absolute',
              bottom: dp(5),
              left: dp(4),
              right: dp(4),
              height: dp(4),
              backgroundColor: '#333',
            }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                backgroundColor: '#fff',
              }}
            />
          </View>
        )}
      </Pressable>
      {compact && (
        <Text
          numberOfLines={1}
          style={{
            color: 'white',
            textAlign: 'center',
            fontSize: dp(10),
            fontWeight: 'bold',
            marginTop: dp(6),
          }}>
          {item.name}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  poster: {
    width: dp(dim.meta_poster_size),
    height: dp(dim.meta_poster_size * 1.5),
    borderRadius: dp(dim.cardViewCornerRadius),
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: color.secondaryColor,
    overflow: 'hidden',
    marginRight: dp(dim.card_margin_end),
  },
  active: {borderColor: 'white'},
  name: {color: 'white', fontSize: 20, padding: 6},
});
