import React, {useEffect, useState} from 'react';
import {View, Text, ScrollView} from 'react-native';
import {Addon, Meta, libraryRecords, notificationVideos} from '../api/stremio';
import {MenuItem} from '../components/PlayerControl';
import {dp} from '../components/tv';

export function Calendar({
  list,
  account,
  open,
}: {
  list: Addon[];
  account: string;
  open: (m: Meta, id: string) => void;
}) {
  const [day, setDay] = useState(new Date());
  const [shows, setShows] = useState<Meta[]>([]);
  const [status, statusText] = useState('Loading releases…');
  useEffect(() => {
    let live = true;
    libraryRecords(account)
      .then((rows) => notificationVideos(list, rows, 'calendarVideosIds'))
      .then((metas) => {
        if (live) {
          setShows(metas);
          statusText('');
        }
      })
      .catch(() => {
        if (live) statusText('Could not load releases.');
      });
    return () => {
      live = false;
    };
  }, [list, account]);
  const year = day.getFullYear(),
    month = day.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const pad = (new Date(year, month, 1).getDay() + 6) % 7;
  const entries = new Map<number, {show: Meta; id: string; title: string}[]>();
  for (const show of shows)
    for (const v of show.videos || []) {
      const d = new Date(v.released || '');
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      const key = d.getDate(),
        rows = entries.get(key) || [];
      if (!rows.some((r) => r.id === v.id))
        rows.push({show, id: v.id, title: v.title || 'Episode ' + v.episode});
      entries.set(key, rows);
    }
  const cell = {width: '14.28%' as const};
  return (
    <ScrollView style={{flex: 1, padding: dp(14)}}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <MenuItem
          label="‹ Previous month"
          onPress={() => setDay(new Date(year, month - 1, 1))}
        />
        <Text style={{color: 'white', fontSize: dp(20)}}>
          {day.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})}
        </Text>
        <MenuItem
          label="Next month ›"
          onPress={() => setDay(new Date(year, month + 1, 1))}
        />
        <MenuItem label="Today" onPress={() => setDay(new Date())} />
      </View>
      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Text key={d} style={{...cell, color: '#bbb'}}>
            {d}
          </Text>
        ))}
        {Array.from({length: pad}, (_, i) => (
          <View key={'blank' + i} style={cell} />
        ))}
        {Array.from({length: days}, (_, i) => i + 1).map((n) => (
          <View
            key={n}
            style={{
              ...cell,
              backgroundColor: n === day.getDate() ? '#433454' : 'transparent',
            }}>
            <MenuItem
              label={String(n) + (entries.has(n) ? '  •' : '')}
              onPress={() => setDay(new Date(year, month, n))}
            />
          </View>
        ))}
      </View>
      <Text style={{color: 'white', marginTop: dp(6)}}>
        {status ||
          (entries.has(day.getDate())
            ? day.toLocaleDateString()
            : 'No releases on this date.')}
      </Text>
      {entries.get(day.getDate())?.map((row) => (
        <MenuItem
          key={row.id}
          label={row.show.name + ' · ' + row.title}
          onPress={() => open(row.show, row.id)}
        />
      ))}
    </ScrollView>
  );
}
