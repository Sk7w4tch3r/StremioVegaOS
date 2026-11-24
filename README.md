# StremioVegaOS

An unofficial, **work-in-progress** Stremio client for Fire TV devices running Amazon Vega OS. The goal is to mimic the **computer version of Stremio** on a TV you can operate entirely with the Fire TV remote. The interface runs in React Native for Vega, and the app includes an on-device playback engine so you can turn your computer off after installation.

## What works today

- Sign in with a Stremio account, browse catalogs, search, and open your library and Continue Watching row inside the app.
- Select a season, episode, and stream. During playback, open the episode drawer to switch episodes.
- Focus the timeline and press Left or Right to seek. Hold the button to move faster. The player also has audio and subtitle controls.

Playback depends on the stream, codec, and device. Casting, full desktop-player parity, and publishing titles to the Fire TV Home Continue Watching row are still outstanding. Cross-device resume and automatic transitions between episodes need more device testing.

## Get started

The build below targets an **ARMv7 Vega Fire TV**. It was tested on macOS with Vega SDK 2.0.15159. Install Git, Node.js 20.19.4 or newer, npm, Go 1.25 or newer, and the Amazon Vega SDK. Run the shell block with Bash or Zsh, including if Fish is your default shell. If you installed the SDK elsewhere, adjust the environment-file path. [Amazon Vega developer documentation](https://developer.amazon.com/docs/vega/)

```sh
git clone https://github.com/Sk7w4tch3r/StremioVegaOS.git
cd StremioVegaOS
. "$HOME/vega/env"
npm ci --legacy-peer-deps
```

Build the on-device engine and its native bridge from source. Run these commands from the repository root.

```sh
sh modules/engine/build-armv7.sh
npx --no-install tsc -p modules/tsconfig.json
(cd modules && vega build -t armv7 -b Release)
```

Type-check the app, run the tests, and build an installable package with its JavaScript bundled.

```sh
npx --no-install tsc --noEmit
npm test -- --runInBand
npx --no-install react-native build-vega --target armv7 --build-type Release --build-number 16 --use-system-js-bundles true
```

For a device install, enable Developer Mode and network debugging on your Vega Fire TV. Connect your computer to the same network and replace the example address with the TV's IP. If multiple devices are connected, specify the intended device with the Vega CLI's `-d` option when installing and launching.

```sh
vega exec vda connect FIRE_TV_IP
vega device list
vega device install-app -p build/armv7-release/stremio-native_armv7.vpkg
vega device launch-app -a com.stremio.vega.native.main
```

## Contributing

**Contributions are welcome.** If you find a problem, open an issue with your Fire TV model, Vega OS version, the screen you were on, and the remote buttons needed to reproduce it. For a desktop UI difference, a screenshot with personal details cropped out is especially helpful.

To contribute code, fork the repository, create a branch, and make a focused change. Run the type check and tests above. For player or navigation changes, describe what you tried on a physical TV in your pull request. Please omit account tokens and private stream or add-on URLs from reports.

| To work on | Start here |
| --- | --- |
| Home, title details, settings, or playback | `src/screens/` |
| Focusable controls and season navigation | `src/components/` |
| Accounts, add-ons, captions, or watch history | `src/api/` |
| The on-device engine and its React Native bridge | `modules/engine/` and `modules/kepler/` |
| Player, history, and navigation tests | `test/` |

## Credits

This community project uses Stremio as its design reference. Stremio branding and third-party assets belong to their respective owners. The player time formatter comes from Stremio Web, and parts of the TV layout and artwork are based on the Stremio Android TV interface. [Stremio Web source](https://github.com/Stremio/stremio-web) · [Included Stremio Web license](vendor/stremio-web/LICENSE.md)

The interface uses Plus Jakarta Sans. The native torrent engine uses the anacrolix Go torrent library. [Font license](vendor/plus-jakarta-sans/OFL.txt) · [anacrolix/torrent](https://github.com/anacrolix/torrent)
