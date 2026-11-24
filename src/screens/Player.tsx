import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  BackHandler,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  TVFocusGuideView,
  useTVEventHandler,
} from '@amazon-devices/react-native-kepler';
import {
  Video,
  type AudioTrack,
  type TextTrack,
} from '@amazon-devices/react-native-w3cmedia';
import {TorrentEngine} from '@amazon-devices/torrentengine';
import Storage from '@amazon-devices/react-native-async-storage__async-storage';
import {languageCode, languageName} from '../api/languages';
import {watchedEpisodes} from '../api/watched';
import {Cue, parseCaptions} from '../api/captions';
import {Stream, magnet, subtitles, Subtitle, Addon, Meta} from '../api/stremio';
import {PlayerControl, MenuItem} from '../components/PlayerControl';
import {EpisodeCatalog} from '../components/EpisodeCatalog';
import formatTime from './formatTime';
import {dp} from '../components/tv';

type Props = {
  stream: Stream;
  streams?: Stream[];
  onStream?: (s: Stream, offset: number) => void;
  episodes?: Meta['videos'];
  countdown?: number;
  addons?: Addon[];
  mediaType?: string;
  audioLanguage?: string;
  subtitleLanguage?: string;
  watchedField?: string;
  progress?: {videoId: string; offset: number; duration: number};
  episodeHistory?: ReadonlyMap<
    string,
    {videoId: string; offset: number; duration: number}
  >;
  episodeId?: string;
  onEpisode?: (id: string, automatic?: boolean) => void;
  back: () => void;
  captions?: boolean;
  seek?: number;
  title?: string;
  initialTime?: number;
  onPosition?: (seconds: number, duration: number, finished?: boolean) => void;
};
export function Player({
  stream,
  back,
  captions = true,
  seek = 10,
  title,
  initialTime = 0,
  onPosition,
  streams = [],
  onStream,
  episodes = [],
  episodeId,
  onEpisode,
  countdown = 10,
  addons,
  mediaType,
  audioLanguage,
  subtitleLanguage,
  watchedField,
  progress,
  episodeHistory,
}: Props) {
  const {width, height} = useWindowDimensions(),
    video = useRef<Video>(null);
  const [src, setSrc] = useState(''),
    [notice, say] = useState('Opening stream…'),
    [paused, setPaused] = useState(true);
  const [visible, show] = useState(true),
    [activity, tickle] = useState(0);
  const [pos, setPos] = useState(0),
    [duration, setDuration] = useState(0);
  type Panel =
    | 'Audio'
    | 'Subtitles'
    | 'Playback speed'
    | 'Streams'
    | 'Episodes'
    | 'Options'
    | 'Volume';
  const [panel, setPanel] = useState<Panel>();
  const [scale, setScale] = useState<'fit' | 'fill'>('fit');
  const [volume, setVolume] = useState(1);
  const [slider, setSlider] = useState<'seek' | 'volume'>();
  const ordered = React.useMemo(
    () =>
      [...episodes].sort(
        (a, b) =>
          (a.season ?? 1) - (b.season ?? 1) ||
          (a.episode ?? 0) - (b.episode ?? 0),
      ),
    [episodes],
  );
  const currentIndex = ordered.findIndex((v) => v.id === episodeId);
  const next =
    currentIndex < 0
      ? undefined
      : ordered
          .slice(currentIndex + 1)
          .find((v) => !v.released || !(Date.parse(v.released) > Date.now()));
  const seen = React.useMemo(() => {
    try {
      return watchedEpisodes(ordered, watchedField).watched;
    } catch {
      return new Set<string>();
    }
  }, [ordered, watchedField]);
  const automaticTracks = useRef({audio: false, subtitles: false});
  const [cancelled, cancelNext] = useState(false);
  const autoNext = next && currentIndex >= 0 && countdown > 0 && !cancelled;
  const onFinish = useRef<() => void>(() => {});
  onFinish.current = () => {
    if (autoNext && next && onEpisode) onEpisode(next.id, true);
    else back();
  };
  const [extra, setExtra] = useState<Subtitle[]>([]);
  const [subStatus, setSubStatus] = useState('');
  const [external, setExternal] = useState<Subtitle>();
  const [cues, setCues] = useState<Cue[]>([]);
  const [clock, setClock] = useState(0);
  const [delay, setDelay] = useState(0);
  const [size, setSize] = useState(18);
  const [heightPercent, setHeightPercent] = useState(12);
  useEffect(() => {
    let live = true;
    Storage.multiGet(['captionSize', 'captionHeight'])
      .then((pairs) => {
        if (!live) return;
        const values = Object.fromEntries(pairs);
        if ([14, 16, 18, 20, 22, 24, 26].includes(Number(values.captionSize)))
          setSize(Number(values.captionSize));
        if ([6, 12, 18, 24, 30].includes(Number(values.captionHeight)))
          setHeightPercent(Number(values.captionHeight));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  function changeSize() {
    const value = size >= 26 ? 14 : size + 2;
    setSize(value);
    Storage.setItem('captionSize', String(value)).catch(() =>
      setSubStatus('Could not save subtitle size.'),
    );
  }
  function changeHeight() {
    const value = heightPercent >= 30 ? 6 : heightPercent + 6;
    setHeightPercent(value);
    Storage.setItem('captionHeight', String(value)).catch(() =>
      setSubStatus('Could not save subtitle position.'),
    );
  }
  const subtitleRequest = useRef<AbortController | null>(null);
  useEffect(() => () => subtitleRequest.current?.abort(), []);
  useEffect(() => {
    if (panel !== 'Subtitles') return;
    let live = true;
    const embedded = stream.subtitles || [];
    setExtra(embedded);
    if (!addons || !mediaType || !episodeId) return;
    setSubStatus('Looking for subtitles…');
    subtitles(addons, mediaType, episodeId)
      .then((found) => {
        if (!live) return;
        const unique = new Map(
          [...embedded, ...found].map((sub) => [sub.url, sub]),
        );
        setExtra(
          [...unique.values()].sort(
            (a, b) =>
              Number(languageCode(b.lang) === subtitleLanguage) -
              Number(languageCode(a.lang) === subtitleLanguage),
          ),
        );
        setSubStatus('');
      })
      .catch(() => {
        if (live) setSubStatus('Subtitle providers could not be reached.');
      });
    return () => {
      live = false;
    };
  }, [panel, addons, mediaType, episodeId, stream, subtitleLanguage]);
  useEffect(() => {
    if (!external) return;
    const timer = setInterval(
      () => setClock(video.current?.currentTime || 0),
      150,
    );
    return () => clearInterval(timer);
  }, [external]);
  const captionText = React.useMemo(
    () =>
      cues
        .filter((c) => c.start <= clock - delay && c.end > clock - delay)
        .map((c) => c.text)
        .join('\n'),
    [clock, delay, cues],
  );
  async function chooseExternal(sub: Subtitle) {
    subtitleRequest.current?.abort();
    const controller = new AbortController();
    subtitleRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setSubStatus('Loading subtitle track…');
    try {
      const res = await fetch(sub.url, {signal: controller.signal});
      if (!res.ok) throw new Error();
      const parsed = parseCaptions(await res.text());
      if (!parsed.length) throw new Error();
      if (controller.signal.aborted) return;
      for (const t of subtitleList) t.mode = 'disabled';
      automaticTracks.current.subtitles = true;
      setCues(parsed);
      setExternal(sub);
      setCc(false);
      setDelay(0);
      setSubStatus('');
      setPanel(undefined);
      wake();
    } catch {
      if (subtitleRequest.current === controller)
        setSubStatus(
          'Could not open this subtitle track. Try another variant.',
        );
    } finally {
      clearTimeout(timeout);
    }
  }
  useEffect(() => {
    if (!panel) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPanel(undefined);
      return true;
    });
    return () => sub.remove();
  }, [panel]);
  const latest = useRef({time: 0, duration: 0}),
    resume = useRef(initialTime),
    lastWrite = useRef(0),
    ended = useRef(false);
  const checkpoint = useRef(onPosition);
  checkpoint.current = onPosition;
  const wake = useCallback(() => {
    show(true);
    tickle((n) => n + 1);
  }, []);
  const written = useRef(-1);
  function save() {
    const s = latest.current;
    if (
      !ended.current &&
      s.time > 0 &&
      s.duration > 0 &&
      Math.floor(s.time) !== written.current
    ) {
      written.current = Math.floor(s.time);
      checkpoint.current?.(s.time, s.duration);
    }
  }
  useEffect(() => () => save(), []);
  useEffect(() => {
    const uri = magnet(stream);
    try {
      const addr = uri
        ? TorrentEngine.openStream(uri, stream.fileIdx ?? -1)
        : stream.url;
      if (!addr || !/^https?:\/\//.test(addr))
        throw new Error(addr || 'No playable URL');
      setSrc(addr);
    } catch (e) {
      say(String(e));
    }
    return () => {
      if (uri) TorrentEngine.stopStream();
    };
  }, [stream]);
  useEffect(() => {
    if (!visible || paused || notice || panel) return;
    const timer = setTimeout(() => show(false), 6000);
    return () => clearTimeout(timer);
  }, [visible, paused, notice, activity, panel]);
  const openingAt = useRef(Date.now());
  function update() {
    const v = video.current;
    if (!v) return;
    if (v.readyState >= 1) {
      if (audioLanguage && !automaticTracks.current.audio) {
        const tracks = Array.from(
          v.audioTracks as unknown as ArrayLike<AudioTrack>,
        );
        const track = tracks.find(
          (t) => languageCode(t.language) === audioLanguage,
        );
        if (track) {
          track.enabled = true;
          automaticTracks.current.audio = true;
        }
      }
      if (captions && subtitleLanguage && !automaticTracks.current.subtitles) {
        const tracks = Array.from(
          v.textTracks as unknown as ArrayLike<TextTrack>,
        );
        const track = tracks.find(
          (t) => languageCode(t.language) === subtitleLanguage,
        );
        if (track) {
          for (const t of tracks) t.mode = t === track ? 'showing' : 'disabled';
          automaticTracks.current.subtitles = true;
        }
      }
    }
    const rawDuration = v.duration;
    const rawTime = v.currentTime;
    const d = Number.isFinite(rawDuration) ? rawDuration : 0;
    const t = Number.isFinite(rawTime) ? rawTime : 0;
    if (v.readyState >= 2 || t > 0) {
      say((message) =>
        message === 'Opening stream…' ||
        message.startsWith('The stream has not started')
          ? ''
          : message,
      );
      setPaused(v.paused);
    } else if (Date.now() - openingAt.current > 25000) {
      say((message) =>
        message === 'Opening stream…'
          ? 'The stream has not started. Press Back to choose another source.'
          : message,
      );
    }
    if (d > 0 && resume.current > 0) {
      const offset = resume.current;
      resume.current = 0;
      if (offset < d) v.currentTime = offset;
      return;
    }
    latest.current = {time: t, duration: d};
    setPos(Math.floor(t));
    setDuration(Math.floor(d));
    if (t > 0 && Date.now() - lastWrite.current > 15000) {
      lastWrite.current = Date.now();
      save();
    }
  }
  const updatePlayback = useRef(update);
  updatePlayback.current = update;
  useEffect(() => {
    if (!src) return;
    // URL playback on Vega can advance before it emits the first timeupdate.
    const timer = setInterval(() => updatePlayback.current(), 1000);
    return () => clearInterval(timer);
  }, [src]);
  const pendingSeek = useRef<number | undefined>(undefined);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const repeats = useRef({direction: 0, time: 0, count: 0});
  const [preview, setPreview] = useState<number>();
  const displayTime = preview ?? pos;
  function finishSeek() {
    if (seekTimer.current !== undefined) clearTimeout(seekTimer.current);
    const target = pendingSeek.current;
    pendingSeek.current = undefined;
    setPreview(undefined);
    const v = video.current;
    if (target === undefined || !v) return;
    v.currentTime = target;
    latest.current.time = target;
    setPos(Math.floor(target));
  }
  useEffect(
    () => () => {
      if (seekTimer.current !== undefined) clearTimeout(seekTimer.current);
    },
    [],
  );
  function skip(delta: number) {
    wake();
    const v = video.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const last = repeats.current;
    const now = Date.now();
    const direction = Math.sign(delta);
    const count =
      direction === last.direction && now - last.time < 350
        ? last.count + 1
        : 0;
    repeats.current = {direction, time: now, count};
    // Match Stremio's useKeyboardSeek hold acceleration and cap.
    const step = Math.max(
      Math.abs(delta),
      Math.min(Math.abs(delta) * Math.pow(1.05, count), v.duration * 0.1),
    );
    const target = Math.max(
      0,
      Math.min(
        v.duration - 0.1,
        (pendingSeek.current ?? v.currentTime) + direction * step,
      ),
    );
    pendingSeek.current = target;
    setPreview(target);
    if (seekTimer.current !== undefined) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(finishSeek, 370);
  }
  function toggle() {
    wake();
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => say('Could not resume playback.'));
    else v.pause();
  }
  const [rate, setRate] = useState(1);
  const [rateEntry, setRateEntry] = useState('');
  const [rateMessage, setRateMessage] = useState('');
  function chooseRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      setRateMessage('Enter a positive speed.');
      return;
    }
    try {
      if (!video.current) return;
      video.current.playbackRate = value;
      setRate(value);
      setRateMessage('');
      setPanel(undefined);
    } catch {
      setRateMessage('This speed is unavailable for this stream.');
    }
  }

  const [cc, setCc] = useState(captions);

  const audioList =
    panel === 'Audio' && video.current
      ? Array.from(
          video.current.audioTracks as unknown as ArrayLike<AudioTrack>,
        )
      : [];
  const subtitleList =
    panel === 'Subtitles' && video.current
      ? Array.from(video.current.textTracks as unknown as ArrayLike<TextTrack>)
      : [];
  function chooseSub(track?: TextTrack) {
    automaticTracks.current.subtitles = true;
    subtitleRequest.current?.abort();
    subtitleRequest.current = null;
    setExternal(undefined);
    setCues([]);
    for (const t of subtitleList) t.mode = t === track ? 'showing' : 'disabled';
    setCc(!!track);
    setPanel(undefined);
    wake();
  }
  function changeVolume(value: number) {
    const v = video.current;
    if (!v) return;
    const next = Math.max(0, Math.min(1, value));
    v.muted = next === 0;
    v.volume = next;
    setVolume(next);
    wake();
  }
  const handler = useRef(
    (_event: {eventType: string; eventKeyAction?: number}) => {},
  );
  handler.current = (e) => {
    if (e.eventKeyAction === 1) return;
    const event = e.eventType.toLowerCase();
    if (
      !panel &&
      (!visible || slider === 'seek') &&
      (event === 'left' || event === 'right')
    ) {
      const sign = event === 'left' ? -1 : 1;
      skip(sign * seek);
      return;
    }
    switch (event) {
      case 'playpause':
        toggle();
        break;
      case 'forward':
      case 'fastforward':
      case 'skip_forward':
        skip(seek);
        break;
      case 'rewind':
      case 'skip_backward':
        skip(-seek);
        break;
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'menu':
        wake();
        break;
    }
  };
  useTVEventHandler(useCallback((event) => handler.current(event), []));
  return (
    <View style={{flex: 1, backgroundColor: 'black'}}>
      {src ? (
        <Video
          ref={video}
          width={width}
          height={height}
          src={src}
          controls={false}
          autoplay
          showCaptions={cc}
          scalingmode={scale}
          onLoadedMetadata={update}
          onTimeUpdate={update}
          onPlaying={() => {
            say('');
            setPaused(false);
          }}
          onPause={() => {
            setPaused(true);
            wake();
            save();
          }}
          onEnded={() => {
            ended.current = true;
            checkpoint.current?.(0, latest.current.duration, true);
            onFinish.current();
          }}
          onError={() => {
            say('This stream could not be played on the Fire TV.');
            wake();
          }}
        />
      ) : null}
      {!!captionText && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '6%',
            right: '6%',
            bottom: ((visible ? Math.max(17, heightPercent) : heightPercent) +
              '%') as `${number}%`,
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: 'white',
              fontSize: dp(size),
              textAlign: 'center',
              backgroundColor: 'rgba(0,0,0,0.66)',
              paddingHorizontal: dp(5),
            }}>
            {captionText}
          </Text>
        </View>
      )}
      {!visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show playback controls"
          hasTVPreferredFocus
          style={StyleSheet.absoluteFill}
          onPress={wake}
        />
      ) : null}
      {visible && !panel && (
        <>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              paddingHorizontal: dp(12),
              height: dp(42),
              backgroundColor: 'rgba(0,0,0,0.72)',
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <PlayerControl
              icon="back"
              label="Back"
              onPress={back}
              onFocus={wake}
            />
            <Text
              numberOfLines={1}
              style={{flex: 1, color: '#eee', fontSize: dp(11)}}>
              {title || stream.name || 'Playback'}
            </Text>
            <PlayerControl
              icon={scale === 'fit' ? 'fit' : 'fill'}
              label="Change video size"
              onPress={() => {
                setScale(scale === 'fit' ? 'fill' : 'fit');
                wake();
              }}
              onFocus={wake}
            />
          </View>
          {!!episodes.length && !panel && (
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: '43%',
                height: dp(76),
                borderTopLeftRadius: dp(44),
                borderBottomLeftRadius: dp(44),
                backgroundColor: '#171423',
                justifyContent: 'center',
              }}>
              <PlayerControl
                icon="back"
                label="Browse seasons and episodes"
                onPress={() => setPanel('Episodes')}
                onFocus={wake}
              />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: dp(14),
              paddingBottom: dp(4),
              backgroundColor: 'rgba(0,0,0,0.84)',
            }}>
            {!!notice && (
              <Text
                style={{
                  color: 'white',
                  fontSize: dp(12),
                  marginVertical: dp(4),
                }}>
                {notice}
              </Text>
            )}
            {(slider === 'seek' || preview !== undefined) && (
              <Text
                style={{color: 'white', fontSize: dp(11), alignSelf: 'center'}}>
                {preview !== undefined
                  ? formatTime(preview * 1000)
                  : '◀   Seek   ▶     Hold to move faster'}
              </Text>
            )}
            <TVFocusGuideView
              trapFocusLeft
              trapFocusRight
              style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.time}>{formatTime(displayTime * 1000)}</Text>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Playback position"
                hasTVPreferredFocus
                onPress={
                  pendingSeek.current === undefined ? toggle : finishSeek
                }
                onFocus={() => {
                  setSlider('seek');
                  wake();
                }}
                onBlur={() => setSlider(undefined)}
                style={{
                  flex: 1,
                  height: dp(22),
                  justifyContent: 'center',
                  marginHorizontal: dp(9),
                }}>
                <View
                  style={{
                    height: dp(
                      slider === 'seek' || preview !== undefined ? 5 : 3,
                    ),
                    backgroundColor: '#322747',
                    borderRadius: dp(4),
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${
                        duration
                          ? Math.min(100, (displayTime / duration) * 100)
                          : 0
                      }%`,
                      backgroundColor: '#7957ef',
                      borderRadius: dp(4),
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                    }}>
                    <View
                      style={{
                        width: dp(9),
                        height: dp(9),
                        marginRight: -dp(4),
                        borderRadius: dp(5),
                        backgroundColor:
                          slider === 'seek' ? 'white' : '#a58aff',
                        borderWidth: dp(1.5),
                        borderColor: '#7957ef',
                      }}
                    />
                  </View>
                </View>
              </Pressable>
              <Text style={styles.time}>
                {formatTime(duration ? duration * 1000 : null)}
              </Text>
            </TVFocusGuideView>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <PlayerControl
                icon={paused ? 'play' : 'pause'}
                label={paused ? 'Play' : 'Pause'}
                onPress={toggle}
                onFocus={wake}
              />
              {onEpisode && next && (
                <PlayerControl
                  icon="next"
                  label="Next episode"
                  onPress={() => onEpisode(next.id)}
                  onFocus={wake}
                />
              )}
              <PlayerControl
                icon={volume ? 'sound' : 'mute'}
                label="Mute or unmute"
                onPress={() => changeVolume(volume ? 0 : 1)}
                onFocus={wake}
              />
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Volume"
                onFocus={() => {
                  setSlider('volume');
                  wake();
                }}
                onBlur={() => setSlider(undefined)}
                onPress={() => setPanel('Volume')}
                style={{
                  width: dp(70),
                  height: dp(30),
                  justifyContent: 'center',
                  marginLeft: dp(4),
                }}>
                <View
                  style={{
                    height: dp(3),
                    backgroundColor: '#70636a',
                    borderRadius: dp(3),
                  }}>
                  <View
                    style={{
                      width: `${volume * 100}%`,
                      height: '100%',
                      backgroundColor: 'white',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                    }}>
                    <View
                      style={{
                        width: dp(7),
                        height: dp(7),
                        borderRadius: dp(4),
                        backgroundColor:
                          slider === 'volume' ? '#ac92ff' : 'white',
                      }}
                    />
                  </View>
                </View>
              </Pressable>
              <View style={{flex: 1}} />
              <PlayerControl
                icon="speed"
                label="Playback speed"
                onPress={() => setPanel('Playback speed')}
                onFocus={wake}
              />
              <PlayerControl
                icon="captions"
                label="Subtitles"
                onPress={() => setPanel('Subtitles')}
                onFocus={wake}
              />
              <PlayerControl
                icon="audio"
                label="Audio tracks"
                onPress={() => setPanel('Audio')}
                onFocus={wake}
              />
              {!!episodes.length && (
                <PlayerControl
                  icon="episodes"
                  label="Episodes"
                  onPress={() => setPanel('Episodes')}
                  onFocus={wake}
                />
              )}
              {!!streams.length && (
                <PlayerControl
                  icon="streams"
                  label="Streams"
                  onPress={() => setPanel('Streams')}
                  onFocus={wake}
                />
              )}
              <PlayerControl
                icon="more"
                label="More options"
                onPress={() => setPanel('Options')}
                onFocus={wake}
              />
            </View>
          </View>
        </>
      )}
      {autoNext &&
        !panel &&
        !paused &&
        duration > 0 &&
        duration - pos <= countdown &&
        next && (
          <View
            style={{
              position: 'absolute',
              bottom: dp(90),
              right: dp(14),
              borderRadius: dp(8),
              padding: dp(8),
              backgroundColor: '#211c2c',
            }}>
            <Text style={styles.time}>
              Up next in {Math.max(0, duration - pos)}s · {next.title}
            </Text>
            <MenuItem
              label="Cancel autoplay"
              onPress={() => cancelNext(true)}
            />
          </View>
        )}
      {panel && (
        <View
          style={{
            position: 'absolute',
            right: dp(14),
            bottom: dp(64),
            top: dp(50),
            width: dp(245),
            padding: dp(10),
            borderRadius: dp(10),
            backgroundColor: '#191622',
          }}>
          <Text
            style={{
              fontSize: dp(15),
              fontWeight: 'bold',
              color: 'white',
              margin: dp(5),
            }}>
            {panel}
          </Text>
          {panel === 'Episodes' || panel === 'Streams' ? (
            <>
              <MenuItem label="Close" onPress={() => setPanel(undefined)} />
              {panel === 'Episodes' ? (
                <EpisodeCatalog
                  videos={episodes}
                  watched={seen}
                  progress={progress}
                  episodeHistory={episodeHistory}
                  currentId={episodeId}
                  choose={(id) => {
                    setPanel(undefined);
                    if (id !== episodeId) onEpisode?.(id);
                  }}
                />
              ) : (
                <FlatList
                  data={streams}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({item, index}) => (
                    <MenuItem
                      first={index === 0}
                      label={item.name || 'Stream ' + (index + 1)}
                      detail={item.description || item.title}
                      onPress={() => {
                        setPanel(undefined);
                        if (item !== stream)
                          onStream?.(item, latest.current.time);
                      }}
                    />
                  )}
                />
              )}
            </>
          ) : (
            <ScrollView key={panel}>
              <MenuItem
                first
                label="Close"
                onPress={() => setPanel(undefined)}
              />
              {panel === 'Audio' &&
                (audioList.length ? (
                  audioList.map((t, i) => (
                    <MenuItem
                      key={i}
                      label={
                        (t.enabled ? '✓  ' : '') +
                        (t.label || t.language || 'Track ' + (i + 1))
                      }
                      onPress={() => {
                        automaticTracks.current.audio = true;
                        t.enabled = true;
                        setPanel(undefined);
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.time}>Default audio track</Text>
                ))}
              {panel === 'Subtitles' && (
                <>
                  <MenuItem label="Off" onPress={() => chooseSub()} />
                  {!!subStatus && <Text style={styles.time}>{subStatus}</Text>}
                  {external && (
                    <>
                      <Text style={styles.time}>
                        {external.lang} · {external.provider || 'Stream'} ·
                        Delay {delay.toFixed(1)} s
                      </Text>
                      <MenuItem
                        label="Subtitles earlier"
                        onPress={() =>
                          setDelay((n) => Math.round((n - 0.1) * 10) / 10)
                        }
                      />
                      <MenuItem
                        label="Subtitles later"
                        onPress={() =>
                          setDelay((n) => Math.round((n + 0.1) * 10) / 10)
                        }
                      />
                      <MenuItem
                        label={'Subtitle size · ' + size}
                        onPress={changeSize}
                      />
                      <MenuItem
                        label={'Vertical position · ' + heightPercent + '%'}
                        onPress={changeHeight}
                      />
                    </>
                  )}
                  {subtitleList.map((t, i) => (
                    <MenuItem
                      key={i}
                      label={
                        (t.mode === 'showing' ? '✓  ' : '') +
                        (t.label || t.language || 'Track ' + (i + 1))
                      }
                      onPress={() => chooseSub(t)}
                    />
                  ))}
                </>
              )}
              {panel === 'Subtitles' &&
                extra.map((sub, i) => (
                  <MenuItem
                    key={sub.url}
                    label={
                      (external?.url === sub.url ? '✓  ' : '') +
                      languageName(sub.lang) +
                      ' · ' +
                      (sub.provider || 'Stream')
                    }
                    detail={'Variant ' + (i + 1)}
                    onPress={() => chooseExternal(sub)}
                  />
                ))}
              {panel === 'Volume' &&
                [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((n) => (
                  <MenuItem
                    key={n}
                    label={
                      (n === volume ? '✓  ' : '') + Math.round(n * 100) + '%'
                    }
                    onPress={() => {
                      changeVolume(n);
                      setPanel(undefined);
                    }}
                  />
                ))}
              {panel === 'Playback speed' &&
                [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 4].map((n) => (
                  <MenuItem
                    key={n}
                    label={(n === rate ? '✓  ' : '') + n + '×'}
                    onPress={() => chooseRate(n)}
                  />
                ))}
              {panel === 'Playback speed' && (
                <View>
                  <TextInput
                    accessibilityLabel="Custom playback speed"
                    placeholder="Custom speed"
                    placeholderTextColor="#aaa"
                    keyboardType="decimal-pad"
                    value={rateEntry}
                    onChangeText={setRateEntry}
                    onSubmitEditing={() =>
                      chooseRate(Number(rateEntry.replace(',', '.')))
                    }
                    style={{
                      color: 'white',
                      backgroundColor: '#302a39',
                      padding: dp(6),
                    }}
                  />
                  <MenuItem
                    label="Apply speed"
                    onPress={() =>
                      chooseRate(Number(rateEntry.replace(',', '.')))
                    }
                  />
                  {!!rateMessage && (
                    <Text style={styles.time}>{rateMessage}</Text>
                  )}
                </View>
              )}
              {panel === 'Options' && (
                <>
                  <MenuItem
                    label={'Video size · ' + scale}
                    onPress={() => {
                      setScale(scale === 'fit' ? 'fill' : 'fit');
                      setPanel(undefined);
                    }}
                  />
                  <MenuItem
                    label={'Rewind ' + seek + ' seconds'}
                    onPress={() => {
                      skip(-seek);
                      setPanel(undefined);
                    }}
                  />
                  <MenuItem
                    label={'Forward ' + seek + ' seconds'}
                    onPress={() => {
                      skip(seek);
                      setPanel(undefined);
                    }}
                  />
                  <MenuItem
                    label="Hide controls"
                    onPress={() => {
                      setPanel(undefined);
                      show(false);
                    }}
                  />
                </>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({time: {color: '#dedde0', fontSize: dp(10)}});
export function episodeLabel(v: {
  title?: string;
  season?: number;
  episode?: number;
}) {
  return [
    v.title,
    v.season != null && v.episode != null
      ? '(' + v.season + '×' + v.episode + ')'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}
