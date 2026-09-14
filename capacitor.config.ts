import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sovo.chat',
  appName: 'SovoChat',
  webDir: 'dist',
  android: {
    // Draw behind system bars for true fullscreen
    backgroundColor: '#07070b',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
  server: {
    // Allow Firebase auth redirects to come back into the WebView
    allowNavigation: [
      'accounts.google.com',
      '*.google.com',
      'fir-ovo.firebaseapp.com',
      '*.firebaseapp.com',
    ],
  },
};

export default config;
