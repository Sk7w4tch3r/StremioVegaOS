import React, {useState} from 'react';
import {Text, TextInput, View, ScrollView} from 'react-native';
import {languages, languageName} from '../api/languages';
import {Choice} from '../components/Choice';
import {dp, color} from '../components/tv';
export function Settings({
  catalogs,
  spotlightId,
  repeatSpotlight,
  setSpotlight,
  toggleRepeat,
  audioLanguage,
  subtitleLanguage,
  chooseLanguage,
  countdown,
  changeCountdown,
  captions,
  toggle,
  seek,
  changeSeek,
  account,
  openAccount,
  play,
}: {
  catalogs: {catalogId: string; name: string}[];
  spotlightId: string;
  repeatSpotlight: boolean;
  setSpotlight: (id: string) => void;
  toggleRepeat: () => void;
  audioLanguage: string;
  subtitleLanguage: string;
  chooseLanguage: (
    key: 'audioLanguage' | 'subtitleLanguage',
    code: string,
  ) => Promise<void>;
  countdown: number;
  changeCountdown: () => void;
  captions: boolean;
  toggle: () => void;
  seek: number;
  changeSeek: () => void;
  account: boolean;
  openAccount: () => void;
  play: (url: string) => void;
}) {
  const [pick, setPick] = useState<'audioLanguage' | 'subtitleLanguage'>();
  const [home, showHome] = useState(false);
  const [help, showHelp] = useState(false);
  const [showInput, show] = useState(false),
    [url, setUrl] = useState(''),
    [message, say] = useState('');
  function submit() {
    const value = url.trim();
    if (/^(https?:\/\/|magnet:\?xt=)/i.test(value)) {
      say('');
      play(value);
    } else say('Enter a video URL or magnet link.');
  }
  return (
    <ScrollView
      contentContainerStyle={{padding: dp(24), alignItems: 'flex-start'}}>
      <Text style={{color: 'white', fontSize: dp(26)}}>Settings</Text>
      <Choice
        first
        label={account ? 'Sign out' : 'Sign in'}
        onPress={openAccount}
      />
      <Choice
        label={'Subtitles  ·  ' + (captions ? 'On' : 'Off')}
        onPress={toggle}
      />
      <Choice
        label={'Seek duration  ·  ' + seek + ' seconds'}
        onPress={changeSeek}
      />
      <Choice
        label={
          'Next episode  ·  ' +
          (countdown ? countdown + '-second countdown' : 'Off')
        }
        onPress={changeCountdown}
      />
      <Choice label="Play URL/Magnet link" onPress={() => show((v) => !v)} />
      {showInput ? (
        <View>
          <TextInput
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={submit}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Video URL or magnet link"
            placeholderTextColor="#aaa"
            style={{
              width: dp(480),
              color: 'white',
              backgroundColor: color.secondaryColor,
              fontSize: dp(15),
              padding: dp(10),
            }}
          />
          <Choice label="Play" onPress={submit} />
          <Text style={{color: 'white'}}>{message}</Text>
        </View>
      ) : null}
      <Choice
        label={'Audio language · ' + languageName(audioLanguage)}
        onPress={() =>
          setPick(pick === 'audioLanguage' ? undefined : 'audioLanguage')
        }
      />
      <Choice
        label={'Subtitle language · ' + languageName(subtitleLanguage)}
        onPress={() =>
          setPick(pick === 'subtitleLanguage' ? undefined : 'subtitleLanguage')
        }
      />
      {pick && (
        <View>
          {languages.map(([name, code]) => (
            <Choice
              key={name}
              label={name}
              onPress={() =>
                chooseLanguage(pick, code)
                  .then(() => setPick(undefined))
                  .catch(() => say('Could not save language.'))
              }
            />
          ))}
        </View>
      )}
      <Choice label="Home screen" onPress={() => showHome((v) => !v)} />
      {home && (
        <View>
          <Text style={{color: 'white'}}>Spotlight catalog</Text>
          {[
            {catalogId: '', name: 'Automatic'},
            {catalogId: 'off', name: 'Hide Spotlight'},
            ...catalogs,
          ].map((c) => (
            <Choice
              key={c.catalogId}
              label={(c.catalogId === spotlightId ? '✓  ' : '') + c.name}
              onPress={() => setSpotlight(c.catalogId)}
            />
          ))}
          <Choice
            label={
              'Repeat Spotlight catalog on Home · ' +
              (repeatSpotlight ? 'On' : 'Off')
            }
            onPress={toggleRepeat}
          />
        </View>
      )}
      <Choice
        label="Help and playback check"
        onPress={() => showHelp((v) => !v)}
      />
      {help && (
        <View style={{maxWidth: dp(450)}}>
          <Text style={{color: 'white', fontSize: dp(14)}}>
            Use Left and Right on the timeline to seek. Hold to move faster.
            Press Down to reach the player controls. Select Options beside
            Continue Watching for more actions.
          </Text>
          <Choice
            label="Play test video · Big Buck Bunny"
            onPress={() =>
              play('https://media.w3.org/2010/05/bunny/trailer.mp4')
            }
          />
        </View>
      )}
    </ScrollView>
  );
}
