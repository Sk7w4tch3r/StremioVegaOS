import React, {useMemo} from 'react';
import {Image, Text, View} from 'react-native';
import qrcode from 'qrcode-generator';
import {dp} from './tv';
export function ShareCode({url}: {url: string}) {
  const uri = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createDataURL(6, 24);
    } catch {
      return undefined;
    }
  }, [url]);
  return (
    <View style={{alignItems: 'center', padding: dp(8)}}>
      {uri && (
        <Image
          accessibilityLabel="Scan to open on your phone"
          source={{uri}}
          style={{height: dp(155), width: dp(155)}}
        />
      )}
      <Text
        selectable
        style={{color: 'white', fontSize: dp(11), marginTop: dp(5)}}>
        {url}
      </Text>
    </View>
  );
}
