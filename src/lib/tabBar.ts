/**
 * Native tab bar layout constants.
 *
 * With expo-router NativeTabs each tab screen fills the full window
 * height and the native UITabBar (iOS) / BottomNavigationView (Android)
 * floats on top. Content that must clear the bar — scroll padding,
 * bottom-sheet insets — needs the bar's height on top of the safe-area
 * inset, because `useSafeAreaInsets().bottom` only reports the home
 * indicator / gesture bar, not the tab bar itself.
 */
import { Platform } from 'react-native';

export const TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 80,
  default: 56,
});
