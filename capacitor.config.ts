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
    // Pin the scheme explicitly. getUserMedia (voice notes, calls) and
    // crypto.subtle (E2EE key generation) are both gated on the page being a
    // secure context; serving the bundle over https://localhost guarantees
    // that instead of relying on the framework default staying put.
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      // Google OAuth sign-in leaves the WebView and comes back
      'accounts.google.com',
      '*.google.com',
      'googleapis.com',
      '*.googleapis.com',
      // Supabase auth callback host for the OAuth round-trip
      'wltqcibehtucglflorga.supabase.co',
      '*.supabase.co',
    ],
  },
};

export default config;
