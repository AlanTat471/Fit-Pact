import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tatindustries.numi',
  appName: 'Numi',
  webDir: 'dist',
  android: {
    // Render the WebView edge-to-edge under the Android system bars so the
    // page can paint behind the gesture/3-button navigation. The bottom nav
    // uses safe-area insets (.pb-safe-nav) to stay clear of those buttons.
    // Users can swipe up to summon the system buttons without leaving the app.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
