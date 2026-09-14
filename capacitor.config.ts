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
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '480015860775-kmnqqneo9ceafsfu724rpfcq2444bskt.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
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
