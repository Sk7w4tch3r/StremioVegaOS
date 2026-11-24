import React, {useState} from 'react';
import {View, Text, Image, Pressable} from 'react-native';
import layouts from '../assets/android-tv/layouts.json';
import type {Addon} from '../api/stremio';
import {dp, color, dim} from './tv';

// Bind the six image/text slots in the original card_addon_item layout.
type Layout = {attrs: Record<string, unknown>; children: Layout[]};
const layout: Layout = layouts.card_addon_item;
const row = layout.children[0],
  logo = row.children[0],
  info = row.children[2];
export function AddonCard({
  addon,
  onPress,
}: {
  addon: Addon;
  onPress: () => void;
}) {
  const [active, focus] = useState(false);
  const m = addon.manifest;
  return (
    <Pressable
      accessibilityRole="button"
      onFocus={() => focus(true)}
      onBlur={() => focus(false)}
      onPress={onPress}
      style={{
        width: dp(Number(layout.attrs.layout_width)),
        maxWidth: '100%',
        marginVertical: dp(4),
        backgroundColor: color.secondaryColor,
        borderRadius: dp(dim.cardViewCornerRadius),
        borderWidth: 2,
        borderColor: active ? 'white' : 'transparent',
      }}>
      <View
        style={{flexDirection: 'row', padding: dp(Number(row.attrs.padding))}}>
        <View
          style={{
            height: dp(Number(logo.attrs.layout_height)),
            width: dp(Number(logo.attrs.layout_width)),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {m.logo ? (
            <Image
              resizeMode="contain"
              style={{width: '100%', height: '100%'}}
              source={{uri: m.logo}}
            />
          ) : null}
        </View>
        <View
          style={{
            flex: 1,
            marginLeft: dp(Number(row.children[1].attrs.layout_width)),
          }}>
          <Text style={{fontSize: dp(20), color: 'white'}}>
            {m.name}{' '}
            <Text style={{fontSize: dp(12), color: color.surface_light5_50}}>
              {m.version} · Installed
            </Text>
          </Text>
          <Text
            numberOfLines={3}
            style={{
              fontSize: dp(Number(info.children[1].attrs.textSize)),
              color: color.surface_light5_90,
              marginVertical: dp(5),
            }}>
            {m.description}
          </Text>
          <Text style={{fontSize: dp(12), color: color.surface_light5_50}}>
            {m.types?.join(' · ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
