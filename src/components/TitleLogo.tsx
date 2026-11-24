import React, {useState} from 'react';
import {Image, Text} from 'react-native';
import {dp} from './tv';
// Aspect-ratio sizing from stremio-web/src/components/Logo/Logo.less,
// using the image dimensions delivered by Vega instead of a browser canvas.
export function TitleLogo({
  uri,
  name,
  small = false,
}: {
  uri?: string;
  name: string;
  small?: boolean;
}) {
  const [metrics, setMetrics] = useState<{uri: string; ratio: number}>();
  const [failed, setFailed] = useState<string>();
  const ratio = metrics?.uri === uri && metrics ? metrics.ratio : 2.58;
  const height = Math.min(
    small ? 46 : 68,
    (small ? 187 : 226) / ratio,
    (small ? 80 : 115) / Math.sqrt(ratio),
  );
  if (!uri || failed === uri)
    return (
      <Text
        numberOfLines={2}
        style={{
          color: 'white',
          fontSize: dp(small ? 26 : 32),
          fontWeight: 'bold',
        }}>
        {name}
      </Text>
    );
  return (
    <Image
      accessibilityLabel={name}
      source={{uri}}
      resizeMode="contain"
      onError={() => setFailed(uri)}
      onLoad={(e) => {
        const {width, height} = e.nativeEvent.source || {};
        if (width > 0 && height > 0) setMetrics({uri, ratio: width / height});
      }}
      style={{
        alignSelf: 'flex-start',
        width: dp(height * ratio),
        height: dp(height),
      }}
    />
  );
}
