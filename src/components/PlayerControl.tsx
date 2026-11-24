import React, {useState} from 'react';
import {Image, Pressable, Text, View} from 'react-native';
import {dp} from './tv';
// Stremio Android TV 1.10.4 drawable resources, with the button proportions
// from stremio-web/src/routes/Player/ControlBar/styles.less.
const icons = {
  play: require('../assets/player/play.png'),
  pause: require('../assets/player/pause.png'),
  next: require('../assets/player/next.png'),
  sound: require('../assets/player/volume_high.png'),
  mute: require('../assets/player/volume_mute.png'),
  speed: require('../assets/player/speed.png'),
  captions: require('../assets/player/subtitles.png'),
  audio: require('../assets/player/audio_tracks.png'),
  more: require('../assets/player/more_horizontal.png'),
  fit: require('../assets/player/minimize.png'),
  fill: require('../assets/player/maximize.png'),
  back: require('../assets/player/chevron_back.png'),
  forward: require('../assets/player/chevron_forward.png'),
  streams: require('../assets/player/list.png'),
  episodes: require('../assets/player/series.png'),
};
export function PlayerControl({
  icon,
  label,
  onPress,
  first,
  onFocus,
}: {
  icon: keyof typeof icons;
  label: string;
  onPress: () => void;
  first?: boolean;
  onFocus?: () => void;
}) {
  const [focus, set] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hasTVPreferredFocus={first}
      onPress={onPress}
      onFocus={() => {
        set(true);
        onFocus?.();
      }}
      onBlur={() => set(false)}
      style={{
        width: dp(32),
        height: dp(31),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focus ? '#36323e' : 'transparent',
        borderRadius: dp(5),
      }}>
      <Image
        source={icons[icon]}
        resizeMode="contain"
        style={{width: dp(19), height: dp(19)}}
      />
      {focus && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            width: dp(12),
            height: dp(2),
            backgroundColor: '#a88bff',
          }}
        />
      )}
    </Pressable>
  );
}
export function MenuItem({
  label,
  onPress,
  first,
  detail,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
  detail?: string;
}) {
  const [focus, set] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      hasTVPreferredFocus={first}
      onFocus={() => set(true)}
      onBlur={() => set(false)}
      onPress={onPress}
      style={{
        padding: dp(8),
        borderRadius: dp(5),
        backgroundColor: focus ? '#484051' : 'transparent',
        borderWidth: 1,
        borderColor: focus ? 'white' : 'transparent',
      }}>
      <Text style={{color: 'white', fontSize: dp(12), fontWeight: '600'}}>
        {label}
      </Text>
      {!!detail && (
        <Text
          numberOfLines={4}
          style={{color: '#c4bccb', fontSize: dp(10), marginTop: dp(3)}}>
          {detail}
        </Text>
      )}
    </Pressable>
  );
}
