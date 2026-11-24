import React, {useState} from 'react';
import {Pressable, Text, Image} from 'react-native';
export function Choice({
  label,
  poster,
  first,
  wide,
  onPress,
}: {
  label: string;
  poster?: string;
  first?: boolean;
  wide?: boolean;
  onPress: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={first}
      onPress={onPress}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        margin: 5,
        padding: 10,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: focus ? 'white' : 'transparent',
        backgroundColor: focus ? '#6547bb' : '#222238',
        ...(wide ? {width: 280, minHeight: 95} : poster ? {width: 150} : {}),
      }}>
      {poster ? (
        <Image
          resizeMode="cover"
          style={{height: 180, width: 124}}
          source={{uri: poster}}
        />
      ) : null}
      <Text numberOfLines={wide ? 4 : 2} style={{fontSize: 19, color: 'white'}}>
        {label}
      </Text>
    </Pressable>
  );
}
