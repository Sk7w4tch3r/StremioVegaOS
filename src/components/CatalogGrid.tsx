import React, {useRef, useState} from 'react';
import {FlatList, Text, View} from 'react-native';
import {Meta, loadCatalog} from '../api/stremio';
import {Poster} from './Poster';
import {MenuItem} from './PlayerControl';
import {dp} from './tv';
export function CatalogGrid({
  name,
  cards,
  base,
  genre,
  back,
  open,
  options,
}: {
  name: string;
  cards: Meta[];
  base?: string;
  genre?: string;
  back: () => void;
  open: (m: Meta) => void;
  options?: (m: Meta) => void;
}) {
  const [more, setMore] = useState<Meta[]>([]),
    [end, setEnd] = useState(false),
    [busy, setBusy] = useState(false),
    [error, say] = useState('');
  const offset = useRef(cards.length),
    loading = useRef(false);
  const all = cards.concat(more);
  async function next() {
    if (!base || end || loading.current) return;
    loading.current = true;
    setBusy(true);
    say('');
    try {
      const extra =
        (genre ? 'genre=' + encodeURIComponent(genre) + '&' : '') +
        'skip=' +
        offset.current;
      const page = await loadCatalog({
        url: base.replace(/\.json$/, '/' + extra + '.json'),
      });
      const seen = new Set(all.map((m) => m.type + ':' + m.id));
      const fresh = page.filter((m) => {
        const id = m.type + ':' + m.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      offset.current += page.length;
      setEnd(!fresh.length);
      setMore((previous) => previous.concat(fresh));
    } catch {
      say('Could not load more titles.');
    } finally {
      loading.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{flex: 1, padding: dp(12)}}>
      <MenuItem label={'‹  ' + name} onPress={back} />
      <FlatList
        data={all}
        numColumns={6}
        keyExtractor={(m) => m.type + ':' + m.id}
        renderItem={({item, index}) => (
          <Poster
            first={index === 0}
            item={item}
            compact
            open={open}
            focus={() => {}}
            longPress={options ? () => options(item) : undefined}
          />
        )}
        ListFooterComponent={
          base && !end ? (
            <View>
              {!!error && <Text style={{color: 'white'}}>{error}</Text>}
              <MenuItem
                label={busy ? 'Loading…' : 'Load more titles'}
                onPress={next}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}
