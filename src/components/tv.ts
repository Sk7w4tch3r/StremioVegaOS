import {Dimensions} from 'react-native';
import theme from '../assets/android-tv/theme.json';
// Android TV's reference canvas is 960 by 540 dp.
export const dp = (value: number) =>
  (value * Dimensions.get('window').width) / 960;
export const dim = theme.dim;
export const color = theme.color;
