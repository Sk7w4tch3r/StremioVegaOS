import React, {useState} from 'react';
import {Pressable, View, Image, Text, ImageSourcePropType} from 'react-native';
import {dp, color} from './tv';
import type {Page} from '../App';
const nav: {page: Page; on: ImageSourcePropType; off: ImageSourcePropType}[] = [
  {
    page: 'Search',
    on: require('../assets/android-tv/search.png'),
    off: require('../assets/android-tv/search_outline.png'),
  },
  {
    page: 'Home',
    on: require('../assets/android-tv/home.png'),
    off: require('../assets/android-tv/home_outline.png'),
  },
  {
    page: 'Discover',
    on: require('../assets/android-tv/discover.png'),
    off: require('../assets/android-tv/discover_outline.png'),
  },
  {
    page: 'Library',
    on: require('../assets/android-tv/library.png'),
    off: require('../assets/android-tv/library_outline.png'),
  },
  {
    page: 'Calendar',
    on: require('../assets/android-tv/library.png'),
    off: require('../assets/android-tv/library_outline.png'),
  },
  {
    page: 'Add-ons',
    on: require('../assets/android-tv/addons.png'),
    off: require('../assets/android-tv/addons_outline.png'),
  },
  {
    page: 'Settings',
    on: require('../assets/android-tv/settings.png'),
    off: require('../assets/android-tv/settings_outline.png'),
  },
  {
    page: 'Sign in',
    on: require('../assets/android-tv/brand.png'),
    off: require('../assets/android-tv/brand.png'),
  },
];
export function Rail({
  active,
  signedIn,
  go,
}: {
  active: Page;
  signedIn: boolean;
  go: (page: Page) => void;
}) {
  const [focus, setFocus] = useState<Page | null>(null);
  return (
    <View style={{width: dp(43), zIndex: 2}}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: dp(focus ? 145 : 43),
          backgroundColor: color.primaryColor,
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          paddingLeft: dp(4),
          paddingTop: dp(10),
        }}>
        <Image
          resizeMode="contain"
          source={require('../assets/android-tv/brand.png')}
          style={{
            width: dp(20),
            height: dp(20),
            marginBottom: dp(18),
            marginLeft: dp(8),
          }}
        />
        {nav
          .filter((n) => n.page !== 'Sign in' || !signedIn)
          .map((n) => (
            <Pressable
              key={n.page}
              accessibilityLabel={n.page}
              accessibilityRole="button"
              onFocus={() => setFocus(n.page)}
              onBlur={() => setFocus(null)}
              onPress={() => go(n.page)}
              style={{
                height: dp(43),
                alignItems: 'center',
                flexDirection: 'row',
                paddingHorizontal: dp(10),
              }}>
              {n.page === 'Calendar' ? (
                <Text
                  style={{
                    width: dp(24),
                    fontSize: dp(19),
                    textAlign: 'center',
                    color:
                      focus === n.page || active === n.page
                        ? '#af94ff'
                        : 'white',
                  }}>
                  ▦
                </Text>
              ) : (
                <Image
                  resizeMode="contain"
                  source={active === n.page ? n.on : n.off}
                  style={{
                    width: dp(24),
                    height: dp(24),
                    tintColor:
                      focus === n.page
                        ? color.accentColorSecondary
                        : active === n.page
                        ? 'white'
                        : color.surface_light5_50,
                  }}
                />
              )}
              {focus ? (
                <Text
                  style={{
                    fontSize: dp(15),
                    marginLeft: dp(12),
                    color: n.page === focus ? 'white' : color.surface_light5_50,
                  }}>
                  {n.page}
                </Text>
              ) : null}
            </Pressable>
          ))}
      </View>
    </View>
  );
}
