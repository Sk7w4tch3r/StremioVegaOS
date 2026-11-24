import React, {useEffect, useState} from 'react';
import {View, Text, Image} from 'react-native';
import {linkCode, readCode} from '../api/stremio';
import {Choice} from '../components/Choice';
export function SignIn({
  onSuccess,
  back,
}: {
  onSuccess: (key: string) => Promise<void>;
  back: () => void;
}) {
  const [pair, setPair] = useState<Awaited<ReturnType<typeof linkCode>>>();
  const [message, setMessage] = useState('Getting a sign-in code…');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function pairTV() {
      try {
        const data = await linkCode();
        if (!live) return;
        setPair(data);
        setMessage('Open this link on your phone');
        const expires = Date.now() + 5 * 60 * 1000;
        const poll = async () => {
          try {
            const r = await readCode(data.code);
            if (!live) return;
            if (r.result?.authKey) {
              await onSuccess(r.result.authKey);
              return;
            }
            if (Date.now() > expires) {
              setMessage('Request a new code to continue.');
              return;
            }
            timer = setTimeout(poll, 2200);
          } catch (e) {
            if (live) setMessage(String(e));
          }
        };
        timer = setTimeout(poll, 2200);
      } catch (e) {
        if (live) setMessage(String(e));
      }
    }
    setPair(undefined);
    pairTV();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [attempt, onSuccess]);
  return (
    <View>
      <Text style={{color: 'white', fontSize: 32}}>Sign in to Stremio</Text>
      <Text style={{color: 'white', fontSize: 22}}>{message}</Text>
      {pair && (
        <View>
          {pair.qrcode ? (
            <Image
              style={{width: 180, height: 180, marginVertical: 12}}
              source={{uri: pair.qrcode}}
            />
          ) : null}
          <Text selectable style={{fontSize: 26, color: 'white'}}>
            {pair.link}
          </Text>
          <Text style={{fontSize: 40, color: 'white'}}>{pair.code}</Text>
        </View>
      )}
      <View style={{flexDirection: 'row'}}>
        <Choice first label="Back" onPress={back} />
        <Choice label="Get new code" onPress={() => retry((a) => a + 1)} />
      </View>
    </View>
  );
}
