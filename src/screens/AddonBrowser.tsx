import React, {useEffect, useState} from 'react';
import {TextInput, View, Text} from 'react-native';
import {Addon, addonDirectory, inspectAddon} from '../api/stremio';
import {Choice} from '../components/Choice';
import {AddonCard} from '../components/AddonCard';
export function AddonBrowser({
  list,
  select,
}: {
  list: Addon[];
  select: (a: Addon) => void;
}) {
  const [address, setAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function inspect() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      select(await inspectAddon(address));
    } catch {
      setError('Could not read that manifest. Check its URL.');
    } finally {
      setLoading(false);
    }
  }
  const [browse, setBrowse] = useState(false),
    [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<Addon[]>([]),
    [status, setStatus] = useState('');
  useEffect(() => {
    let live = true;
    if (!browse) return;
    setStatus('Loading directory…');
    addonDirectory(list)
      .then((rows) => {
        if (live) {
          setDirectory(rows);
          setStatus('');
        }
      })
      .catch(() => {
        if (live) setStatus('Could not load directory.');
      });
    return () => {
      live = false;
    };
  }, [browse, list]);
  const rows = (browse ? directory : list).filter((a) =>
    a.manifest.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <View>
      <View style={{flexDirection: 'row'}}>
        <Choice
          label={browse ? 'Installed' : '✓ Installed'}
          onPress={() => setBrowse(false)}
        />
        <Choice
          label={browse ? '✓ Directory' : 'Directory'}
          onPress={() => setBrowse(true)}
        />
      </View>
      <Choice label="Add by URL" onPress={() => setAdding((v) => !v)} />
      {adding && (
        <View>
          <TextInput
            accessibilityLabel="Add-on manifest URL"
            placeholder="Add-on manifest URL"
            placeholderTextColor="#aaa"
            value={address}
            onChangeText={setAddress}
            onSubmitEditing={inspect}
            autoCapitalize="none"
            autoCorrect={false}
            style={{color: 'white', padding: 10, backgroundColor: '#302a39'}}
          />
          <Choice
            label={loading ? 'Loading…' : 'Review add-on'}
            onPress={inspect}
          />
          {!!error && <Text style={{color: 'white'}}>{error}</Text>}
        </View>
      )}
      <TextInput
        accessibilityLabel="Search add-ons"
        placeholder="Search add-ons"
        placeholderTextColor="#bbb"
        value={query}
        onChangeText={setQuery}
        style={{
          color: 'white',
          padding: 10,
          fontSize: 20,
          backgroundColor: '#302a39',
        }}
      />
      {(!rows.length || (browse && !!status)) && (
        <Text style={{color: 'white'}}>
          {(browse && status) || 'No matching add-ons.'}
        </Text>
      )}
      {rows.map((a) => (
        <AddonCard key={a.transportUrl} addon={a} onPress={() => select(a)} />
      ))}
    </View>
  );
}
