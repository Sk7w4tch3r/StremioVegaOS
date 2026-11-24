import {TurboModuleRegistry, type KeplerTurboModule} from '@amazon-devices/keplerscript-turbomodule-api';
export interface TorrentEngine extends KeplerTurboModule {
  openStream: (magnet: string, fileIndex: number) => string;
  stopStream: () => void;
}
export default TurboModuleRegistry.getEnforcing<TorrentEngine>('TorrentEngine');
