import React from 'react';
import {Image, View, Text} from 'react-native';
import type {Meta} from '../api/stremio';
import {dp, dim, color} from './tv';
export function Hero({
  item,
  details = false,
}: {
  item?: Meta;
  details?: boolean;
}) {
  if (!item)
    return <View style={{height: dp(dim.meta_preview_fragment_height)}} />;
  const facts = [
    item.runtime,
    item.releaseInfo,
    item.imdbRating ? 'IMDb ' + item.imdbRating : '',
    item.genres?.join(', '),
  ].filter(Boolean);
  return (
    <View
      style={{
        height: dp(dim.meta_preview_fragment_height),
        backgroundColor: color.primaryColor,
      }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: '70%',
        }}>
        {item.background ? (
          <Image
            resizeMode="cover"
            style={{width: '100%', height: '100%'}}
            source={{uri: item.background}}
          />
        ) : null}
        <Image
          resizeMode="stretch"
          style={{position: 'absolute', width: '100%', height: '100%'}}
          source={require('../assets/tv-background-fade.png')}
        />
      </View>
      <View
        style={{
          width: '50%',
          paddingTop: dp(dim.content_padding_start),
          paddingLeft: dp(dim.content_padding_start),
          paddingRight: dp(dim.meta_preview_frame_margin),
        }}>
        {details && item.logo ? (
          <Image
            resizeMode="contain"
            style={{
              width: dp(dim.meta_details_logo_width),
              height: dp(dim.meta_details_logo_height),
            }}
            source={{uri: item.logo}}
          />
        ) : (
          <Text
            numberOfLines={1}
            style={{fontSize: dp(26), fontWeight: 'bold', color: 'white'}}>
            {item.name}
          </Text>
        )}
        <Text
          numberOfLines={1}
          style={{
            fontSize: dp(dim.meta_preview_small_text),
            color: color.surface_light5_90,
            marginTop: dp(dim.meta_preview_row_spacing),
          }}>
          {facts.join('     ')}
        </Text>
        <Text
          numberOfLines={4}
          style={{
            fontSize: dp(dim.meta_preview_large_text),
            color: 'white',
            marginTop: dp(dim.meta_preview_row_spacing),
          }}>
          {item.description}
        </Text>
        {item.cast?.length ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: dp(dim.meta_preview_small_text),
              color: color.surface_light5_50,
              marginTop: dp(dim.meta_preview_row_spacing),
            }}>
            {item.cast.join(', ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
